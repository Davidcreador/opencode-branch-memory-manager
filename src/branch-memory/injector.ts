import type { ToolContext } from '@opencode-ai/plugin'
import type { BranchContext } from './types.js'

/**
 * Injects context into OpenCode sessions
 */
export class ContextInjector {
  private context: ToolContext
  
  constructor(context: ToolContext) {
    this.context = context
  }
  
  /**
   * Inject context into current session without triggering AI response
   * @param branchContext - Branch context to inject
   */
  async injectContext(branchContext: BranchContext): Promise<void> {
    const summary = this.formatContextSummary(branchContext)
    
    // Inject context without triggering AI response
    // This would use the OpenCode SDK client.session.prompt() with noReply: true
    // For now, log the injection
    console.log('\n📥 Context injected for branch:', branchContext.branch)
    console.log('─'.repeat(50))
    console.log(summary)
    console.log('─'.repeat(50))
  }
  
  /**
   * Ask user if they want to load context (interactive mode)
   * @param branchContext - Branch context to load
   * @returns User's decision
   */
  async askUserAboutContextLoading(
    branchContext: BranchContext
  ): Promise<boolean> {
    const summary = this.formatContextSummary(branchContext)
    
    console.log('\n📥 Context available for branch:', branchContext.branch)
    console.log('─'.repeat(50))
    console.log(summary)
    console.log('─'.repeat(50))
    console.log('Load this context? (y/n)')
    
    // For now, auto-return true (would use TUI API in production)
    // In real implementation, this would use OpenCode TUI to prompt user
    return true
  }
  
  /**
   * Format context as human-readable summary
   * @param context - Branch context to format
   * @returns Formatted summary string
   */
  private formatContextSummary(context: BranchContext): string {
    const lines = [
      `# Branch Context Loaded: ${context.branch}`,
      `Restored from: ${context.savedAt}`,
      ''
    ]
    
    if (context.data.description) {
      lines.push('## Description')
      lines.push(context.data.description)
      lines.push('')
    }
    
    if (context.data.messages && context.data.messages.length > 0) {
      lines.push(`## Recent Messages (${context.data.messages.length})`)
      lines.push('... [Conversation history loaded] ...')
      lines.push('')
    }
    
    if (context.data.todos && context.data.todos.length > 0) {
      lines.push(`## Todo Items (${context.data.todos.length})`)
      for (const todo of context.data.todos) {
        const checkbox = todo.status === 'completed' ? 'x' : ' '
        lines.push(`- [${checkbox}] ${todo.content}`)
      }
      lines.push('')
    }
    
    if (context.data.files && context.data.files.length > 0) {
      lines.push(`## Modified Files (${context.data.files.length})`)
      for (const file of context.data.files) {
        lines.push(`- ${file}`)
      }
      lines.push('')
    }
    
    return lines.join('\n')
  }
  
  /**
   * Check if there is context data to inject
   * @param context - Branch context to check
   * @returns True if context has data
   */
  hasContextData(context: BranchContext): boolean {
    return !!(
      context.data.description ||
      (context.data.messages && context.data.messages.length > 0) ||
      (context.data.todos && context.data.todos.length > 0) ||
      (context.data.files && context.data.files.length > 0)
    )
  }
}
