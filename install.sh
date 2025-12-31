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

    if command -v jq &> /dev/null; then
        # Check if tools array exists, if not create it
        if jq -e '.tools' opencode.json > /dev/null 2>&1; then
            # Check if tools is an array
            if jq -e '.tools | type == "array"' opencode.json > /dev/null 2>&1; then
                # Add tools to existing array
                jq '.tools += ["@branch-memory_save", "@branch-memory_load", "@branch-memory_status", "@branch-memory_list", "@branch-memory_deleteContext"] | .tools |= unique' opencode.json > opencode.json.tmp
                mv opencode.json.tmp opencode.json
                echo -e "${GREEN}✅ Tools added to opencode.json${NC}"
            else
                echo -e "${YELLOW}⚠️  Existing 'tools' property is not an array. Please manually update opencode.json${NC}"
            fi
        else
            # Add tools array to config
            jq '.tools = ["@branch-memory_save", "@branch-memory_load", "@branch-memory_status", "@branch-memory_list", "@branch-memory_deleteContext"]' opencode.json > opencode.json.tmp
            mv opencode.json.tmp opencode.json
            echo -e "${GREEN}✅ Tools array created in opencode.json${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  jq not found. Please manually add these tools to opencode.json:${NC}"
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
