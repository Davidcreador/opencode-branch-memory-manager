/**
 * Branch context data structure
 */
export interface BranchContext {
  branch: string
  savedAt: string
  metadata: {
    version: string
    platform: string
    size: number
    messageCount: number
    todoCount: number
    fileCount: number
  }
  data: {
    messages?: Message[]
    todos?: Todo[]
    files?: string[]
    summary?: string
    description?: string
    [key: string]: unknown  // Allow additional dynamic properties
  }
}

/**
 * Message data structure
 */
export interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

/**
 * Todo item data structure
 */
export interface Todo {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
}

/**
 * Plugin configuration
 */
export interface PluginConfig {
  autoSave: {
    enabled: boolean
    onMessageChange: boolean
    onBranchChange: boolean
    onToolExecute: boolean
  }
  contextLoading: 'auto' | 'ask' | 'manual'
  context: {
    defaultInclude: ('messages' | 'todos' | 'files')[]
    maxMessages: number
    maxTodos: number
    compression: boolean
  }
  storage: {
    maxBackups: number
    retentionDays: number
  }
  monitoring: {
    method: 'watcher' | 'polling' | 'both'
    pollingInterval: number
  }
}
