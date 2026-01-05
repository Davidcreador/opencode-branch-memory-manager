export { ContextStorage } from "./storage.js";
export { GitOperations } from "./git.js";
export { ContextCollector } from "./collector.js";
export { ContextInjector } from "./injector.js";
export { BranchMonitor } from "./monitor.js";
export { ConfigManager } from "./config.js";
export type { BranchContext, PluginConfig, Message, Todo } from "./types.js";

/**
 * Show a toast notification in the OpenCode UI
 * Falls back to console.log if toast API is unavailable
 */
export function showToast(
  client: any,
  message: string,
  variant: "info" | "success" | "warning" | "error" = "info",
  title?: string,
  duration?: number
): void {
  try {
    client?.global?.tui?.showToast?.({
      title: title || "Branch Memory",
      message,
      variant,
      duration: duration || (variant === "error" ? undefined : 3000)
    });
  } catch (error) {
    // Fallback to console if toast unavailable
    console.log(`[${variant.toUpperCase()}] ${title || "Branch Memory"}: ${message}`);
  }
}
