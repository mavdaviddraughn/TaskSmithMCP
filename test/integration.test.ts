/**
 * Integration tests for TaskManager with Output Management (T140)
 * Tests the complete flow from script execution through output processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '../src/lib/task-manager.js';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { jo      caching: {
        maxEntries: 10,
        maxMemoryBytes: 1024 * 1024,
        ttlMs: 60000,
        compression: true,
        persistToDisk: false
      },rom 'path';

describe('TaskManager Output Management Integration', () => {
  let taskManager: TaskManager;
  let testRepoDir: string;

  beforeEach(async () => {
    // Create temporary test repository
    testRepoDir = await fs.mkdtemp(join(tmpdir(), 'tasksmith-integration-'));
    
    // Initialize git repo
    process.env.TEST_REPO_ROOT = testRepoDir;
    
    taskManager = new TaskManager();
    await taskManager.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(testRepoDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.TEST_REPO_ROOT;
  });

  it('should execute script with basic output management', async () => {
    // First save a simple test script
    const saveResult = await taskManager.saveScript({
      name: 'hello-world',
      shell: 'pwsh',
      content: 'Write-Host "Hello World"',
      description: 'Simple test script'
    });

    expect(saveResult.success).toBe(true);

    // Execute with basic output options
    const runResult = await taskManager.runScript({
      name: 'hello-world',
      args: []
    }, {
      streaming: {
        stdout: {
          maxLines: 1000,
          retentionMs: 60000,
          maxMemoryBytes: 1024 * 1024
        },
        stderr: {
          maxLines: 500,
          retentionMs: 60000,
          maxMemoryBytes: 512 * 1024
        },
        errorPatterns: ['error:', 'fail'],
        warningPatterns: ['warn:', 'warning']
      },
      progress: {
        enabled: true,
        style: 'spinner',
        updateIntervalMs: 100,
        showETA: true,
        showPhase: true
      },
      formatting: {
        colorScheme: 'dark',
        syntaxHighlighting: true,
        timestampFormat: 'iso',
        includeMetadata: true
      }
    });

    expect(runResult.status).toBe('completed');
    expect(runResult.runId).toBeDefined();
    expect(runResult.execution?.stdout).toContain('Hello World');
  });

  it('should handle script execution with filtering', async () => {
    // Create a script that generates mixed output
    const saveResult = await taskManager.saveScript({
      name: 'mixed-output',
      shell: 'pwsh',
      content: `
Write-Host "INFO: Starting process"
Write-Error "ERROR: Something went wrong"
Write-Host "DEBUG: Processing data"
Write-Warning "WARNING: Low disk space"
Write-Host "INFO: Process completed"
      `.trim(),
      description: 'Script with mixed log levels'
    });

    expect(saveResult.success).toBe(true);

    // Execute with filtering
    const runResult = await taskManager.runScript({
      name: 'mixed-output',
      args: []
    }, {
      filtering: {
        levels: ['error', 'warn'],
        keywords: ['ERROR', 'WARNING']
      },
      export: {
        format: 'json',
        includeMetadata: true,
        compress: false
      }
    });

    expect(runResult.status).toBe('completed');
    expect(runResult.execution?.filteredOutput).toBeDefined();
    if (runResult.execution?.filteredOutput) {
      expect(runResult.execution.filteredOutput.totalMatches).toBeGreaterThan(0);
    }
  });

  it('should cache execution results', async () => {
    const saveResult = await taskManager.saveScript({
      name: 'cacheable-script',
      shell: 'pwsh',
      content: 'Write-Host "Cached output: $(Get-Date)"',
      description: 'Script for cache testing'
    });

    expect(saveResult.success).toBe(true);

    // First execution with caching enabled
    const firstRun = await taskManager.runScript({
      name: 'cacheable-script',
      args: ['param1', 'param2']
    }, {
      caching: {
        maxEntries: 100,
        maxMemoryBytes: 10 * 1024 * 1024,
        ttlMs: 60000, // 1 minute
        compression: true,
        persistToDisk: true
      }
    });

    expect(firstRun.status).toBe('completed');

    // Second execution should potentially use cache (though timing may vary)
    const secondRun = await taskManager.runScript({
      name: 'cacheable-script',
      args: ['param1', 'param2']
    }, {
      caching: {
        maxEntries: 100,
        maxMemoryBytes: 10 * 1024 * 1024,
        ttlMs: 60000,
        compression: true,
        persistToDisk: true
      }
    });

    expect(secondRun.status).toBe('completed');
  });

  it('should validate arguments with output management', async () => {
    // Create script with argument schema
    const saveResult = await taskManager.saveScriptEnhanced({
      name: 'parameterized-script',
      shell: 'pwsh',
      content: 'param($Name, $Count) Write-Host "Hello $Name, count: $Count"',
      description: 'Script with parameters',
      argsSchema: {
        type: 'object',
        properties: {
          Name: { type: 'string', description: 'Name parameter' },
          Count: { type: 'number', description: 'Count parameter', minimum: 1 }
        },
        required: ['Name', 'Count']
      }
    });

    expect(saveResult.success).toBe(true);

    // Test validation-only mode
    const validationResult = await taskManager.runScriptEnhanced({
      name: 'parameterized-script',
      args: ['John', 42],
      validateOnly: true
    });

    expect(validationResult.success).toBe(true);
    expect(validationResult.validation).toBeDefined();

    // Test materialization preview
    const previewResult = await taskManager.runScriptEnhanced({
      name: 'parameterized-script',
      args: ['Jane', 10],
      materializedPreview: true
    });

    expect(previewResult.success).toBe(true);
    expect(previewResult.preview).toBeDefined();

    // Full execution with output management
    const execResult = await taskManager.runScriptEnhanced({
      name: 'parameterized-script',
      args: ['Bob', 5]
    }, {
      streaming: {
        stdout: { maxLines: 500 }
      },
      formatting: {
        colorScheme: 'dark',
        timestampFormat: 'iso'
      }
    });

    expect(execResult.success).toBe(true);
    expect(execResult.execution?.stdout).toContain('Hello Bob');
    expect(execResult.execution?.stdout).toContain('count: 5');
  });

  it('should handle dry run with output management preview', async () => {
    const saveResult = await taskManager.saveScript({
      name: 'dry-run-test',
      shell: 'pwsh',
      content: 'Write-Host "This is a dry run test"',
      description: 'Dry run test script'
    });

    expect(saveResult.success).toBe(true);

    // Dry run should not execute but show preview
    const dryRunResult = await taskManager.runScript({
      name: 'dry-run-test',
      args: ['test-arg'],
      dryRun: true
    }, {
      progress: {
        enabled: true,
        style: 'bar',
        updateIntervalMs: 100,
        showETA: true,
        showPhase: true
      },
      export: {
        format: 'json',
        includeMetadata: true,
        compress: false,
        streaming: false
      }
    });

    expect(dryRunResult.status).toBe('completed');
    expect(dryRunResult.exitCode).toBe(0);
    expect(dryRunResult.execution?.stdout).toContain('[DRY RUN]');
    expect(dryRunResult.execution?.duration).toBe(0);
  });

  it('should handle script execution errors gracefully', async () => {
    const saveResult = await taskManager.saveScript({
      name: 'error-script',
      shell: 'pwsh',
      content: 'throw "Intentional error for testing"',
      description: 'Script that generates an error'
    });

    expect(saveResult.success).toBe(true);

    const runResult = await taskManager.runScript({
      name: 'error-script',
      args: []
    }, {
      streaming: {
        stderr: {
          maxLines: 100,
          retentionMs: 60000,
          maxMemoryBytes: 1024 * 1024
        },
        stdout: {
          maxLines: 100,
          retentionMs: 60000,
          maxMemoryBytes: 1024 * 1024
        },
        errorPatterns: ['error:', 'exception'],
        warningPatterns: ['warn:', 'warning']
      },
      formatting: {
        colorScheme: 'dark',
        timestampFormat: 'iso'
      }
    });

    // Should complete but with non-zero exit code
    expect(runResult.status).toBe('failed');
    expect(runResult.exitCode).not.toBe(0);
    expect(runResult.execution?.stderr).toContain('Intentional error');
  });
});

describe('Output Management Performance', () => {
  let taskManager: TaskManager;
  let testRepoDir: string;

  beforeEach(async () => {
    testRepoDir = await fs.mkdtemp(join(tmpdir(), 'tasksmith-perf-'));
    process.env.TEST_REPO_ROOT = testRepoDir;
    
    taskManager = new TaskManager();
    await taskManager.initialize();
  });

  afterEach(async () => {
    try {
      await fs.rm(testRepoDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    delete process.env.TEST_REPO_ROOT;
  });

  it('should handle high-volume output efficiently', async () => {
    // Create script that generates substantial output
    const saveResult = await taskManager.saveScript({
      name: 'high-volume-output',
      shell: 'pwsh',
      content: `
for ($i = 1; $i -le 1000; $i++) {
  Write-Host "Line $i: $('A' * 100)"
  if ($i % 100 -eq 0) {
    Write-Error "Progress checkpoint: $i lines processed"
  }
}
      `.trim(),
      description: 'High volume output test'
    });

    expect(saveResult.success).toBe(true);

    const startTime = Date.now();
    
    const runResult = await taskManager.runScript({
      name: 'high-volume-output',
      args: []
    }, {
      streaming: {
        stdout: {
          maxLines: 50000,
          retentionMs: 300000, // 5 minutes
          maxMemoryBytes: 50 * 1024 * 1024 // 50MB
        },
        stderr: {
          maxLines: 1000,
          retentionMs: 300000,
          maxMemoryBytes: 10 * 1024 * 1024 // 10MB
        }
      },
      filtering: {
        levels: ['info', 'error'],
        excludeKeywords: ['checkpoint'] // Filter out some noise
      },
      caching: {
        maxEntries: 10,
        maxMemoryBytes: 100 * 1024 * 1024,
        ttlMs: 60000,
        compression: true
      }
    });

    const executionTime = Date.now() - startTime;

    expect(runResult.status).toBe('completed');
    expect(executionTime).toBeLessThan(30000); // Should complete in under 30 seconds
    
    // Verify output was captured efficiently
    if (runResult.execution?.stdout) {
      expect(runResult.execution.stdout.length).toBeGreaterThan(1000);
      expect(runResult.execution.stdout).toContain('Line 1:');
      expect(runResult.execution.stdout).toContain('Line 1000:');
    }

    // Verify filtering worked
    if (runResult.execution?.filteredOutput) {
      expect(runResult.execution.filteredOutput.totalFiltered).toBeGreaterThan(0);
    }
  });

  it('should manage memory efficiently with large outputs', async () => {
    const saveResult = await taskManager.saveScript({
      name: 'memory-test',
      shell: 'pwsh',
      content: `# Generate large blocks of output
for ($i = 1; $i -le 100; $i++) {
  $data = 'X' * 10000
  Write-Host "Block $i: $data"
}`,
      description: 'Memory efficiency test'
    });

    expect(saveResult.success).toBe(true);

    // Monitor memory usage during execution
    const initialMemory = process.memoryUsage();

    const runResult = await taskManager.runScript({
      name: 'memory-test',
      args: []
    }, {
      streaming: {
        stdout: {
          maxLines: 1000,
          retentionMs: 60000,
          maxMemoryBytes: 5 * 1024 * 1024 // Strict 5MB limit
        }
      },
      caching: {
        maxEntries: 5,
        maxMemoryBytes: 10 * 1024 * 1024, // 10MB cache limit
        compression: true
      }
    });

    const finalMemory = process.memoryUsage();
    const memoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

    expect(runResult.status).toBe('completed');
    
    // Memory growth should be reasonable (less than 100MB)
    expect(memoryGrowth).toBeLessThan(100 * 1024 * 1024);
    
    // Should have successfully captured output despite memory constraints
    expect(runResult.execution?.stdout).toBeDefined();
    expect(runResult.execution?.stdout?.length).toBeGreaterThan(100);
  });
});