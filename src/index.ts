import { tool, type Plugin } from "@opencode-ai/plugin"
import { ContextStorage, GitOperations, ContextCollector, ConfigManager, showToast } from "./branch-memory/index.js"
import type { PluginInput, ToolContext } from "@opencode-ai/plugin"

// Import tools from the tool file
import { save as saveTool, load as loadTool, status as statusTool, list as listTool, deleteContext as deleteContextTool } from "./tool/branch-memory.js"

export const BranchMemoryPlugin: Plugin = async (ctx: PluginInput) => {
  // Silent initialization - no need to notify user
  ConfigManager.setProjectPath(ctx.directory)

  const isGitRepo = await GitOperations.isGitRepo()
  if (!isGitRepo) {
    showToast(
      ctx.client,
      'Not in a git repository. Branch memory features disabled.',
      'warning'
    )
    return {}
  }

  const storage = new ContextStorage(ConfigManager.getStorageDir(ctx.directory))
  const collector = new ContextCollector(await ConfigManager.load())

  let lastAutoSave = 0
  let saveCount = 0
  const AUTO_SAVE_THROTTLE = 5000

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
            saveCount++

            // Only show toast on first save or every 10th save to reduce noise
            if (saveCount === 1 || saveCount % 10 === 0) {
              showToast(ctx.client, `Context saved for ${currentBranch}`, 'success', undefined, 2000)
            }
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          showToast(ctx.client, `Failed to save context: ${errorMessage}`, 'error')
        }
      }
    }
  }

  let currentBranch: string | null = null

  const monitorBranch = async () => {
    try {
      const newBranch = await GitOperations.getCurrentBranch()

      if (newBranch && newBranch !== currentBranch) {
        const oldBranchName = currentBranch
        currentBranch = newBranch
        const config = await ConfigManager.load()

        // Save old branch context if enabled
        if (oldBranchName && config.autoSave.onBranchChange) {
          await storage.saveContext(oldBranchName, await collector.collectContext(
            config.context.defaultInclude.includes('messages'),
            config.context.defaultInclude.includes('todos'),
            config.context.defaultInclude.includes('files'),
            'branch change'
          ))
        }

        // Check for context and show consolidated message
        const branchContext = await storage.loadContext(newBranch)
        if (branchContext) {
          showToast(
            ctx.client,
            `Switched to ${newBranch}. Context available - use @branch-memory_load to restore.`,
            'info',
            'Branch Changed',
            5000
          )
        } else {
          showToast(
            ctx.client,
            `Switched to ${newBranch}. No saved context for this branch.`,
            'info',
            'Branch Changed',
            3000
          )
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      showToast(ctx.client, `Error monitoring branch: ${errorMessage}`, 'error')
    }
  }

  const branchMonitorInterval = setInterval(monitorBranch, 2000)

  return {
    // Export tools via plugin hook
    tool: {
      save: saveTool,
      load: loadTool,
      status: statusTool,
      list: listTool,
      deleteContext: deleteContextTool,
    },
    'session.created': async (input: any, output: any) => {
      // Only show toast if context exists for current branch
      const config = await ConfigManager.load()
      const branch = await GitOperations.getCurrentBranch()

      if (branch && config.contextLoading === 'auto') {
        const branchContext = await storage.loadContext(branch)
        if (branchContext) {
          showToast(
            ctx.client,
            `Context available for ${branch}. Use @branch-memory_load to restore.`,
            'info',
            undefined,
            4000
          )
        }
      }
    },
    'tool.execute.before': async (input: any, output: any) => {
      await autoSave('tool execution')
    },
    'session.updated': async (input: any, output: any) => {
      const config = await ConfigManager.load()
      if (config.autoSave.enabled) {
        const now = Date.now()
        if (now - lastAutoSave > 60000) {
          await autoSave('session update')
        }
      }
    },
    unload: () => {
      // Silent cleanup - no need to notify user
      clearInterval(branchMonitorInterval)
      autoSave('plugin unload').catch((error) => {
        // Only show error if final save fails
        const errorMessage = error instanceof Error ? error.message : String(error)
        showToast(ctx.client, `Final save failed: ${errorMessage}`, 'error')
      })
    },
  }
}

export default BranchMemoryPlugin

