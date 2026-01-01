import { tool, type Plugin } from "@opencode-ai/plugin"
import { ContextStorage, GitOperations, ContextCollector, ConfigManager } from "./branch-memory/index.js"
import type { PluginInput, ToolContext } from "@opencode-ai/plugin"

// Import tools from the tool file
import { save as saveTool, load as loadTool, status as statusTool, list as listTool, deleteContext as deleteContextTool } from "./tool/branch-memory.js"

export const BranchMemoryPlugin: Plugin = async (ctx: PluginInput) => {
  console.log('🧠 Branch Memory Plugin initializing...')

  ConfigManager.setProjectPath(ctx.directory)

  const isGitRepo = await GitOperations.isGitRepo()
  if (!isGitRepo) {
    console.log('⚠️  Not in a git repository, branch memory disabled')
    return {}
  }

  const storage = new ContextStorage(ConfigManager.getStorageDir(ctx.directory))
  const collector = new ContextCollector(await ConfigManager.load())

  let lastAutoSave = 0
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
            console.log(`💾 Auto-saved context for branch '${currentBranch}' (${reason})`)
          }
        } catch (error) {
          console.error('Auto-save failed:', error)
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

        console.log(`🔄 Branch changed: ${oldBranchName || '(none)'} → ${newBranch}`)

        if (oldBranchName && config.autoSave.onBranchChange) {
          await storage.saveContext(oldBranchName, await collector.collectContext(
            config.context.defaultInclude.includes('messages'),
            config.context.defaultInclude.includes('todos'),
            config.context.defaultInclude.includes('files'),
            'branch change'
          ))
          console.log(`💾 Saved context for old branch '${oldBranchName}'`)
        }

        if (config.contextLoading === 'auto') {
          const branchContext = await storage.loadContext(newBranch)
          if (branchContext) {
            console.log(`📥 Found context for branch '${newBranch}'`)
            console.log(`   Use @branch-memory_save to restore it`)
          } else {
            console.log(`ℹ️  No saved context for branch '${newBranch}'`)
          }
        } else if (config.contextLoading === 'ask') {
          console.log(`ℹ️  Context available for branch '${newBranch}'`)
          console.log(`   Use @branch-memory_save to restore it`)
        }
      }
    } catch (error) {
      console.error('Error monitoring branch:', error)
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
      console.log('🚀 Session created - checking for saved context...')
      const config = await ConfigManager.load()
      const branch = await GitOperations.getCurrentBranch()

      if (branch && config.contextLoading === 'auto') {
        const branchContext = await storage.loadContext(branch)
        if (branchContext) {
          console.log(`📥 Found context for branch '${branch}'`)
          console.log(`   Use @branch-memory_save to restore it`)
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
      console.log('🧠 Branch Memory Plugin shutting down...')
      clearInterval(branchMonitorInterval)
      autoSave('plugin unload').catch((error) => {
        console.error('Final save failed:', error)
      })
      console.log('✅ Plugin stopped')
    },
  }
}

export default BranchMemoryPlugin

