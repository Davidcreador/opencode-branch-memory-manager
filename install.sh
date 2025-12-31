#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🧠 Installing OpenCode Branch Memory Manager...${NC}"

# Check if opencode directory exists
if [ -d ".opencode" ]; then
    echo -e "${YELLOW}⚠️  .opencode directory already exists, backing up...${NC}"
    mv .opencode .opencode.backup.$(date +%Y%m%d_%H%M%S)
fi

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p .opencode/tool
mkdir -p .opencode/plugin
mkdir -p .opencode/branch-memory
mkdir -p .opencode/config

# Copy plugin files
echo "📄 Copying plugin files..."
cp -r .opencode/* .opencode/

# Install dependencies
echo "📦 Installing dependencies..."
cd .opencode
bun install
cd ..

# Check if opencode.json exists and add plugin
if [ -f "opencode.json" ]; then
    echo "🔧 Adding plugin to opencode.json..."
    
    # Use jq to add plugin if available, otherwise manual edit
    if command -v jq &> /dev/null; then
        # Create opencode.json if it doesn't exist or read existing
        if [ ! -f "opencode.json" ]; then
            echo '{"$schema":"https://opencode.ai/config.json","plugin":[".opencode/plugin/branch-memory-plugin.ts"]}' > opencode.json
        else
            # Add plugin to existing config using jq
            jq '.plugin += [".opencode/plugin/branch-memory-plugin.ts"] | .plugin |= unique' opencode.json > opencode.json.tmp
            mv opencode.json.tmp opencode.json
        fi
    else
        echo -e "${YELLOW}⚠️  jq not found, please manually add the plugin to opencode.json:${NC}"
        echo -e "  \"plugin\": [\".opencode/plugin/branch-memory-plugin.ts\"]"
    fi
else
    echo -e "${YELLOW}⚠️  opencode.json not found, please create one and add the plugin${NC}"
    echo -e "  \"plugin\": [\".opencode/plugin/branch-memory-plugin.ts\"]"
fi

echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "To get started:"
echo "  1. Run: opencode"
echo "  2. Use: @branch-memory_status"
echo ""
echo "For more information, visit: https://github.com/Davidcreador/opencode-branch-memory-manager"
