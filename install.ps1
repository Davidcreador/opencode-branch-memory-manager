# OpenCode Branch Memory Manager Installer for Windows
# Run with: irm https://raw.githubusercontent.com/user/repo/install.ps1 | iex

$ErrorActionPreference = 'Stop'

Write-Host "🧠 Installing OpenCode Branch Memory Manager..." -ForegroundColor Cyan

# Check if .opencode directory exists
if (Test-Path ".opencode") {
    Write-Host "⚠️  .opencode directory already exists, backing up..." -ForegroundColor Yellow
    $backupName = ".opencode.backup.{0:yyyy}{0:MM}{0:dd}{0:HH}{0:mm}{0:ss}"
    Rename-Item ".opencode" $backupName
}

# Create directory structure
Write-Host "📁 Creating directory structure..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path ".opencode\tool" | Out-Null
New-Item -ItemType Directory -Force -Path ".opencode\plugin" | Out-Null
New-Item -ItemType Directory -Force -Path ".opencode\branch-memory" | Out-Null
New-Item -ItemType Directory -Force -Path ".opencode\config" | Out-Null

# Copy plugin files
Write-Host "📄 Copying plugin files..." -ForegroundColor Cyan
Copy-Item -Path ".opencode\*" -Destination ".opencode\" -Recurse -Force | Out-Null

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
Push-Location .opencode
try {
    bun install
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Failed to install dependencies with bun, trying npm..." -ForegroundColor Yellow
    try {
        npm install
        Write-Host "✅ Dependencies installed with npm" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    }
}
Pop-Location

# Check if opencode.json exists and add plugin
if (Test-Path "opencode.json") {
    Write-Host "🔧 Adding plugin to opencode.json..." -ForegroundColor Cyan
    
    try {
        $config = Get-Content "opencode.json" | ConvertFrom-Json
        if ($config.plugin) {
            if ($config.plugin -notcontains ".opencode/plugin/branch-memory-plugin.ts")) {
                $config.plugin += ".opencode/plugin/branch-memory-plugin.ts"
                $config | ConvertTo-Json -Depth 10 | Set-Content "opencode.json"
                Write-Host "✅ Plugin added to opencode.json" -ForegroundColor Green
            } else {
                Write-Host "✓ Plugin already in opencode.json" -ForegroundColor Cyan
            }
        } else {
            $config | Add-Member -NotePropertyName "plugin" -Value ".opencode/plugin/branch-memory-plugin.ts"
            $config | ConvertTo-Json -Depth 10 | Set-Content "opencode.json"
            Write-Host "✅ Plugin added to opencode.json" -ForegroundColor Green
        }
    } catch {
        Write-Host "⚠️  Could not modify opencode.json" -ForegroundColor Yellow
        Write-Host "   Please manually add: `"plugin": [".opencode/plugin/branch-memory-plugin.ts"]`" -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  opencode.json not found" -ForegroundColor Yellow
    Write-Host "   Please create opencode.json and add: `"plugin": [".opencode/plugin/branch-memory-plugin.ts"]`" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "To get started:" -ForegroundColor Cyan
Write-Host "1. Run: opencode" -ForegroundColor White
Write-Host "2. Use: @branch-memory_status" -ForegroundColor White
Write-Host ""
Write-Host "For more information, visit the repository README" -ForegroundColor Cyan
