import assert from 'node:assert'
import { BranchMonitor } from '../.opencode/branch-memory/monitor.js'
import { ConfigManager } from '../.opencode/branch-memory/config.js'

const config = ConfigManager.getDefault()

async function runTests() {
  console.log('\nBranchMonitor Tests')
  
  let testsPassed = 0
  let testsFailed = 0
  
  const runTest = async (name, testFn) => {
    try {
      await testFn()
      console.log('PASS:', name)
      testsPassed++
    } catch (error) {
      console.log('FAIL:', name, '-', error.message)
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
    
    let callbackCalled = false
    monitor.onChange((oldBranch, newBranch) => {
      callbackCalled = true
    })
    
    monitor.offChange(() => {})
    
    assert.ok(callbackCalled)
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
    const monitor = new BranchMonitor(() => {}, config)
    
    let callback1Called = false
    let callback2Called = false
    let callback3Called = false
    
    monitor.onChange((oldBranch, newBranch) => {
      callback1Called = true
    })
    
    monitor.onChange((oldBranch, newBranch) => {
      callback2Called = true
    })
    
    monitor.onChange((oldBranch, newBranch) => {
      callback3Called = true
    })
    
    assert.ok(callback1Called)
    assert.ok(callback2Called)
    assert.ok(callback3Called)
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
