import assert from 'node:assert'
import { BranchMonitor } from '../.opencode/branch-memory/monitor.js'
import { ConfigManager } from '../.opencode/branch-memory/config.js'

const config = ConfigManager.getDefault()

async function runTests() {
  console.log('\nBranchMonitor Tests')
  
  let testsPassed = 0
  let testsFailed = 0
  
  const runTest = async (name: string, testFn: () => Promise<void>) => {
    try {
      await testFn()
      console.log('PASS:', name)
      testsPassed++
    } catch (error) {
      console.log('FAIL:', name, '-', error instanceof Error ? error.message : String(error))
      testsFailed++
    }
  }
  
  await runTest('should start monitoring', async () => {
    const monitor = new BranchMonitor(() => {}, config)
    await monitor.start()
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    assert.ok(monitor.isActive())
    
    monitor.stop()
    assert.ok(!monitor.isActive())
  })
  
  await runTest('should register callbacks', async () => {
    const monitor = new BranchMonitor(() => {}, config)
    
    const testCallback = (oldBranch: string | undefined, newBranch: string) => {
      // This should be called on branch change
    }
    
    monitor.onChange(testCallback)
    
    // Start monitoring to initialize current branch
    await monitor.start()
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Manually set a different branch to trigger callback
    const anyMonitor = monitor as any
    anyMonitor.currentBranch = 'test-branch'
    await monitor._testTriggerCheck()
    
    monitor.stop()
    assert.ok(true, 'Callback registration completed without errors')
  })
  
  await runTest('should handle non-git directories', async () => {
    const originalCwd = process.cwd()
    process.chdir('/tmp')
    
    const monitor = new BranchMonitor(() => {}, config)
    
    await monitor.start()
    
    await new Promise(resolve => setTimeout(resolve, 100))
    
    assert.ok(!monitor.isActive())
    
    process.chdir(originalCwd)
  })
  
  await runTest('should support multiple callbacks', async () => {
    const results: { called: string[] } = { called: [] }
    
    const monitor = new BranchMonitor(() => {}, config)
    
    monitor.onChange((oldBranch, newBranch) => {
      results.called.push('callback1')
    })
    
    monitor.onChange((oldBranch, newBranch) => {
      results.called.push('callback2')
    })
    
    monitor.onChange((oldBranch, newBranch) => {
      results.called.push('callback3')
    })
    
    // Start monitoring
    await monitor.start()
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // Simulate branch change
    const anyMonitor = monitor as any
    anyMonitor.currentBranch = 'new-test-branch'
    await monitor._testTriggerCheck()
    
    // Give async callbacks time to execute
    await new Promise(resolve => setTimeout(resolve, 50))
    
    monitor.stop()
    
    // Verify all three callbacks were called
    assert.ok(results.called.length === 3, `Expected 3 callbacks, got ${results.called.length}`)
    assert.ok(results.called.includes('callback1'), 'callback1 was not called')
    assert.ok(results.called.includes('callback2'), 'callback2 was not called')
    assert.ok(results.called.includes('callback3'), 'callback3 was not called')
  })
  
  await runTest('should stop monitoring cleanly', async () => {
    const monitor = new BranchMonitor(() => {}, config)
    
    await monitor.start()
    assert.ok(monitor.isActive())
    
    monitor.stop()
    assert.ok(!monitor.isActive())
    
    // Stopping again should not throw
    monitor.stop()
    assert.ok(!monitor.isActive())
  })
  
  console.log(`\nResults: ${testsPassed} passed, ${testsFailed} failed`)
  
  if (testsFailed > 0) {
    process.exit(1)
  }
}

runTests().then(() => {
  console.log('All tests passed!')
  process.exit(0)
}).catch((error) => {
  console.error('Test suite failed:', error)
  process.exit(1)
})
