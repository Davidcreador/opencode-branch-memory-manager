import type { Plugin } from '@opencode-ai/plugin'
import { ContextStorage, GitOperations, ContextCollector, ConfigManager, BranchMonitor } from '../branch-memory/index.js'

export const BranchMemoryPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  console.log('🧠 Branch Memory Plugin initializing...')

  // Load configuration
  const configManager = new ConfigManager(directory)

  // Check if we're in a git repository
  const isGitRepo = await GitOperations.isGitRepo()
  if (!isGitRepo) {
    console.log('⚠️  Not in a git repository, branch memory disabled')
    return {}
  }

  const config = await configManager.load()
  const storage = new ContextStorage(configManager.getStorageDir(), config)
  const collector = new ContextCollector(config, client)

  // Track last auto-save time to avoid too frequent saves
  let lastAutoSave = 0

  // Auto-save function with throttling
  const autoSave = async (reason: string) => {
    const currentConfig = await configManager.load()
    if (currentConfig.autoSave.enabled) {
      const now = Date.now()

      if (now - lastAutoSave > currentConfig.autoSave.throttleMs) {
        try {
          const currentBranch = await GitOperations.getCurrentBranch()

          if (currentBranch) {
            const context = await collector.collectContext(
              currentConfig.context.defaultInclude.includes('messages'),
              currentConfig.context.defaultInclude.includes('todos'),
              currentConfig.context.defaultInclude.includes('files'),
              reason
            )

            await storage.saveContext(currentBranch, context)
            lastAutoSave = now
            console.log(`💾 Auto-saved context for branch '${currentBranch}' (${reason})`)
          }
        } catch (error) {
          console.error('Auto-save failed:', error)
        }
      }
    }
  }

  // Initialize branch monitor with callback
  const branchMonitor = new BranchMonitor(
    async (oldBranch, newBranch) => {
      console.log(`🔄 Branch changed: ${oldBranch || '(none)'} → ${newBranch}`)

      const currentConfig = await configManager.load()

      // Auto-save old branch context
      if (oldBranch && currentConfig.autoSave.onBranchChange) {
        const context = await collector.collectContext(
          currentConfig.context.defaultInclude.includes('messages'),
          currentConfig.context.defaultInclude.includes('todos'),
          currentConfig.context.defaultInclude.includes('files'),
          'branch change'
        )
        await storage.saveContext(oldBranch, context)
        console.log(`💾 Saved context for old branch '${oldBranch}'`)
      }

      // Auto-load new branch context
      if (currentConfig.contextLoading === 'auto') {
        const branchContext = await storage.loadContext(newBranch)
        if (branchContext) {
          console.log(`📥 Found context for branch '${newBranch}'`)
          console.log('   Use @branch-memory_load to restore it')
        } else {
          console.log(`ℹ️  No saved context for branch '${newBranch}'`)
        }
      } else if (currentConfig.contextLoading === 'ask') {
        console.log(`ℹ️  Context available for branch '${newBranch}'`)
        console.log(`   Use @branch-memory_load to restore it`)
      }
    },
    config
  )

  // Start branch monitoring
  await branchMonitor.start()

  return {
    // Hook: Auto-load context when session is created
    'session.created': async (input: any, output: any) => {
      console.log('🚀 Session created - checking for saved context...')
      const currentConfig = await configManager.load()
      const branch = await GitOperations.getCurrentBranch()

      if (branch && currentConfig.contextLoading === 'auto') {
        const branchContext = await storage.loadContext(branch)
        if (branchContext) {
          console.log(`📥 Found context for branch '${branch}'`)
          console.log('   Use @branch-memory_load to restore it')
        }
      }
    },

    // Hook: Auto-save before tool execution
    'tool.execute.before': async (input: any, output: any) => {
      await autoSave('tool execution')
    },

    // Hook: Auto-save when session is updated (periodic checkpoints)
    'session.updated': async (input: any, output: any) => {
      const currentConfig = await configManager.load()
      if (currentConfig.autoSave.enabled) {
        const now = Date.now()
        // Only auto-save periodically
        if (now - lastAutoSave > currentConfig.autoSave.periodicIntervalMs) {
          await autoSave('session update')
        }
      }
    },

    // Hook: Cleanup on plugin unload
    unload: () => {
      console.log('🧠 Branch Memory Plugin shutting down...')

      // Stop branch monitoring
      branchMonitor.stop()

      // Save one last time before shutdown
      autoSave('plugin unload').catch((error) => {
        console.error('Final save failed:', error)
      })

      console.log('✅ Plugin stopped')
    },
  }
}

// Export as default for OpenCode plugin loader
export default BranchMemoryPlugin
