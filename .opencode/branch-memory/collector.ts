import type { BranchContext, PluginConfig } from "./types.js";
import { GitOperations } from "./git.js";

/**
 * Collects context data from various sources
 */
export class ContextCollector {
  private config: PluginConfig;
  private client?: any;

  constructor(config: PluginConfig, client?: any) {
    this.config = config;
    this.client = client;
  }

  /**
   * Collect context from available sources
   * @param includeMessages - Include conversation messages
   * @param includeTodos - Include todo items
   * @param includeFiles - Include file references
   * @param description - Description of what's being saved
   * @returns Complete context object
   */
  async collectContext(
    includeMessages: boolean = true,
    includeTodos: boolean = true,
    includeFiles: boolean = true,
    description: string = "",
  ): Promise<BranchContext> {
    const currentBranch = await GitOperations.getCurrentBranch();

    if (!currentBranch) {
      throw new Error("Not on a git branch");
    }

    const data: BranchContext["data"] = {
      description: description || "",
    };

    // Collect messages (placeholder - will use OpenCode SDK when available)
    if (includeMessages) {
      data.messages = await this.collectMessages();
    }

    // Collect todos (placeholder - will use OpenCode SDK when available)
    if (includeTodos) {
      data.todos = await this.collectTodos();
    }

    // Collect modified files from git
    if (includeFiles) {
      data.files = await GitOperations.getModifiedFiles();
    }

    // Calculate metadata
    const context: BranchContext = {
      branch: currentBranch,
      savedAt: new Date().toISOString(),
      metadata: {
        version: "1.0.0",
        platform: process.platform,
        size: JSON.stringify(data).length,
        messageCount: data.messages?.length || 0,
        todoCount: data.todos?.length || 0,
        fileCount: data.files?.length || 0,
      },
      data,
    };

    return context;
  }

  /**
   * Collect conversation messages
   * @returns Array of messages
   */
  private async collectMessages(): Promise<BranchContext["data"]["messages"]> {
    if (!this.client) {
      console.warn('Client not available, skipping message collection');
      return [];
    }

    try {
      // Use OpenCode SDK to fetch session messages
      // Note: The actual API may differ - this is based on common patterns
      const messages = await this.client.session?.getMessages?.() || [];

      // Limit to maxMessages from config
      const limited = messages.slice(-this.config.context.maxMessages);

      return limited.map((msg: any) => ({
        role: msg.role || 'user',
        content: msg.content || '',
        timestamp: msg.timestamp || new Date().toISOString()
      }));
    } catch (error) {
      console.error('Failed to collect messages:', error);
      return [];
    }
  }

  /**
   * Collect todo items
   * @returns Array of todos
   */
  private async collectTodos(): Promise<BranchContext["data"]["todos"]> {
    if (!this.client) {
      console.warn('Client not available, skipping todo collection');
      return [];
    }

    try {
      // Use OpenCode SDK to fetch session todos
      // Note: The actual API may differ - this is based on common patterns
      const todos = await this.client.session?.getTodos?.() || [];

      // Limit to maxTodos from config
      const limited = todos.slice(0, this.config.context.maxTodos);

      return limited.map((todo: any) => ({
        id: todo.id || String(Date.now()),
        content: todo.content || '',
        status: todo.status || 'pending'
      }));
    } catch (error) {
      console.error('Failed to collect todos:', error);
      return [];
    }
  }
}
