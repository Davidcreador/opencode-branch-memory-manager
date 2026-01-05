import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync } from 'fs'
import type { PluginConfig } from './types.js'

/**
 * Default configuration for the branch memory plugin
 */
const DEFAULT_CONFIG: PluginConfig = {
  autoSave: {
    enabled: true,
    onMessageChange: true,
    onBranchChange: true,
    onToolExecute: true,
    throttleMs: 5000,
    periodicIntervalMs: 60000
  },
  contextLoading: 'auto',
  context: {
    defaultInclude: ['messages', 'todos', 'files'],
    maxMessages: 50,
    maxTodos: 20,
    compression: false
  },
  storage: {
    maxBackups: 5,
    retentionDays: 90
  },
  monitoring: {
    method: 'both',
    pollingInterval: 1000
  }
}

/**
 * Configuration manager for branch memory plugin
 */
export class ConfigManager {
  private configPath: string
  private projectPath: string

  /**
   * Create a new ConfigManager instance
   * @param projectPath - The root directory of the project
   */
  constructor(projectPath: string) {
    this.projectPath = projectPath
    this.configPath = path.join(projectPath, '.opencode', 'config', 'branch-memory.json')
  }

  /**
   * Load configuration from project directory, falling back to defaults
   * @returns Configuration object
   */
  async load(): Promise<PluginConfig> {
    if (existsSync(this.configPath)) {
      try {
        const content = await fs.readFile(this.configPath, 'utf8')
        const userConfig = JSON.parse(content) as Partial<PluginConfig>

        // Deep merge user config with defaults
        return this.deepMerge(DEFAULT_CONFIG, userConfig) as PluginConfig
      } catch (error) {
        console.warn('Failed to load config, using defaults:', error instanceof Error ? error.message : error)
        return { ...DEFAULT_CONFIG }
      }
    }
    return { ...DEFAULT_CONFIG }
  }

  /**
   * Get default configuration
   * @returns Default configuration object
   */
  getDefault(): PluginConfig {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as PluginConfig
  }

  /**
   * Get storage directory path
   * @returns Path to storage directory
   */
  getStorageDir(): string {
    return path.join(this.projectPath, '.opencode', 'branch-memory')
  }

  /**
   * Save configuration to project directory
   * @param config - Configuration object to save
   */
  async save(config: PluginConfig): Promise<void> {
    const configDir = path.dirname(this.configPath)

    try {
      await fs.mkdir(configDir, { recursive: true })
      await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), 'utf8')
    } catch (error) {
      console.error('Failed to save configuration:', error)
      throw error
    }
  }

  /**
   * Deep merge two objects
   * @param target - Target object (defaults)
   * @param source - Source object (user config)
   * @returns Merged object
   */
  private deepMerge<T>(target: T, source: Partial<T>): T {
    const result = { ...target }

    for (const key in source) {
      const sourceValue = source[key]
      const targetValue = result[key]

      if (sourceValue !== undefined) {
        if (typeof sourceValue === 'object' && sourceValue !== null && !Array.isArray(sourceValue) &&
            typeof targetValue === 'object' && targetValue !== null && !Array.isArray(targetValue)) {
          result[key] = this.deepMerge(targetValue as any, sourceValue as any) as any
        } else {
          result[key] = sourceValue as any
        }
      }
    }

    return result
  }
}
