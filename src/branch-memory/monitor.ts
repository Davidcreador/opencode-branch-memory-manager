import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import type { PluginConfig } from "./types.js";
import { GitOperations } from "./git.js";

/**
 * Monitors git branch changes
 */
export class BranchMonitor {
  private watcher?: FSWatcher;
  private pollingInterval?: NodeJS.Timeout;
  private currentBranch?: string;
  private lastPoll?: number;
  private changeCallbacks: Array<
    (oldBranch: string | undefined, newBranch: string) => void
  > = [];
  private isMonitoring = false;

  constructor(
    private onBranchChange: (
      oldBranch: string | undefined,
      newBranch: string,
    ) => void,
    private config: PluginConfig,
  ) {
    // Register the constructor callback
    this.changeCallbacks.push(this.onBranchChange);
  }

  /**
   * Start monitoring git branch changes
   */
  async start(): Promise<void> {
    if (this.isMonitoring) {
      return;
    }

    const gitDir = await GitOperations.getGitDir();

    if (!gitDir) {
      // Silent - not in a git repository
      return;
    }

    // Get current branch
    const branch = await GitOperations.getCurrentBranch();
    this.currentBranch = branch || undefined;

    if (!this.currentBranch) {
      // Silent - not on a git branch
      return;
    }

    // Start watcher
    if (
      this.config.monitoring.method === "watcher" ||
      this.config.monitoring.method === "both"
    ) {
      this.startWatcher(gitDir);
    }

    // Start polling as fallback
    if (
      this.config.monitoring.method === "polling" ||
      this.config.monitoring.method === "both"
    ) {
      this.startPolling();
    }

    this.isMonitoring = true;
    // Silent startup - monitoring active
  }

  /**
   * Start file watcher on .git/HEAD
   * @param gitDir - Path to .git directory
   */
  private startWatcher(gitDir: string): void {
    try {
      const headFile = `${gitDir}/HEAD`;

      this.watcher = chokidar.watch(headFile, {
        ignoreInitial: true,
        persistent: true,
        awaitWriteFinish: { stabilityThreshold: 100 },
        usePolling: false, // Use native file system events
      });

      this.watcher.on("change", async () => {
        // Debounce file changes (rapid changes within 100ms)
        await this.checkBranchChange();
      });

      this.watcher.on("error", (error: unknown) => {
        // Silent error handling - fall back to polling if watcher fails
        if (this.config.monitoring.method === "watcher") {
          this.stopWatcher();
          this.startPolling();
        }
      });

      // Silent - watcher started successfully
    } catch (error) {
      // Silent - watcher failed to start
    }
  }

  /**
   * Start polling for branch changes
   */
  private startPolling(): void {
    const interval = this.config.monitoring.pollingInterval || 1000;

    this.pollingInterval = setInterval(async () => {
      await this.checkBranchChange();
    }, interval);

    // Silent - polling started
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.stopWatcher();
    this.stopPolling();
    this.isMonitoring = false;
    // Silent - monitoring stopped
  }

  /**
   * Stop file watcher
   */
  private stopWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
    }
  }

  /**
   * Stop polling
   */
  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  /**
   * Check for branch change
   */
  private async checkBranchChange(): Promise<void> {
    try {
      const newBranch = await GitOperations.getCurrentBranch();

      if (newBranch && newBranch !== this.currentBranch) {
        const oldBranch = this.currentBranch;
        this.currentBranch = newBranch;

        // Silent - branch change detected, notify callbacks
        // Call all registered callbacks
        for (const callback of this.changeCallbacks) {
          try {
            await callback(oldBranch, newBranch);
          } catch (error) {
            // Silent - callback error (plugin handles notifications)
          }
        }
      }
    } catch (error) {
      // Silent - error checking branch
    }
  }

  /**
   * Register a callback for branch changes
   * @param callback - Function to call on branch change
   */
  onChange(
    callback: (oldBranch: string | undefined, newBranch: string) => void,
  ): void {
    this.changeCallbacks.push(callback);
  }

  /**
   * Unregister a callback
   * @param callback - Function to remove
   */
  offChange(
    callback: (oldBranch: string | undefined, newBranch: string) => void,
  ): void {
    const index = this.changeCallbacks.indexOf(callback);
    if (index > -1) {
      this.changeCallbacks.splice(index, 1);
    }
  }

  /**
   * Get current monitored branch
   * @returns Current branch name or undefined
   */
  getCurrentBranch(): string | undefined {
    return this.currentBranch;
  }

  /**
   * Check if monitoring is active
   * @returns True if monitoring
   */
  isActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Test helper: Manually trigger branch change check
   * @internal For testing purposes only
   */
  async _testTriggerCheck(): Promise<void> {
    await this.checkBranchChange();
  }
}
