import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync } from 'fs'
import type { BranchContext } from './types.js'

/**
 * Context storage manager for branch-specific contexts
 */
export class ContextStorage {
  private storageDir: string
  
  constructor(storageDir: string) {
    this.storageDir = storageDir
  }
  
  /**
   * Get the file path for a branch
   * @param branch - Branch name
   * @returns Full path to branch context file
   */
  private getBranchFile(branch: string): string {
    return path.join(this.storageDir, `${this.sanitizeBranchName(branch)}.json`)
  }
  
  /**
   * Get the backup file path for a branch
   * @param branch - Branch name
   * @param timestamp - Timestamp for backup filename
   * @returns Full path to backup file
   */
  private getBackupFile(branch: string, timestamp: number): string {
    const safeBranch = this.sanitizeBranchName(branch)
    return path.join(this.storageDir, `${safeBranch}.backup.${timestamp}.json`)
  }
  
  /**
   * Sanitize branch name for safe filename usage
   * @param branch - Branch name to sanitize
   * @returns Sanitized branch name
   */
  private sanitizeBranchName(branch: string): string {
    return branch
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '-')
      .substring(0, 255)
  }
  
  /**
   * Ensure storage directory exists
   */
  async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true })
    } catch (error) {
      console.error('Failed to create storage directory:', error)
      throw error
    }
  }
  
  /**
   * Save context for a branch with automatic backup
   * @param branch - Branch name
   * @param context - Branch context to save
   */
  async saveContext(branch: string, context: BranchContext): Promise<void> {
    await this.ensureStorageDir()
    
    const filePath = this.getBranchFile(branch)
    // Use unique temp file to avoid race conditions in concurrent saves
    const tempFile = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).substring(2, 9)}`
    
    try {
      // Create backup if file exists
      if (existsSync(filePath)) {
        await this.createBackup(branch, filePath)
      }
      
      // Write to temp file first (atomic operation)
      await fs.writeFile(tempFile, JSON.stringify(context, null, 2), 'utf8')
      
      // Atomic rename (guaranteed on all platforms)
      await fs.rename(tempFile, filePath)
    } catch (error) {
      // Cleanup temp file on failure
      try {
        await fs.unlink(tempFile).catch(() => {})
      } catch {}
      throw error
    }
  }
  
  /**
   * Load context for a branch with validation
   * @param branch - Branch name
   * @returns Branch context or null if not found
   */
  async loadContext(branch: string): Promise<BranchContext | null> {
    const filePath = this.getBranchFile(branch)
    
    if (!existsSync(filePath)) {
      return null
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const data = JSON.parse(content) as BranchContext
      
      // Validate version compatibility
      if (data.metadata?.version !== '1.0.0') {
        console.warn(`Context version mismatch for branch '${branch}': ${data.metadata?.version}`)
      }
      
      return data
    } catch (error) {
      console.error(`Failed to load context for branch '${branch}':`, error)
      
      // Try to restore from backup
      const backup = await this.restoreFromBackup(branch)
      if (backup) {
        console.info(`Restored from backup for branch '${branch}'`)
        return backup
      }
      
      return null
    }
  }
  
  /**
   * Create backup of existing context file
   * @param branch - Branch name
   * @param filePath - Path to existing file
   */
  private async createBackup(branch: string, filePath: string): Promise<void> {
    try {
      // Check if file still exists (might have been deleted by concurrent operation)
      if (!existsSync(filePath)) {
        return
      }
      
      const backupFile = this.getBackupFile(branch, Date.now())
      await fs.copyFile(filePath, backupFile)
      
      // Clean old backups (keep last 5)
      await this.cleanOldBackups(branch)
    } catch (error) {
      console.warn('Failed to create backup:', error)
    }
  }
  
  /**
   * Clean old backups, keeping only the last maxBackups
   * @param branch - Branch name
   */
  private async cleanOldBackups(branch: string): Promise<void> {
    try {
      const files = await fs.readdir(this.storageDir)
      const safeBranch = this.sanitizeBranchName(branch)
      const backups = files
        .filter(f => f.startsWith(`${safeBranch}.backup.`) && f.endsWith('.json'))
        .map(f => {
          const match = f.match(/\.backup\.(\d+)\.json$/)
          return { name: f, timestamp: match ? parseInt(match[1], 10) : 0 }
        })
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(5) // Keep last 5
      
      for (const backup of backups) {
        await fs.unlink(path.join(this.storageDir, backup.name)).catch(() => {})
      }
    } catch (error) {
      console.warn('Failed to clean old backups:', error)
    }
  }
  
  /**
   * Restore context from backup files
   * @param branch - Branch name
   * @returns Restored context or null if no valid backup found
   */
  private async restoreFromBackup(branch: string): Promise<BranchContext | null> {
    try {
      const files = await fs.readdir(this.storageDir)
      const safeBranch = this.sanitizeBranchName(branch)
      const backups = files
        .filter(f => f.startsWith(`${safeBranch}.backup.`) && f.endsWith('.json'))
        .map(f => {
          const match = f.match(/\.backup\.(\d+)\.json$/)
          return { name: f, timestamp: match ? parseInt(match[1], 10) : 0 }
        })
        .sort((a, b) => b.timestamp - a.timestamp)
      
      for (const backup of backups) {
        try {
          const content = await fs.readFile(
            path.join(this.storageDir, backup.name),
            'utf8'
          )
          return JSON.parse(content) as BranchContext
        } catch {
          // Try next backup
          continue
        }
      }
    } catch (error) {
      console.error('Failed to restore from backup:', error)
    }
    return null
  }
  
  /**
   * List all branches with saved contexts
   * @returns Array of branch names
   */
  async listBranches(): Promise<string[]> {
    try {
      await this.ensureStorageDir()
      const files = await fs.readdir(this.storageDir)
      const branches: string[] = []
      
      for (const file of files) {
        if (file.endsWith('.json') && !file.includes('.backup.')) {
          try {
            const filePath = path.join(this.storageDir, file)
            const content = await fs.readFile(filePath, 'utf8')
            const data = JSON.parse(content) as BranchContext
            branches.push(data.branch)
          } catch {
            // Skip invalid files
            continue
          }
        }
      }
      
      return branches
    } catch (error) {
      console.error('Failed to list branches:', error)
      return []
    }
  }
  
  /**
   * Get metadata for a branch's saved context
   * @param branch - Branch name
   * @returns Metadata object
   */
  async getMetadata(branch: string): Promise<{
    size: string
    modified: string
    messageCount: number
    todoCount: number
    fileCount: number
  }> {
    const filePath = this.getBranchFile(branch)
    
    if (!existsSync(filePath)) {
      return {
        size: '0KB',
        modified: 'Never',
        messageCount: 0,
        todoCount: 0,
        fileCount: 0
      }
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8')
      const data = JSON.parse(content) as BranchContext
      
      // Use metadata.size if available, otherwise calculate from file
      let size: string
      if (data.metadata?.size !== undefined) {
        size = `${(data.metadata.size / 1024).toFixed(1)}KB`
      } else {
        const stats = await fs.stat(filePath)
        size = `${(stats.size / 1024).toFixed(1)}KB`
      }
      
      return {
        size,
        modified: data.savedAt || new Date().toISOString(),
        messageCount: data.metadata?.messageCount || 0,
        todoCount: data.metadata?.todoCount || 0,
        fileCount: data.metadata?.fileCount || 0
      }
    } catch (error) {
      console.error('Failed to get metadata:', error)
      return {
        size: 'Error',
        modified: 'Error',
        messageCount: 0,
        todoCount: 0,
        fileCount: 0
      }
    }
  }
  
  /**
   * Delete context for a branch including all backups
   * @param branch - Branch name
   */
  async deleteContext(branch: string): Promise<void> {
    const filePath = this.getBranchFile(branch)
    
    // Delete main context file
    if (existsSync(filePath)) {
      await fs.unlink(filePath).catch(() => {})
    }
    
    // Delete all backups
    try {
      const files = await fs.readdir(this.storageDir)
      const safeBranch = this.sanitizeBranchName(branch)
      const backups = files.filter(f => f.startsWith(`${safeBranch}.backup.`) && f.endsWith('.json'))
      
      for (const backup of backups) {
        await fs.unlink(path.join(this.storageDir, backup)).catch(() => {})
      }
    } catch (error) {
      console.error('Failed to delete backups:', error)
    }
  }
}
