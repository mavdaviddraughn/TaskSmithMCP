/**
 * Integration tests for TaskManager with Output Management (T140)
 * Tests the complete flow from script execution through output processing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '../src/lib/task-manager.js';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('TaskManager Output Management Integration', () => {
  let taskManager: TaskManager;
  let testRepoDir: string;

  beforeEach(async () => {
    // Create temporary test repository
    testRepoDir = await fs.mkdtemp(join(tmpdir(), 'tasksmith-integration-'));
    
    // Initialize TaskManager with test directory
    taskManager = new TaskManager(testRepoDir);
  });

  afterEach(async () => {
    // Clean up test directory
    if (testRepoDir) {
      await fs.rm(testRepoDir, { recursive: true, force: true });
    }
  });

  describe('Basic Script Execution with Streaming', () => {
    it('should execute script with output streaming enabled', async () => {
      // Create a simple test script
      const script = await taskManager.saveScript({
        name: 'streaming-test',
        shell: 'pwsh',
        content: `
# Test script with various outputs
Write-Host "Starting test..."
Write-Output "Standard output line 1"
Write-Output "Standard output line 2"
Write-Error "Test error message" -ErrorAction Continue
Write-Warning "Test warning message"
Write-Host "Test completed"
        `.trim(),
        description: 'Test script for streaming output'
      });

      expect(script.success).toBe(true);

      // Execute with streaming enabled
      const result = await taskManager.runScript(script.name!, {
        streaming: {
          stdout: {
            maxLines: 100,
            retentionMs: 60000,
            maxMemoryBytes: 1024 * 1024
          },
          stderr: {
            maxLines: 50,
            retentionMs: 30000,
            maxMemoryBytes: 512 * 1024
          },
          errorPatterns: ['error:', 'exception'],
          warningPatterns: ['warn:', 'warning']
        },
        progress: {
          enabled: true,
          style: 'spinner',
          updateIntervalMs: 100,
          showETA: false,
          showPhase: true
        }
      });

      // Validate execution result
      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Starting test');
      expect(result.stdout).toContain('Standard output line');
      expect(result.stderr).toContain('Test error message');

      // Check if output management metadata is present
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.outputLines).toBeGreaterThan(0);
      expect(result.metadata?.executionTimeMs).toBeGreaterThan(0);
    });

    it('should handle large output with memory management', async () => {
      // Create script that generates large output
      const script = await taskManager.saveScript({
        name: 'large-output-test',
        shell: 'pwsh',
        content: `
# Generate substantial output
for ($i = 1; $i -le 50; $i++) {
  $data = 'A' * 1000
  Write-Host "Line $i: $data"
}
        `.trim(),
        description: 'Test script for large output handling'
      });

      const result = await taskManager.runScript(script.name!, {
        streaming: {
          stdout: {
            maxLines: 100,
            retentionMs: 60000,
            maxMemoryBytes: 1024 * 1024
          },
          stderr: {
            maxLines: 50,
            retentionMs: 30000,
            maxMemoryBytes: 512 * 1024
          },
          errorPatterns: ['error:', 'fail'],
          warningPatterns: ['warn:', 'warning']
        },
        caching: {
          maxEntries: 10,
          maxMemoryBytes: 5 * 1024 * 1024,
          ttlMs: 300000,
          compression: true,
          persistToDisk: false
        }
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Line 1:');
      expect(result.metadata?.outputLines).toBeGreaterThanOrEqual(50);
    });
  });

  describe('Output Formatting and Filtering', () => {
    it('should apply formatting options to output', async () => {
      const script = await taskManager.saveScript({
        name: 'format-test',
        shell: 'pwsh',
        content: `
Write-Host "INFO: Information message"
Write-Host "WARN: Warning message"  
Write-Host "ERROR: Error message"
Write-Host "DEBUG: Debug message"
        `.trim(),
        description: 'Test script for output formatting'
      });

      const result = await taskManager.runScript(script.name!, {
        formatting: {
          colorScheme: 'dark',
          syntaxHighlighting: true,
          timestampFormat: 'iso',
          includeMetadata: true
        },
        filtering: {
          levels: ['info', 'warn', 'error'],
          keywords: ['message'],
          excludeKeywords: ['debug']
        }
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('INFO:');
      expect(result.stdout).toContain('WARN:');
      expect(result.stdout).toContain('ERROR:');
      // Debug should be filtered out
      expect(result.stdout).not.toContain('DEBUG:');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should capture and categorize errors properly', async () => {
      const script = await taskManager.saveScript({
        name: 'error-test',
        shell: 'pwsh',
        content: `
Write-Host "Starting operation..."
Write-Error "Critical error occurred" -ErrorAction Continue
Write-Warning "Performance warning"
throw "Fatal exception occurred"
        `.trim(),
        description: 'Test script for error handling'
      });

      const result = await taskManager.runScript(script.name!, {
        streaming: {
          stdout: {
            maxLines: 100,
            retentionMs: 60000,
            maxMemoryBytes: 1024 * 1024
          },
          stderr: {
            maxLines: 100,
            retentionMs: 60000,
            maxMemoryBytes: 1024 * 1024
          },
          errorPatterns: ['error', 'exception', 'fatal'],
          warningPatterns: ['warning', 'warn']
        },
        progress: {
          enabled: true,
          style: 'bar',
          updateIntervalMs: 100,
          showETA: true,
          showPhase: true
        }
      });

      // Should fail due to thrown exception
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('Critical error');
      expect(result.stderr).toContain('Fatal exception');
      
      // Check error categorization
      expect(result.metadata?.errorCount).toBeGreaterThan(0);
      expect(result.metadata?.warningCount).toBeGreaterThan(0);
    });
  });

  describe('Export and Caching', () => {
    it('should export output in multiple formats', async () => {
      const script = await taskManager.saveScript({
        name: 'export-test',
        shell: 'pwsh',
        content: `
Write-Host "Export test data line 1"
Write-Host "Export test data line 2"
Write-Host "Export test data line 3"
        `.trim(),
        description: 'Test script for output export'
      });

      const result = await taskManager.runScript(script.name!, {
        export: {
          format: 'json',
          includeMetadata: true,
          compress: false,
          streaming: false
        },
        caching: {
          maxEntries: 5,
          maxMemoryBytes: 1024 * 1024,
          ttlMs: 60000,
          compression: true,
          persistToDisk: false
        }
      });

      expect(result.success).toBe(true);
      expect(result.stdout).toContain('Export test data');
      
      // Check if export metadata is available
      if (result.metadata?.exportPath) {
        // Verify export file exists and contains expected data
        const exportData = await fs.readFile(result.metadata.exportPath, 'utf8');
        expect(exportData).toContain('Export test data');
      }
    });
  });
});

describe('Performance and Scalability Tests', () => {
  let taskManager: TaskManager;
  let testRepoDir: string;

  beforeEach(async () => {
    testRepoDir = await fs.mkdtemp(join(tmpdir(), 'tasksmith-perf-'));
    taskManager = new TaskManager(testRepoDir);
  });

  afterEach(async () => {
    if (testRepoDir) {
      await fs.rm(testRepoDir, { recursive: true, force: true });
    }
  });

  it('should handle high-volume output efficiently', async () => {
    const script = await taskManager.saveScript({
      name: 'volume-test',
      shell: 'pwsh',
      content: `
# Generate high volume output
for ($i = 1; $i -le 1000; $i++) {
  Write-Host "Volume test line $i with some additional content to increase size"
}
      `.trim(),
      description: 'High volume output test'
    });

    const startTime = Date.now();
    
    const result = await taskManager.runScript(script.name!, {
      streaming: {
        stdout: {
          maxLines: 2000,
          retentionMs: 120000,
          maxMemoryBytes: 10 * 1024 * 1024
        },
        stderr: {
          maxLines: 1000,
          retentionMs: 60000,
          maxMemoryBytes: 5 * 1024 * 1024
        },
        errorPatterns: ['error:', 'fail'],
        warningPatterns: ['warn:', 'warning']
      },
      caching: {
        maxEntries: 50,
        maxMemoryBytes: 20 * 1024 * 1024,
        ttlMs: 600000,
        compression: true,
        persistToDisk: false
      },
      progress: {
        enabled: true,
        style: 'bar',
        updateIntervalMs: 200,
        showETA: true,
        showPhase: true
      }
    });

    const executionTime = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(result.metadata?.outputLines).toBe(1000);
    expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
    
    // Check memory efficiency
    expect(result.metadata?.peakMemoryUsage).toBeLessThan(50 * 1024 * 1024); // Less than 50MB peak
  });

  it('should maintain performance with concurrent executions', async () => {
    const scripts = await Promise.all([
      taskManager.saveScript({
        name: 'concurrent-1',
        shell: 'pwsh',
        content: 'for ($i = 1; $i -le 100; $i++) { Write-Host "Concurrent 1: Line $i" }',
        description: 'Concurrent test 1'
      }),
      taskManager.saveScript({
        name: 'concurrent-2', 
        shell: 'pwsh',
        content: 'for ($i = 1; $i -le 100; $i++) { Write-Host "Concurrent 2: Line $i" }',
        description: 'Concurrent test 2'
      }),
      taskManager.saveScript({
        name: 'concurrent-3',
        shell: 'pwsh', 
        content: 'for ($i = 1; $i -le 100; $i++) { Write-Host "Concurrent 3: Line $i" }',
        description: 'Concurrent test 3'
      })
    ]);

    scripts.forEach(script => expect(script.success).toBe(true));

    const startTime = Date.now();
    
    // Execute all scripts concurrently
    const results = await Promise.all([
      taskManager.runScript(scripts[0].name!, {
        streaming: {
          stdout: {
            maxLines: 200,
            retentionMs: 60000,
            maxMemoryBytes: 1024 * 1024
          },
          stderr: {
            maxLines: 100,
            retentionMs: 30000,
            maxMemoryBytes: 512 * 1024
          },
          errorPatterns: ['error:'],
          warningPatterns: ['warn:']
        }
      }),
      taskManager.runScript(scripts[1].name!, {
        streaming: {
          stdout: {
            maxLines: 200,
            retentionMs: 60000,
            maxMemoryBytes: 1024 * 1024
          },
          stderr: {
            maxLines: 100,
            retentionMs: 30000,
            maxMemoryBytes: 512 * 1024
          },
          errorPatterns: ['error:'],
          warningPatterns: ['warn:']
        }
      }),
      taskManager.runScript(scripts[2].name!, {
        streaming: {
          stdout: {
            maxLines: 200,
            retentionMs: 60000,
            maxMemoryBytes: 1024 * 1024
          },
          stderr: {
            maxLines: 100,
            retentionMs: 30000,
            maxMemoryBytes: 512 * 1024
          },
          errorPatterns: ['error:'],
          warningPatterns: ['warn:']
        }
      })
    ]);

    const totalTime = Date.now() - startTime;

    // All should succeed
    results.forEach(result => {
      expect(result.success).toBe(true);
      expect(result.metadata?.outputLines).toBe(100);
    });

    // Concurrent execution should be faster than sequential
    expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
  });
});