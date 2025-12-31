# OpenCode Branch Memory Manager Installer for Windows
# Run with: irm https://raw.githubusercontent.com/Davidcreador/opencode-branch-memory-manager/main/install.ps1 | iex

$ErrorActionPreference = 'Stop'

$REPO = "Davidcreador/opencode-branch-memory-manager"
$BRANCH = "main"
$BASE_URL = "https://raw.githubusercontent.com/$REPO/$BRANCH"

Write-Host "🧠 Installing OpenCode Branch Memory Manager..." -ForegroundColor Cyan

# Check if .opencode directory exists
if (Test-Path ".opencode") {
    Write-Host "⚠️  .opencode directory already exists, backing up..." -ForegroundColor Yellow
    $backupName = ".opencode.backup.{0:yyyy}{0:MM}{0:dd}{0:HH}{0:mm}{0:ss}"
    Rename-Item ".opencode" ($backupName -f (Get-Date))
}

# Create directory structure
Write-Host "📁 Creating directory structure..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path ".opencode\tool" | Out-Null
New-Item -ItemType Directory -Force -Path ".opencode\branch-memory" | Out-Null
New-Item -ItemType Directory -Force -Path ".opencode\config" | Out-Null

# Download plugin files
Write-Host "📄 Downloading plugin files..." -ForegroundColor Cyan
$files = @(
    "$BASE_URL/.opencode/package.json",
    "$BASE_URL/.opencode/tool/branch-memory.ts",
    "$BASE_URL/.opencode/branch-memory/index.ts",
    "$BASE_URL/.opencode/branch-memory/types.ts",
    "$BASE_URL/.opencode/branch-memory/storage.ts",
    "$BASE_URL/.opencode/branch-memory/git.ts",
    "$BASE_URL/.opencode/branch-memory/monitor.ts",
    "$BASE_URL/.opencode/branch-memory/collector.ts",
    "$BASE_URL/.opencode/branch-memory/injector.ts",
    "$BASE_URL/.opencode/branch-memory/config.ts"
)

foreach ($file in $files) {
    $dest = $file -replace [regex]::Escape("$BASE_URL/"), ""
    Write-Host "  Downloading: $dest" -ForegroundColor Gray
    Invoke-WebRequest -Uri $file -OutFile $dest -ErrorAction Stop
}

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
Push-Location .opencode
try {
    if (Get-Command bun -ErrorAction SilentlyContinue) {
        bun install
        Write-Host "✅ Dependencies installed with bun" -ForegroundColor Green
    } elseif (Get-Command npm -ErrorAction SilentlyContinue) {
        npm install
        Write-Host "✅ Dependencies installed with npm" -ForegroundColor Green
    } else {
        Write-Host "❌ Neither bun nor npm found. Please install one of them first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Failed to install dependencies: $_" -ForegroundColor Red
    exit 1
}
Pop-Location

# Create default configuration
Write-Host "🔧 Creating default configuration..." -ForegroundColor Cyan
$configContent = @"
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
"@
Set-Content -Path ".opencode\config\branch-memory.json" -Value $configContent

# Check if opencode.json exists and update it
if (Test-Path "opencode.json") {
    Write-Host "🔧 Updating opencode.json..." -ForegroundColor Cyan

    try {
        $config = Get-Content "opencode.json" -Raw | ConvertFrom-Json
        $tools = @("@branch-memory_save", "@branch-memory_load", "@branch-memory_status", "@branch-memory_list", "@branch-memory_deleteContext")

        if ($config.PSObject.Properties.Name -contains "tools") {
            if ($config.tools -is [array]) {
                foreach ($tool in $tools) {
                    if ($config.tools -notcontains $tool) {
                        $config.tools += $tool
                    }
                }
                $config.tools = $config.tools | Select-Object -Unique
            } else {
                Write-Host "⚠️  Existing 'tools' property is not an array. Please manually update opencode.json" -ForegroundColor Yellow
            }
        } else {
            $config | Add-Member -NotePropertyName "tools" -Value $tools -Force
        }

        $config | ConvertTo-Json -Depth 10 | Set-Content "opencode.json"
        Write-Host "✅ Tools added to opencode.json" -ForegroundColor Green
    } catch {
        Write-Host "⚠️  Could not modify opencode.json: $_" -ForegroundColor Yellow
        Write-Host "   Please manually add these tools:" -ForegroundColor Yellow
        Write-Host '   "tools": ["@branch-memory_save", "@branch-memory_load", "@branch-memory_status", "@branch-memory_list", "@branch-memory_deleteContext"]' -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  opencode.json not found" -ForegroundColor Yellow
    Write-Host "   Please create opencode.json and add these tools:" -ForegroundColor Yellow
    Write-Host '   "tools": ["@branch-memory_save", "@branch-memory_load", "@branch-memory_status", "@branch-memory_list", "@branch-memory_deleteContext"]' -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To get started:" -ForegroundColor Cyan
Write-Host "1. Run: opencode" -ForegroundColor White
Write-Host "2. Use: @branch-memory_status" -ForegroundColor White
Write-Host ""
Write-Host "For more information, visit: https://github.com/$REPO" -ForegroundColor Cyan
