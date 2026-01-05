import { spawn } from 'child_process'

/**
 * Git operations for branch memory manager
 */
export class GitOperations {
  private static async runGitCommand(...args: string[]): Promise<{
    stdout: string
    stderr: string
    exitCode: number
  }> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      let stdout = ''
      let stderr = ''
      
      git.stdout.on('data', (data) => {
        stdout += data.toString()
      })
      
      git.stderr.on('data', (data) => {
        stderr += data.toString()
      })
      
      git.on('close', (code) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0
        })
      })
      
      git.on('error', (err) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: 1
        })
      })
    })
  }

  static async getCurrentBranch(): Promise<string | null> {
    const result = await this.runGitCommand('symbolic-ref', '--short', 'HEAD')
    
    if (result.exitCode !== 0 || result.stderr.length > 0) {
      return null
    }
    
    const branch = result.stdout
    
    if (branch === 'HEAD' || branch === '') {
      return null
    }
    
    return branch
  }

  static async getGitDir(): Promise<string | null> {
    const result = await this.runGitCommand('rev-parse', '--git-dir')
    
    if (result.exitCode !== 0 || result.stderr.length > 0) {
      return null
    }
    
    return result.stdout
  }

  static async isGitRepo(): Promise<boolean> {
    const gitDir = await this.getGitDir()
    return gitDir !== null
  }

  static async isBareRepo(): Promise<boolean> {
    const result = await this.runGitCommand('rev-parse', '--is-bare-repository')
    return result.stdout === 'true' && result.exitCode === 0
  }

  static async getModifiedFiles(): Promise<string[]> {
    const result = await this.runGitCommand('diff', '--name-only')
    
    if (result.exitCode !== 0) {
      return []
    }
    
    if (result.stdout.length === 0) {
      return []
    }
    
    return result.stdout.split('\n').filter(f => f.length > 0)
  }

  static async getAllBranches(): Promise<string[]> {
    const result = await this.runGitCommand('branch', '--format=%(refname:short)')
    
    if (result.exitCode !== 0) {
      return []
    }
    
    if (result.stdout.length === 0) {
      return []
    }
    
    return result.stdout.split('\n').filter(f => f.length > 0)
  }

  static sanitizeBranchName(branch: string): string {
    return branch
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '-')
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
      .replace(/[\uE000-\uF8FF\uFFF0-\uFFFF]/g, '')
      .substring(0, 255)
      .trim()
  }

  static async getCurrentCommit(): Promise<string | null> {
    const result = await this.runGitCommand('rev-parse', 'HEAD')
    
    if (result.exitCode !== 0 || result.stderr.length > 0) {
      return null
    }
    
    return result.stdout
  }

  static async isGitAvailable(): Promise<boolean> {
    const result = await this.runGitCommand('--version')
    return result.exitCode === 0
  }

  static async getRemoteUrl(): Promise<string | null> {
    const branch = await this.getCurrentBranch()
    if (!branch) {
      return null
    }
    
    const remoteResult = await this.runGitCommand('config', `branch.${branch}.remote`)
    if (remoteResult.exitCode !== 0) {
      return null
    }
    
    const remote = remoteResult.stdout
    if (remote.length === 0) {
      return null
    }
    
    const urlResult = await this.runGitCommand('remote', 'get-url', remote)
    if (urlResult.exitCode !== 0) {
      return null
    }
    
    return urlResult.stdout
  }

  static async hasUncommittedChanges(): Promise<boolean> {
    const result = await this.runGitCommand('status', '--porcelain')
    
    if (result.exitCode !== 0) {
      return false
    }
    
    return result.stdout.length > 0
  }
}
