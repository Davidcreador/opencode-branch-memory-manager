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
    if (!this.context || !this.hasContextData(branchContext)) {
      return;
    }

    const summary = this.formatContextSummary(branchContext);

    try {
      // Inject context as a system message that doesn't trigger response
      // Using the OpenCode SDK client to add context to the session
      const client = (this.context as any).client;

      if (client?.session?.addMessage) {
        await client.session.addMessage({
          role: 'system',
          content: summary,
          silent: true  // Don't trigger AI response
        });
        console.log('✅ Context injected for branch:', branchContext.branch);
      } else if (client?.session?.prompt) {
        // Fallback: use prompt with noReply flag
        await client.session.prompt(summary, { noReply: true });
        console.log('✅ Context injected for branch:', branchContext.branch);
      } else {
        // Fallback to console output if SDK methods not available
        console.log('\n📥 Context Summary (SDK not available):');
        console.log('─'.repeat(50));
        console.log(summary);
        console.log('─'.repeat(50));
      }
    } catch (error) {
      console.error('Failed to inject context:', error);
      // Fall back to console output
      console.log('\n📥 Context Summary (injection failed):');
      console.log('─'.repeat(50));
      console.log(summary);
      console.log('─'.repeat(50));
    }
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
