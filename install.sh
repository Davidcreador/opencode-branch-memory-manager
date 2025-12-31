#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

REPO="Davidcreador/opencode-branch-memory-manager"
BRANCH="main"
BASE_URL="https://raw.githubusercontent.com/$REPO/$BRANCH"

echo -e "${GREEN}🧠 Installing OpenCode Branch Memory Manager...${NC}"

# Check if .opencode directory exists
if [ -d ".opencode" ]; then
    echo -e "${YELLOW}⚠️  .opencode directory already exists, backing up...${NC}"
    mv .opencode .opencode.backup.$(date +%Y%m%d_%H%M%S)
fi

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p .opencode/tool
mkdir -p .opencode/branch-memory
mkdir -p .opencode/config

# Download plugin files
echo "📄 Downloading plugin files..."
curl -fsSL "$BASE_URL/.opencode/package.json" -o .opencode/package.json
curl -fsSL "$BASE_URL/.opencode/tool/branch-memory.ts" -o .opencode/tool/branch-memory.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/index.ts" -o .opencode/branch-memory/index.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/types.ts" -o .opencode/branch-memory/types.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/storage.ts" -o .opencode/branch-memory/storage.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/git.ts" -o .opencode/branch-memory/git.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/monitor.ts" -o .opencode/branch-memory/monitor.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/collector.ts" -o .opencode/branch-memory/collector.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/injector.ts" -o .opencode/branch-memory/injector.ts
curl -fsSL "$BASE_URL/.opencode/branch-memory/config.ts" -o .opencode/branch-memory/config.ts

# Install dependencies
echo "📦 Installing dependencies..."
cd .opencode
if command -v bun &> /dev/null; then
    bun install
elif command -v npm &> /dev/null; then
    npm install
else
    echo -e "${RED}❌ Neither bun nor npm found. Please install one of them first.${NC}"
    exit 1
fi
cd ..

# Create default configuration
echo "🔧 Creating default configuration..."
cat > .opencode/config/branch-memory.json << 'EOF'
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
EOF

# Check if opencode.json exists and update it
if [ -f "opencode.json" ]; then
    echo "🔧 Updating opencode.json..."

    # Use sed to replace tools array
    # First, remove the existing tools array/object
    # This approach works regardless of whether tools is an object or array

    # Backup original
    cp opencode.json opencode.json.backup

    if command -v python3 &> /dev/null; then
        # Use Python to update the JSON file
        python3 - << 'PYTHON_SCRIPT'
import json
import sys

try:
    with open('opencode.json', 'r') as f:
        config = json.load(f)

    # Replace tools array completely
    config['tools'] = [
        "@branch-memory_save",
        "@branch-memory_load",
        "@branch-memory_status",
        "@branch-memory_list",
        "@branch-memory_deleteContext"
    ]

    with open('opencode.json', 'w') as f:
        json.dump(config, f, indent=2)

    print("✅ Tools updated in opencode.json")
except Exception as e:
    print(f"❌ Error: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_SCRIPT

    elif command -v jq &> /dev/null; then
        # Fallback to jq
        jq '.tools = ["@branch-memory_save", "@branch-memory_load", "@branch-memory_status", "@branch-memory_list", "@branch-memory_deleteContext"]' opencode.json > opencode.json.tmp
        mv opencode.json.tmp opencode.json
        echo -e "${GREEN}✅ Tools updated in opencode.json${NC}"
    else
        # Fallback to manual instructions
        echo -e "${YELLOW}⚠️  Could not automatically update opencode.json${NC}"
        echo -e "${YELLOW}  Please manually add these tools:${NC}"
        echo -e "  \"tools\": [\"@branch-memory_save\", \"@branch-memory_load\", \"@branch-memory_status\", \"@branch-memory_list\", \"@branch-memory_deleteContext\"]"
    fi
else
    echo -e "${YELLOW}⚠️  opencode.json not found. Please create one and add tools:${NC}"
    echo -e "  \"tools\": [\"@branch-memory_save\", \"@branch-memory_load\", \"@branch-memory_status\", \"@branch-memory_list\", \"@branch-memory_deleteContext\"]"
fi

echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "To get started:"
echo "  1. Run: opencode"
echo "  2. Use: @branch-memory_status"
echo ""
echo "For more information, visit: https://github.com/$REPO"
