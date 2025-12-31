# 🧠 OpenCode Branch Memory Manager

Automatically manages branch-specific context for OpenCode so you never lose your development context when switching branches.

## ✨ Features

- 🎛️ **Manual Control**: Save/load context with fine-grained filters
- 💾 **Branch-Specific Storage**: Context saved per git branch
- 📊 **Status Dashboard**: See all your saved contexts at a glance
- 🛡️ **Error Resilient**: Automatic backups and recovery from corrupted data
- 🌐 **Cross-Platform**: Works seamlessly on macOS, Linux, and Windows
- 📋 **List & Delete**: Manage saved contexts easily
- 🎯 **Configurable**: Customize what to save and storage options

## 🚀 Quick Start

### Installation

**macOS/Linux:**
```bash
curl -fsSL https://raw.githubusercontent.com/Davidcreador/opencode-branch-memory-manager/main/install.sh | bash
```

**Windows (PowerShell):**
```powershell
irm https://raw.githubusercontent.com/Davidcreador/opencode-branch-memory-manager/main/install.ps1 | iex
```

### Getting Started

```bash
opencode

# Check status
@branch-memory_status

# Save current context with filters
@branch-memory_save --include-messages --include-todos --include-files "Working on user authentication"

# Load context for a specific branch
@branch-memory_load --branch feature/payment-api

# List all saved contexts
@branch-memory_list --verbose
```

## 📖 Commands

### @branch-memory_save

Save current session context for current git branch.

**Arguments:**
- `--include-messages`: Include conversation messages (default: true)
- `--include-todos`: Include todo items (default: true)
- `--include-files`: Include modified files (default: true)
- `--description`: Description of what you're saving

**Examples:**
```
# Save everything
@branch-memory_save "Adding Stripe integration"

# Save only messages and todos
@branch-memory_save --include-messages --include-todos "Quick checkpoint"

# Save only files
@branch-memory_save --include-files "API work"
```

### @branch-memory_load

Load branch-specific context into current session.

**Arguments:**
- `--branch`: Branch name (default: current branch)

**Examples:**
```
# Load current branch context
@branch-memory_load

# Load specific branch context
@branch-memory_load --branch feature/authentication
```

### @branch-memory_status

Show branch memory status and available contexts.

**Examples:**
```
@branch-memory_status
```

**Output:**
```
📊 Branch Memory Status
═════════════════

Current branch: feature/user-auth
Current context:
  📝 Messages: 23
  ✅ Todos: 7
  📁 Files: 5
  💾 Size: 2.3KB
  ⏰ Saved: 2025-01-01T14:30:00.000Z
  📄 Description: Adding user authentication with OAuth

Available contexts:
  → feature/user-auth (2.3KB, 2025-01-01T14:30:00)
  → feature/payment-api (4.1KB, 2025-01-01T15:45:00)
    main (1.8KB, 2025-01-01T12:00:00.000Z)
```

### @branch-memory_deleteContext

Delete saved context for a branch.

**Arguments:**
- `--branch`: Branch name to delete context for

**Example:**
```
@branch-memory_deleteContext --branch old-feature
```

### @branch-memory_list

List all branches with saved contexts.

**Arguments:**
- `--verbose`: Show detailed information including message, todo, and file counts

**Examples:**
```
@branch-memory_list

# With verbose details
@branch-memory_list --verbose
```

**Output (verbose):**
```
📋 Branches with saved contexts
═════════════════

feature/user-auth
  💾 Size: 2.3KB
  ⏰ Modified: 2025-01-01T14:30:00
  📝 Messages: 23
  ✅ Todos: 7
  📁 Files: 5

feature/payment-api
  💾 Size: 4.1KB
  ⏰ Modified: 2025-01-01T15:45:00
  📝 Messages: 31
  ✅ Todos: 12
  📁 Files: 8

main
  💾 Size: 1.8KB
  ⏰ Modified: 2025-01-01T12:00:00
  📝 Messages: 15
  ✅ Todos: 3
  📁 Files: 2

═════════════════
Total: 3 branch(es)
```

## ⚙️ Configuration

Configuration is stored in `.opencode/config/branch-memory.json`

### Default Configuration

```json
{
  "autoSave": {
    "enabled": true,
    "onMessageChange": true,
    "onBranchChange": true,
    "onToolExecute": true
  },
  "contextLoading": "auto",
  "context": {
    "defaultInclude": ["messages", "todos", "files"],
    "maxMessages": 50,
    "maxTodos": 20,
    "compression": false
  },
  "storage": {
    "maxBackups": 5,
    "retentionDays": 90
  },
  "monitoring": {
    "method": "both",
    "pollingInterval": 1000
  }
}
```

### Configuration Options

#### autoSave
- `enabled`: Enable/disable automatic saving (default: `true`)
- `onMessageChange`: Auto-save when messages change (default: `true`)
- `onBranchChange`: Auto-save when switching branches (default: `true`)
- `onToolExecute`: Auto-save before running tools (default: `true`)

#### contextLoading
- `"auto"`: Automatically load context when switching branches
- `"ask"`: Prompt user before loading context
- `"manual"`: Don't auto-load; use `@branch-memory_load` manually

#### context
- `defaultInclude`: Array of data types to include by default
- `maxMessages`: Maximum number of messages to save (default: 50)
- `maxTodos`: Maximum number of todos to save (default: 20)
- `compression`: Enable compression (not yet implemented)

#### storage
- `maxBackups`: Number of backups to keep (default: 5)
- `retentionDays`: Days to keep old contexts (default: 90)

#### monitoring
- `"watcher"`: Use file watcher only (fast, uses chokidar)
- `"polling"`: Use polling only (reliable, slower)
- `"both"`: Use watcher with polling fallback (default)

## 🔧 How It Works

1. **Initialization**: Tools load configuration from `.opencode/config/branch-memory.json`
2. **Manual Saving**: Use `@branch-memory_save` to save context:
    - Saves conversation messages
    - Saves todo items
    - Saves modified file references
3. **Manual Loading**: Use `@branch-memory_load` to restore context:
    - Loads messages and todos
    - Shows what was saved
4. **Status Checking**: Use `@branch-memory_status` to see:
    - Current branch and context
    - All saved contexts
    - Metadata (size, dates, counts)
5. **Error Recovery**: Automatic backups prevent data loss
6. **Management**: Use `@branch-memory_list` and `@branch-memory_deleteContext` to manage saved contexts

## 🐛 Troubleshooting

### Tools not available

1. Check if tools are in `opencode.json`:
```json
{
  "tools": ["@branch-memory_save", "@branch-memory_load", "@branch-memory_status", "@branch-memory_list", "@branch-memory_deleteContext"]
}
```

2. Verify dependencies are installed:
```bash
cd .opencode
bun install
```

### Context not saving

1. Check if in a git repository:
```bash
git status
```

2. Check configuration:
```bash
cat .opencode/config/branch-memory.json
```

3. Check logs for errors:
```bash
# Look for emoji indicators:
# ✅ = success
# ⚠️  = warning
# ❌ = error
```

### Branch changes not detected

1. Verify git repository:
```bash
git rev-parse --git-dir
```

2. Check `.git/HEAD` file exists and is being updated

3. Try both monitoring modes:
```json
{
  "monitoring": {
    "method": "watcher"  // or "polling"
  }
}
```

### Corrupted context files

The system automatically restores from backups. If issues persist:

1. Check backup files:
```bash
ls -la .opencode/branch-memory/
```

2. Manual cleanup:
```bash
@branch-memory_deleteContext --branch broken-branch
```

### Permission errors

1. Check file permissions:
```bash
ls -la .opencode/branch-memory/
```

2. Ensure write access:
```bash
chmod -R u+w .opencode/branch-memory/
```

## 📁 File Structure

```
.opencode/
├── tool/
│   └── branch-memory.ts          # User-facing tools
├── branch-memory/
│   ├── index.ts                  # Exports
│   ├── storage.ts                # Context persistence
│   ├── git.ts                   # Git operations
│   ├── monitor.ts                # Branch monitoring
│   ├── collector.ts             # Context collection
│   ├── injector.ts              # Context injection
│   ├── types.ts                 # TypeScript types
│   └── config.ts                # Configuration
├── config/
│   └── branch-memory.json        # Configuration file
└── package.json                  # Dependencies
```

## 🚀 Advanced Usage

### Custom Configuration

Edit `.opencode/config/branch-memory.json` to customize behavior:

```json
{
  "autoSave": {
    "enabled": true,
    "onMessageChange": true,
    "onBranchChange": true,
    "onToolExecute": true
  },
  "contextLoading": "ask",
  "context": {
    "defaultInclude": ["messages", "todos", "files"],
    "maxMessages": 100,
    "maxTodos": 50
  }
}
```

### Workflow Example

1. **Start working on a feature:**
```bash
git checkout -b feature/user-profile
opencode
@branch-memory_status
```

2. **Work on feature and save context:**
```bash
# Do some work...
@branch-memory_save "Adding user profile feature"
```

3. **Switch to main to work on bug fix:**
```bash
git checkout main
@branch-memory_status
```

4. **Switch back to feature and load context:**
```bash
git checkout feature/user-profile
@branch-memory_load

# Context is restored - messages and todos are back
```

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🐛 Issues

Found a bug? Have a feature request? Please open an issue on GitHub.

---

Made with ❤️ for the OpenCode community
