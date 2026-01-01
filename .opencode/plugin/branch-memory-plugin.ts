import type { Plugin } from '@opencode-ai/plugin'
import { ContextStorage, GitOperations, ContextCollector, ConfigManager } from '../branch-memory/index.js'

export const BranchMemoryPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  console.log('🧠 Branch Memory Plugin initializing...')

  // Load configuration
  ConfigManager.setProjectPath(directory)

  // Check if we're in a git repository
  const isGitRepo = await GitOperations.isGitRepo()
  if (!isGitRepo) {
    console.log('⚠️  Not in a git repository, branch memory disabled')
    return {}
  }

  const storage = new ContextStorage(ConfigManager.getStorageDir(directory))
  const collector = new ContextCollector(await ConfigManager.load())

  // Track last auto-save time to avoid too frequent saves
  let lastAutoSave = 0
  const AUTO_SAVE_THROTTLE = 5000 // 5 seconds

  // Auto-save function with throttling
  const autoSave = async (reason: string) => {
    const config = await ConfigManager.load()
    if (config.autoSave.enabled) {
      const now = Date.now()

      if (now - lastAutoSave > AUTO_SAVE_THROTTLE) {
        try {
          const currentBranch = await GitOperations.getCurrentBranch()

          if (currentBranch) {
            const context = await collector.collectContext(
              config.context.defaultInclude.includes('messages'),
              config.context.defaultInclude.includes('todos'),
              config.context.defaultInclude.includes('files'),
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

  // Track current branch for monitoring
  let currentBranch: string | null = null

  // Monitor git branch changes
  const monitorBranch = async () => {
    try {
      const newBranch = await GitOperations.getCurrentBranch()

      if (newBranch && newBranch !== currentBranch) {
        const oldBranchName = currentBranch
        currentBranch = newBranch
        const config = await ConfigManager.load()

        console.log(`🔄 Branch changed: ${oldBranchName || '(none)'} → ${newBranch}`)

        // Auto-save old branch context
        if (oldBranchName && config.autoSave.onBranchChange) {
          await storage.saveContext(oldBranchName, await collector.collectContext(
            config.context.defaultInclude.includes('messages'),
            config.context.defaultInclude.includes('todos'),
            config.context.defaultInclude.includes('files'),
            'branch change'
          ))
          console.log(`💾 Saved context for old branch '${oldBranchName}'`)
        }

        // Auto-load new branch context
        if (config.contextLoading === 'auto') {
          const branchContext = await storage.loadContext(newBranch)
          if (branchContext) {
            console.log(`📥 Found context for branch '${newBranch}'`)
            console.log('   Use @branch-memory_load to restore it')
          } else {
            console.log(`ℹ️  No saved context for branch '${newBranch}'`)
          }
        } else if (config.contextLoading === 'ask') {
          console.log(`ℹ️  Context available for branch '${newBranch}'`)
          console.log(`   Use @branch-memory_load to restore it`)
        }
      }
    } catch (error) {
      console.error('Error monitoring branch:', error)
    }
  }

  // Start branch monitoring interval
  const branchMonitorInterval = setInterval(monitorBranch, 2000)

  return {
    // Hook: Auto-load context when session is created
    'session.created': async (input: any, output: any) => {
      console.log('🚀 Session created - checking for saved context...')
      const config = await ConfigManager.load()
      const branch = await GitOperations.getCurrentBranch()

      if (branch && config.contextLoading === 'auto') {
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
      const config = await ConfigManager.load()
      if (config.autoSave.enabled) {
        const now = Date.now()
        // Only auto-save periodically (every 60 seconds)
        if (now - lastAutoSave > 60000) {
          await autoSave('session update')
        }
      }
    },

    // Hook: Cleanup on plugin unload
    unload: () => {
      console.log('🧠 Branch Memory Plugin shutting down...')

      // Clear the branch monitor interval
      clearInterval(branchMonitorInterval)

      // Save one last time before shutdown
      autoSave('plugin unload').catch((error) => {
        console.error('Final save failed:', error)
      })

      console.log('✅ Plugin stopped')
    },
  }
}
