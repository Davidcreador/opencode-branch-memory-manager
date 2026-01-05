import type { Plugin } from '@opencode-ai/plugin'
import { ContextStorage, GitOperations, ContextCollector, ConfigManager, BranchMonitor, showToast } from '../branch-memory/index.js'

export const BranchMemoryPlugin: Plugin = async ({ project, client, $, directory, worktree }) => {
  // Silent initialization - no need to notify user

  // Load configuration
  const configManager = new ConfigManager(directory)

  // Check if we're in a git repository
  const isGitRepo = await GitOperations.isGitRepo()
  if (!isGitRepo) {
    showToast(
      client,
      'Not in a git repository. Branch memory features disabled.',
      'warning'
    )
    return {}
  }

  const config = await configManager.load()
  const storage = new ContextStorage(configManager.getStorageDir(), config)
  const collector = new ContextCollector(config, client)

  // Track last auto-save time and count
  let lastAutoSave = 0
  let saveCount = 0

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
            saveCount++

            // Only show toast on first save or every 10th save to reduce noise
            if (saveCount === 1 || saveCount % 10 === 0) {
              showToast(client, `Context saved for ${currentBranch}`, 'success', undefined, 2000)
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          showToast(client, `Failed to save context: ${errorMessage}`, 'error')
        }
      }
    }
  }

  // Initialize branch monitor with callback
  const branchMonitor = new BranchMonitor(
    async (oldBranch, newBranch) => {
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
      }

      // Check for context and show consolidated message
      const branchContext = await storage.loadContext(newBranch)
      if (branchContext) {
        showToast(
          client,
          `Switched to ${newBranch}. Context available - use @branch-memory_load to restore.`,
          'info',
          'Branch Changed',
          5000
        )
      } else {
        showToast(
          client,
          `Switched to ${newBranch}. No saved context for this branch.`,
          'info',
          'Branch Changed',
          3000
        )
      }
    },
    config
  )

  // Start branch monitoring
  await branchMonitor.start()

  return {
    // Hook: Auto-load context when session is created
    'session.created': async (input: any, output: any) => {
      // Only show toast if context exists for current branch
      const currentConfig = await configManager.load()
      const branch = await GitOperations.getCurrentBranch()

      if (branch && currentConfig.contextLoading === 'auto') {
        const branchContext = await storage.loadContext(branch)
        if (branchContext) {
          showToast(
            client,
            `Context available for ${branch}. Use @branch-memory_load to restore.`,
            'info',
            undefined,
            4000
          )
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
      // Silent cleanup - no need to notify user

      // Stop branch monitoring
      branchMonitor.stop()

      // Save one last time before shutdown
      autoSave('plugin unload').catch((error) => {
        // Only show error if final save fails
        const errorMessage = error instanceof Error ? error.message : String(error)
        showToast(client, `Final save failed: ${errorMessage}`, 'error')
      })
    },
  }
}

// Export as default for OpenCode plugin loader
export default BranchMemoryPlugin
