import { tool, type ToolDefinition } from "@opencode-ai/plugin";
import {
  ContextStorage,
  GitOperations,
  ContextCollector,
  ConfigManager,
  ContextInjector,
} from "../branch-memory/index.js";
import type { ToolContext } from "@opencode-ai/plugin";
import type { PluginConfig } from "../branch-memory/types.js";

/**
 * Shared initialization helper for all tools
 * Reduces code duplication across tool implementations
 */
async function initializeContext(): Promise<{
  configManager: ConfigManager;
  config: PluginConfig;
  storage: ContextStorage;
}> {
  const configManager = new ConfigManager(process.cwd());
  const config = await configManager.load();
  const storage = new ContextStorage(configManager.getStorageDir(), config);
  return { configManager, config, storage };
}

/**
 * Save current session context for current git branch with optional filters
 */
export const save: ToolDefinition = tool({
  description:
    "Save current session context for current git branch with optional filters",
  args: {
    includeMessages: tool.schema
      .boolean()
      .optional()
      .describe("Include conversation messages"),
    includeTodos: tool.schema
      .boolean()
      .optional()
      .describe("Include todo items"),
    includeFiles: tool.schema
      .boolean()
      .optional()
      .describe("Include file references"),
    description: tool.schema
      .string()
      .optional()
      .describe("Description of what you are saving"),
  },
  async execute(args, context: ToolContext) {
    try {
      const { config, storage } = await initializeContext();

      const currentBranch = await GitOperations.getCurrentBranch();

      if (!currentBranch) {
        return "⚠️  Not on a git branch, context not saved";
      }

      const collector = new ContextCollector(config);
      const branchContext = await collector.collectContext(
        args.includeMessages ??
          config.context.defaultInclude.includes("messages"),
        args.includeTodos ?? config.context.defaultInclude.includes("todos"),
        args.includeFiles ?? config.context.defaultInclude.includes("files"),
        args.description || "",
      );

      await storage.saveContext(currentBranch, branchContext);

      return `✅ Saved context for branch '${currentBranch}'
  ├─ Messages: ${branchContext.metadata.messageCount}
  ├─ Todos: ${branchContext.metadata.todoCount}
  ├─ Files: ${branchContext.metadata.fileCount}
  └─ Size: ${(branchContext.metadata.size / 1024).toFixed(1)}KB`;
    } catch (error) {
      console.error("Error saving context:", error);
      return `❌ Failed to save context: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

/**
 * Load branch-specific context into current session
 */
export const load: ToolDefinition = tool({
  description: "Load branch-specific context into current session",
  args: {
    branch: tool.schema
      .string()
      .optional()
      .describe("Branch name (default: current branch)"),
  },
  async execute(args, context: ToolContext) {
    try {
      const { storage } = await initializeContext();

      const git = GitOperations;
      const targetBranch = args.branch || (await git.getCurrentBranch());

      if (!targetBranch) {
        return "⚠️  Not on a git branch";
      }

      const branchContext = await storage.loadContext(targetBranch);

      if (!branchContext) {
        return `⚠️  No context found for branch '${targetBranch}'`;
      }

      const injector = new ContextInjector(context);
      await injector.injectContext(branchContext);

      return `✅ Loaded context for branch '${targetBranch}'
  ├─ Saved: ${branchContext.savedAt.substring(0, 10)}...
  ├─ Messages: ${branchContext.metadata.messageCount}
  ├─ Todos: ${branchContext.metadata.todoCount}
  └─ Files: ${branchContext.metadata.fileCount}`;
    } catch (error) {
      console.error("Error loading context:", error);
      return `❌ Failed to load context: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

/**
 * Show branch memory status and available contexts
 */
export const status: ToolDefinition = tool({
  description: "Show branch memory status and available contexts",
  args: {},
  async execute(args, context: ToolContext) {
    try {
      const { storage } = await initializeContext();

      const git = GitOperations;
      const currentBranch = await git.getCurrentBranch();
      const branches = await storage.listBranches();

      let output = "\n📊 Branch Memory Status";
      output += "\n═════════════════════\n";

      if (currentBranch) {
        output += `Current branch: ${currentBranch}\n\n`;

        const branchContext = await storage.loadContext(currentBranch);
        if (branchContext) {
          output += `Current context:\n`;
          output += `  📝 Messages: ${branchContext.metadata.messageCount}\n`;
          output += `  ✅ Todos: ${branchContext.metadata.todoCount}\n`;
          output += `  📁 Files: ${branchContext.metadata.fileCount}\n`;
          output += `  💾 Size: ${(branchContext.metadata.size / 1024).toFixed(1)}KB\n`;
          output += `  ⏰ Saved: ${branchContext.savedAt}\n`;
          if (branchContext.data.description) {
            output += `  📄 Description: ${branchContext.data.description}\n`;
          }
        } else {
          output += `Current branch has no saved context\n`;
        }
      } else {
        output += `Not in a git repository\n`;
      }

      if (branches.length > 0) {
        output += "\nAvailable contexts:\n";
        for (const branch of branches) {
          const meta = await storage.getMetadata(branch);
          const marker = branch === currentBranch ? "→ " : "  ";
          output += `${marker}${branch} (${meta.size}, ${meta.modified.substring(0, 10)}...)\n`;
        }
      } else {
        output += "\nNo saved contexts found\n";
      }

      output += "═════════════════════\n";

      return output;
    } catch (error) {
      console.error("Error getting status:", error);
      return `❌ Failed to get status: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

/**
 * Delete saved context for a branch
 */
export const deleteContext: ToolDefinition = tool({
  description: "Delete saved context for a branch",
  args: {
    branch: tool.schema.string().describe("Branch name to delete context for"),
  },
  async execute(args, context: ToolContext) {
    try {
      const { storage } = await initializeContext();

      await storage.deleteContext(args.branch);

      return `✅ Deleted context for branch '${args.branch}'`;
    } catch (error) {
      console.error("Error deleting context:", error);
      return `❌ Failed to delete context: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});

/**
 * List all branches with saved contexts
 */
export const list: ToolDefinition = tool({
  description: "List all branches with saved contexts",
  args: {
    verbose: tool.schema
      .boolean()
      .optional()
      .describe("Show detailed information"),
  },
  async execute(args, context: ToolContext) {
    try {
      const { storage } = await initializeContext();

      const branches = await storage.listBranches();

      if (branches.length === 0) {
        return "No saved contexts found";
      }

      let output = "\n📋 Branches with saved contexts\n";
      output += "═════════════════════\n";

      for (const branch of branches) {
        const meta = await storage.getMetadata(branch);
        output += `\n${branch}\n`;
        output += `  💾 Size: ${meta.size}\n`;
        output += `  ⏰ Modified: ${meta.modified}\n`;

        if (args.verbose) {
          output += `  📝 Messages: ${meta.messageCount}\n`;
          output += `  ✅ Todos: ${meta.todoCount}\n`;
          output += `  📁 Files: ${meta.fileCount}\n`;
        }
      }

      output += "\n═════════════════════\n";
      output += `\nTotal: ${branches.length} branch(es)\n`;

      return output;
    } catch (error) {
      console.error("Error listing contexts:", error);
      return `❌ Failed to list contexts: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  },
});
