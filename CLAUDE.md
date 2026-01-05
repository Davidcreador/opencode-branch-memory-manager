# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenCode Branch Memory Manager is an OpenCode plugin that automatically manages branch-specific context. It saves and restores conversation history, todos, and file references when switching git branches, ensuring developers never lose context.

## Common Commands

### Build
```bash
# Build local .opencode version (development)
bun run build:local

# Build npm package version
bun run build:npm
```

### Testing
```bash
# Run all tests
bun test

# Run tests with coverage
bun test:coverage
```

### Type Checking
```bash
bun run typecheck
```

### Linting
```bash
# Check for linting errors
bun run lint

# Fix linting errors
bun run lint:fix
```

### Publishing
```bash
# Clean, build, and publish to npm
npm publish --access public
```

## Architecture

### Dual Source Structure

The codebase maintains two parallel implementations:

1. **`.opencode/`**: Development version used for local testing
2. **`src/`**: Source code for npm package distribution

Both directories contain identical code structure. Changes should be made in `.opencode/` first for testing, then synced to `src/` for publishing.

### Core Modules (`.opencode/branch-memory/`)

- **`types.ts`**: TypeScript interfaces for BranchContext, PluginConfig, Message, Todo
- **`storage.ts`**: ContextStorage class handles file I/O with atomic writes, backups, and corruption recovery
- **`git.ts`**: GitOperations class for git operations (current branch, modified files, repo detection)
- **`collector.ts`**: ContextCollector gathers context from messages, todos, and git status
- **`injector.ts`**: ContextInjector restores context into OpenCode sessions
- **`monitor.ts`**: BranchMonitor detects git branch changes using file watchers or polling
- **`config.ts`**: ConfigManager handles loading/saving configuration with defaults
- **`index.ts`**: Barrel export for all modules

### Entry Points

- **`.opencode/plugin/branch-memory-plugin.ts`**: Plugin hooks for auto-save/auto-load behavior
  - `session.created`: Auto-load context when session starts
  - `tool.execute.before`: Auto-save before tool execution
  - `session.updated`: Periodic checkpointing
  - `unload`: Cleanup and final save

- **`.opencode/tool/branch-memory.ts`**: User-facing tools (@branch-memory_save, @branch-memory_load, etc.)

### Data Flow

1. **Save Flow**: ContextCollector → BranchContext → ContextStorage → JSON file
2. **Load Flow**: ContextStorage → BranchContext → ContextInjector → Session
3. **Auto-save**: Plugin hooks → ContextCollector → ContextStorage (with throttling)
4. **Branch monitoring**: BranchMonitor (polling interval) → Detect change → Auto-save old → Notify new

### Storage Format

Context files stored in `.opencode/branch-memory/{branch-name}.json`:
```typescript
{
  branch: string
  savedAt: string (ISO timestamp)
  metadata: {
    version: "1.0.0"
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
    description?: string
  }
}
```

Backup files: `{branch-name}.backup.{timestamp}.json` (keeps last 5)

### Configuration

Configuration file: `.opencode/config/branch-memory.json`

Key settings:
- `autoSave`: Control auto-save triggers (onMessageChange, onBranchChange, onToolExecute)
- `contextLoading`: "auto" | "ask" | "manual" - how to handle context loading
- `context.defaultInclude`: Which data types to save by default
- `monitoring.method`: "watcher" | "polling" | "both" - branch change detection

### Build Process

- **`build:local`**: Bundles `.opencode/tool/branch-memory.ts` → `.opencode/dist/branch-memory.js`
- **`build:npm`**: Builds `src/index.ts` → `dist/` for npm distribution
- The `.opencode/` directory is included in npm package via `files` array in package.json

### Key Implementation Details

1. **Atomic Writes**: Storage uses temp files + rename for atomic operations
2. **Backup System**: Automatic backups before overwrites, keeps last 5, with corruption recovery
3. **Throttling**: Auto-save throttled to 5 seconds minimum between saves
4. **Branch Name Sanitization**: Removes invalid filename characters for cross-platform compatibility
5. **Concurrent Save Protection**: Uses unique temp filenames with timestamp + random suffix

### Testing Strategy

The plugin is designed to work with OpenCode's plugin API. Test by:
1. Building with `bun run build:local`
2. Running `opencode` in a git repository
3. Using `@branch-memory_*` tools to verify functionality

### Package Distribution

- Package name: `opencode-branch-memory-manager` (unscoped)
- Includes both `.opencode/` and `dist/` directories
- Users install via `bunx install opencode-branch-memory-manager`
- Automatically loaded when plugin is added to `opencode.json`
