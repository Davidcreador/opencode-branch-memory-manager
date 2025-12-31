import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync } from 'fs'
import assert from 'node:assert'
import { ContextStorage } from '../.opencode/branch-memory/storage.js'
import type { BranchContext } from '../.opencode/branch-memory/types.js'

// Helper to create context with flexible data
function createContext(
  branch: string,
  data: Record<string, unknown> = {}
): BranchContext {
  return {
    branch,
    savedAt: new Date().toISOString(),
    metadata: {
      version: '1.0.0',
      platform: process.platform,
      size: 100,
      messageCount: 0,
      todoCount: 0,
      fileCount: 0
    },
    data
  } as BranchContext
}

// Simple test runner
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
        if (error instanceof Error && error.stack) {
          console.error(`    Stack: ${error.stack.split('\n').slice(1, 3).join('\n')}`)
        }
        if (this.afterEachFn) await this.afterEachFn()
        throw error
      }
    }
  }
}

const runner = new TestRunner()
const testDir = '/tmp/test-storage'
const storageDir = path.join(testDir, '.opencode', 'branch-memory')

runner.beforeEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  await fs.mkdir(testDir, { recursive: true })
  await fs.mkdir(path.join(testDir, '.opencode', 'branch-memory'), { recursive: true })
})

runner.afterEach(async () => {
  await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
})

runner.describe('ContextStorage', () => {
  runner.describe('saveContext()', () => {
    runner.it('should save context to correct location', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 5,
          todoCount: 3,
          fileCount: 10
        },
        data: { test: 'data' }
      }
      
      await storage.saveContext('test-branch', context)
      
      const filePath = path.join(storageDir, 'test-branch.json')
      assert.strictEqual(existsSync(filePath), true)
      
      const content = await fs.readFile(filePath, 'utf8')
      const saved = JSON.parse(content) as BranchContext
      
      assert.strictEqual(saved.branch, 'test-branch')
      assert.strictEqual(saved.data.test, 'data')
    })
    
    runner.it('should create backup of existing file', async () => {
      const storage = new ContextStorage(storageDir)
      const context1: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 1,
          todoCount: 1,
          fileCount: 1
        },
        data: { version: 1 }
      }
      
      await storage.saveContext('test-branch', context1)
      
      const context2: BranchContext = {
        ...context1,
        savedAt: new Date().toISOString(),
        data: { version: 2 }
      }
      
      await storage.saveContext('test-branch', context2)
      
      // Check backup exists
      const files = await fs.readdir(storageDir)
      const backups = files.filter(f => f.includes('.backup.'))
      
      assert.ok(backups.length >= 1, 'Should create at least one backup')
      
      // Check backup content
      const backupFile = path.join(storageDir, backups[0])
      const backupContent = await fs.readFile(backupFile, 'utf8')
      const backup = JSON.parse(backupContent) as BranchContext
      
      assert.strictEqual(backup.data.version, 1)
    })
    
    runner.it('should use atomic write pattern (temp + rename)', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      }
      
      await storage.saveContext('test-branch', context)
      
      // Verify no temp file left
      const files = await fs.readdir(storageDir)
      const tempFiles = files.filter(f => f.endsWith('.tmp'))
      
      assert.strictEqual(tempFiles.length, 0, 'Should not leave temp files')
    })
    
    runner.it('should handle special characters in branch names', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'feature/with/special-chars',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      }
      
      await storage.saveContext('feature/with/special-chars', context)
      
      // Sanitization: / → _, ` → -, so 'feature/with/special-chars' → 'feature_with_special-chars'
      const safeBranch = 'feature_with_special-chars.json'
      const filePath = path.join(storageDir, safeBranch)
      
      assert.strictEqual(existsSync(filePath), true)
    })
  })
  
  runner.describe('loadContext()', () => {
    runner.it('should load context for existing branch', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: '2025-01-01T00:00:00.000Z',
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 5,
          todoCount: 3,
          fileCount: 10
        },
        data: { loaded: true }
      }
      
      await storage.saveContext('test-branch', context)
      const loaded = await storage.loadContext('test-branch')
      
      assert.ok(loaded)
      assert.strictEqual(loaded?.branch, 'test-branch')
      assert.strictEqual(loaded?.data.loaded, true)
    })
    
    runner.it('should return null for non-existent branch', async () => {
      const storage = new ContextStorage(storageDir)
      const loaded = await storage.loadContext('non-existent-branch')
      
      assert.strictEqual(loaded, null)
    })
    
    runner.it('should validate version compatibility', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '2.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      }
      
      await storage.saveContext('test-branch', context)
      const loaded = await storage.loadContext('test-branch')
      
      // Should still load but log warning
      assert.ok(loaded)
    })
    
    runner.it('should restore from backup if file is corrupted', async () => {
      const storage = new ContextStorage(storageDir)
      const context1: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 1,
          todoCount: 1,
          fileCount: 1
        },
        data: { fromBackup: true }
      }
      
      await storage.saveContext('test-branch', context1)
      
      // Create a second save to generate a backup
      const context2: BranchContext = {
        ...context1,
        savedAt: new Date().toISOString(),
        data: { version: 2 }
      }
      
      await storage.saveContext('test-branch', context2)
      
      // Corrupt => main file
      const filePath = path.join(storageDir, 'test-branch.json')
      await fs.writeFile(filePath, 'corrupted data {{{', 'utf8')
      
      const loaded = await storage.loadContext('test-branch')
      
      assert.ok(loaded, 'Should restore from backup')
      assert.strictEqual(loaded?.data.fromBackup, true)
    })
    
    runner.it('should return null if no valid backup exists', async () => {
      const storage = new ContextStorage(storageDir)
      
      // Create corrupted file
      const filePath = path.join(storageDir, 'test-branch.json')
      await fs.writeFile(filePath, 'corrupted', 'utf8')
      
      const loaded = await storage.loadContext('test-branch')
      
      assert.strictEqual(loaded, null)
    })
  })
  
  runner.describe('listBranches()', () => {
    runner.it('should list all branches with saved contexts', async () => {
      const storage = new ContextStorage(storageDir)
      
      await storage.saveContext('branch-1', {
        branch: 'branch-1',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      })
      
      await storage.saveContext('branch-2', {
        branch: 'branch-2',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      })
      
      const branches = await storage.listBranches()
      
      assert.strictEqual(branches.length, 2)
      assert.ok(branches.includes('branch-1'))
      assert.ok(branches.includes('branch-2'))
    })
    
    runner.it('should return empty array if no contexts', async () => {
      const storage = new ContextStorage(storageDir)
      const branches = await storage.listBranches()
      
      assert.strictEqual(branches.length, 0)
    })
    
    runner.it('should skip invalid files', async () => {
      const storage = new ContextStorage(storageDir)
      
      // Create a valid context
      await storage.saveContext('valid-branch', {
        branch: 'valid-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      })
      
      // Create an invalid JSON file
      await fs.writeFile(path.join(storageDir, 'invalid-branch.json'), 'invalid {{{', 'utf8')
      
      const branches = await storage.listBranches()
      
      assert.strictEqual(branches.length, 1)
      assert.strictEqual(branches[0], 'valid-branch')
    })
  })
  
  runner.describe('deleteContext()', () => {
    runner.it('should delete context and its backups', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      }
      
      await storage.saveContext('test-branch', context)
      await storage.saveContext('test-branch', { ...context, data: { version: 2 } })
      
      const filesBefore = await fs.readdir(storageDir)
      assert.ok(filesBefore.length > 1, 'Should have main file and backups')
      
      await storage.deleteContext('test-branch')
      
      const filesAfter = await fs.readdir(storageDir)
      assert.strictEqual(filesAfter.length, 0, 'Should delete all files')
    })
    
    runner.it('should handle deletion of non-existent context', async () => {
      const storage = new ContextStorage(storageDir)
      
      await storage.deleteContext('non-existent-branch')
      
      // Should not throw error
      assert.ok(true)
    })
  })
  
  runner.describe('backup rotation', () => {
    runner.it('should keep only last 5 backups', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      }
      
      // Create 7 saves (should result in 5 backups + 1 main file = 6 total)
      for (let i = 1; i <= 7; i++) {
        await storage.saveContext('test-branch', { ...context, data: { version: i } })
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      const files = await fs.readdir(storageDir)
      const backups = files.filter(f => f.includes('.backup.'))
      
      assert.strictEqual(backups.length, 5, 'Should keep only 5 backups')
    })
  })
  
  runner.describe('getMetadata()', () => {
    runner.it('should return metadata for existing branch', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: '2025-01-01T12:00:00.000Z',
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 1024,
          messageCount: 10,
          todoCount: 5,
          fileCount: 3
        },
        data: {}
      }
      
      await storage.saveContext('test-branch', context)
      const metadata = await storage.getMetadata('test-branch')
      
      assert.strictEqual(metadata.size, '1.0KB')
      assert.strictEqual(metadata.modified, '2025-01-01T12:00:00.000Z')
      assert.strictEqual(metadata.messageCount, 10)
      assert.strictEqual(metadata.todoCount, 5)
      assert.strictEqual(metadata.fileCount, 3)
    })
    
    runner.it('should return default metadata for non-existent branch', async () => {
      const storage = new ContextStorage(storageDir)
      const metadata = await storage.getMetadata('non-existent-branch')
      
      assert.strictEqual(metadata.size, '0KB')
      assert.strictEqual(metadata.modified, 'Never')
      assert.strictEqual(metadata.messageCount, 0)
      assert.strictEqual(metadata.todoCount, 0)
      assert.strictEqual(metadata.fileCount, 0)
    })
  })
  
  runner.describe('concurrent operations', () => {
    runner.it('should handle concurrent writes gracefully', async () => {
      const storage = new ContextStorage(storageDir)
      const context: BranchContext = {
        branch: 'test-branch',
        savedAt: new Date().toISOString(),
        metadata: {
          version: '1.0.0',
          platform: process.platform,
          size: 100,
          messageCount: 0,
          todoCount: 0,
          fileCount: 0
        },
        data: {}
      }
      
      // Perform 10 concurrent writes
      const promises = Array.from({ length: 10 }, (_, i) =>
        storage.saveContext('test-branch', { ...context, data: { version: i } })
      )
      
      await Promise.all(promises)
      
      // Verify data integrity
      const loaded = await storage.loadContext('test-branch')
      assert.ok(loaded, 'Should successfully load context after concurrent writes')
      assert.ok(loaded!.data.version !== undefined)
    })
  })
})

// Run all tests
runner.run().then(() => {
  console.log('\n✓ All storage tests passed!')
  process.exit(0)
}).catch((error) => {
  console.error('\n✗ Storage tests failed!')
  process.exit(1)
})
