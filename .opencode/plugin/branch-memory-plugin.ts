import type { Plugin } from '@opencode-ai/plugin'
import { ContextStorage, GitOperations, ContextCollector, ContextInjector, BranchMonitor, ConfigManager } from '../branch-memory/index.js'
import type { BranchContext } from '../branch-memory/types.js'

export const BranchMemoryPlugin: Plugin = async ({ project, directory, client }) => {
  console.log('🧠 Branch Memory Plugin initializing...')
  
  // Load configuration
  ConfigManager.setProjectPath(directory)
  const config = await ConfigManager.load()
  
  // Check if we're in a git repository
  if (!(await GitOperations.isGitRepo())) {
    console.log('⚠️  Not in a git repository, branch memory disabled')
    return {}
  }
  
  const storage = new ContextStorage(ConfigManager.getStorageDir(directory))
  const collector = new ContextCollector(config)
  const injector = new ContextInjector({ client, sessionID: '' })
  
  // Track last auto-save time to avoid too frequent saves
  let lastAutoSave = 0
  const AUTO_SAVE_THROTTLE = 5000 // 5 seconds
  
  // Auto-save function with throttling
  const autoSave = async (reason: string) => {
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
  
  // Initialize branch monitoring
  const monitor = new BranchMonitor(
    async (oldBranch, newBranch) => {
      console.log(`🔄 Branch changed: ${oldBranch || '(none)'} → ${newBranch}`)
      
      // Auto-save old branch context
      if (oldBranch) {
        await autoSave('branch change')
      }
      
      // Load new branch context
      if (newBranch) {
        const branchContext = await storage.loadContext(newBranch)
        
        if (branchContext) {
          if (config.contextLoading === 'auto') {
            await injector.injectContext(branchContext)
            console.log(`✅ Loaded context for branch '${newBranch}'`)
          } else if (config.contextLoading === 'ask') {
            const shouldLoad = await injector.askUserAboutContextLoading(branchContext)
            if (shouldLoad) {
              await injector.injectContext(branchContext)
              console.log(`✅ Loaded context for branch '${newBranch}'`)
            } else {
              console.log(`⏭️ Skipped loading context for branch '${newBranch}'`)
            }
          }
          // For 'manual' mode, user must explicitly load via tool
        } else {
          console.log(`⚠️  No saved context for branch '${newBranch}'`)
        }
      }
    },
    config
  )
  
  // Start branch monitoring
  await monitor.start()
  console.log('✓ Branch monitoring active')
  
  // Return plugin hooks
  return {
    // Auto-save on message changes
    'message.updated': async (input, output) => {
      if (config.autoSave.onMessageChange) {
        await autoSave('message update')
      }
    },
    
    // Auto-save before tool execution
    'tool.execute.before': async (input) => {
      if (config.autoSave.onToolExecute) {
        await autoSave('tool execution')
      }
    },
    
    // Load context when session is created
    'session.created': async (input, output) => {
      const branch = await GitOperations.getCurrentBranch()
      
      if (branch && config.contextLoading === 'auto') {
        const branchContext = await storage.loadContext(branch)
        
        if (branchContext) {
          await injector.injectContext(branchContext)
          console.log(`✅ Loaded context for branch '${branch}' (session start)`)
        }
      }
    },
    
    // Auto-save on session updates (periodic checkpoints)
    'session.updated': async (input, output) => {
      if (config.autoSave.enabled) {
        const now = Date.now()
        
        // Only auto-save periodically (every 60 seconds)
        if (now - lastAutoSave > 60000) {
          await autoSave('session update')
        }
      }
    },
    
    // Cleanup on plugin unload
    unload: () => {
      console.log('🧠 Branch Memory Plugin shutting down...')
      
      // Save one last time before shutdown
      autoSave('plugin unload').catch((error) => {
        console.error('Final save failed:', error)
      })
      
      // Stop branch monitoring
      monitor.stop()
      
      console.log('✓ Plugin stopped')
    }
  }
}
