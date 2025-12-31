import * as fs from 'fs/promises'
import * as path from 'path'
import assert from 'node:assert'
import { ConfigManager } from '../.opencode/branch-memory/config.js'
import { existsSync } from 'fs'
import type { PluginConfig } from '../.opencode/branch-memory/types.js'

// Simple test runner since bun:test is not available
class TestRunner {
  private tests: Array<{ name: string, fn: () => Promise<void> }> = []
  private beforeEachFn?: () => Promise<void>
  private afterEachFn?: () => Promise<void>
  
  describe(name: string, fn: () => void) {
    console.log(`\n${name}`)
    fn()
  }
  
  beforeEach(fn: () => Promise<void>) {
    this.beforeEachFn = fn
  }
  
  afterEach(fn: () => Promise<void>) {
    this.afterEachFn = fn
  }
  
  it(name: string, fn: () => Promise<void>) {
    this.tests.push({ name, fn })
  }
  
  async run() {
    for (const test of this.tests) {
      try {
        if (this.beforeEachFn) await this.beforeEachFn()
        await test.fn()
        console.log(`  ✓ ${test.name}`)
        if (this.afterEachFn) await this.afterEachFn()
      } catch (error) {
        console.log(`  ✗ ${test.name}`)
        console.error(`    Error: ${error instanceof Error ? error.message : error}`)
        if (this.afterEachFn) await this.afterEachFn()
        throw error
      }
    }
  }
}

const runner = new TestRunner()
const testDir = '/tmp/test-config'
const configPath = path.join(testDir, '.opencode', 'config', 'branch-memory.json')

runner.beforeEach(async () => {
  // Clean up test directory
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  await fs.mkdir(testDir, { recursive: true })
  await fs.mkdir(path.join(testDir, '.opencode', 'config'), { recursive: true })
  ConfigManager.setProjectPath(testDir)
})

runner.afterEach(async () => {
  // Clean up test directory
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
})

runner.describe('ConfigManager', () => {
  runner.describe('getDefault()', () => {
    runner.it('should return default configuration', () => {
      const config = ConfigManager.getDefault()
      
      assert.ok(config)
      assert.strictEqual(config.autoSave.enabled, true)
      assert.strictEqual(config.autoSave.onMessageChange, true)
      assert.strictEqual(config.autoSave.onBranchChange, true)
      assert.strictEqual(config.autoSave.onToolExecute, true)
      assert.strictEqual(config.contextLoading, 'auto')
      assert.deepStrictEqual(config.context.defaultInclude, ['messages', 'todos', 'files'])
      assert.strictEqual(config.context.maxMessages, 50)
      assert.strictEqual(config.context.maxTodos, 20)
      assert.strictEqual(config.storage.maxBackups, 5)
      assert.strictEqual(config.storage.retentionDays, 90)
      assert.strictEqual(config.monitoring.method, 'both')
      assert.strictEqual(config.monitoring.pollingInterval, 1000)
    })
    
    runner.it('should return a copy of defaults (not reference)', () => {
      const config1 = ConfigManager.getDefault()
      const config2 = ConfigManager.getDefault()
      
      config1.autoSave.enabled = false
      
      assert.strictEqual(config2.autoSave.enabled, true)
    })
  })
  
  runner.describe('load() with no config file', () => {
    runner.it('should return default configuration when file does not exist', async () => {
      const config = await ConfigManager.load()
      
      const defaults = ConfigManager.getDefault()
      assert.deepStrictEqual(config, defaults)
    })
  })
  
  runner.describe('load() with config file', () => {
    runner.it('should load configuration from file', async () => {
      const userConfig = {
        autoSave: {
          enabled: false,
          onMessageChange: false,
          onBranchChange: false,
          onToolExecute: false
        }
      }
      
      await fs.writeFile(configPath, JSON.stringify(userConfig), 'utf8')
      
      const config = await ConfigManager.load()
      
      assert.strictEqual(config.autoSave.enabled, false)
      assert.strictEqual(config.autoSave.onMessageChange, false)
      assert.strictEqual(config.autoSave.onBranchChange, false)
      assert.strictEqual(config.autoSave.onToolExecute, false)
      // Other values should remain from defaults
      assert.strictEqual(config.contextLoading, 'auto')
    })
    
    runner.it('should merge user config with defaults', async () => {
      const userConfig = {
        autoSave: {
          enabled: false
        },
        contextLoading: 'ask' as const
      }
      
      await fs.writeFile(configPath, JSON.stringify(userConfig), 'utf8')
      
      const config = await ConfigManager.load()
      
      assert.strictEqual(config.autoSave.enabled, false)
      assert.strictEqual(config.autoSave.onMessageChange, true) // From defaults
      assert.strictEqual(config.autoSave.onBranchChange, true) // From defaults
      assert.strictEqual(config.contextLoading, 'ask')
    })
    
    runner.it('should handle partial nested objects', async () => {
      const userConfig = {
        context: {
          maxMessages: 100
        }
      }
      
      await fs.writeFile(configPath, JSON.stringify(userConfig), 'utf8')
      
      const config = await ConfigManager.load()
      
      assert.strictEqual(config.context.maxMessages, 100)
      assert.strictEqual(config.context.maxTodos, 20) // From defaults
      assert.deepStrictEqual(config.context.defaultInclude, ['messages', 'todos', 'files']) // From defaults
    })
    
    runner.it('should handle arrays correctly (replace not merge)', async () => {
      const userConfig = {
        context: {
          defaultInclude: ['messages'] as ('messages' | 'todos' | 'files')[]
        }
      }
      
      await fs.writeFile(configPath, JSON.stringify(userConfig), 'utf8')
      
      const config = await ConfigManager.load()
      
      assert.deepStrictEqual(config.context.defaultInclude, ['messages'])
    })
    
    runner.it('should fall back to defaults on invalid JSON', async () => {
      await fs.writeFile(configPath, 'invalid json {{{', 'utf8')
      
      const config = await ConfigManager.load()
      
      const defaults = ConfigManager.getDefault()
      assert.deepStrictEqual(config, defaults)
    })
  })
  
  runner.describe('save()', () => {
    runner.it('should save configuration to file', async () => {
      const config: PluginConfig = {
        ...ConfigManager.getDefault(),
        autoSave: {
          enabled: false,
          onMessageChange: false,
          onBranchChange: false,
          onToolExecute: false
        }
      }
      
      await ConfigManager.save(config)
      
      assert.strictEqual(existsSync(configPath), true)
      
      const content = await fs.readFile(configPath, 'utf8')
      const savedConfig = JSON.parse(content) as PluginConfig
      
      assert.strictEqual(savedConfig.autoSave.enabled, false)
    })
    
    runner.it('should create config directory if it does not exist', async () => {
      const differentTestDir = path.join(testDir, 'nested', 'path')
      const configDir = path.join(differentTestDir, '.opencode', 'config')
      
      ConfigManager.setProjectPath(differentTestDir)
      
      const config = ConfigManager.getDefault()
      await ConfigManager.save(config)
      
      assert.strictEqual(existsSync(configDir), true)
    })
  })
  
  runner.describe('getStorageDir()', () => {
    runner.it('should return correct storage directory path', () => {
      const storageDir = ConfigManager.getStorageDir(testDir)
      
      assert.strictEqual(storageDir, path.join(testDir, '.opencode', 'branch-memory'))
    })
  })
})

// Run all tests
runner.run().then(() => {
  console.log('\n✓ All tests passed!')
  process.exit(0)
}).catch((error) => {
  console.error('\n✗ Tests failed!')
  process.exit(1)
})
