/**
 * Performance Benchmarking Suite for Output Management System
 * Comprehensive performance testing for streaming, caching, export operations, and memory usage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OutputBuffer } from '../src/lib/output-buffer';
import { StreamManager } from '../src/lib/stream-manager';
import { ProgressTracker } from '../src/lib/progress-tracker';
import { OutputFormatter } from '../src/lib/output-formatter';
import { OutputFilter } from '../src/lib/output-filter';
import { ResultCache } from '../src/lib/result-cache';
import { OutputExporter } from '../src/lib/output-exporter';
import { globalErrorHandler } from '../src/lib/error-handler';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Performance metrics interface
 */
interface PerformanceMetrics {
  operationName: string;
  executionTimeMs: number;
  memoryUsageMB: number;
  throughputItemsPerSecond: number;
  peakMemoryMB?: number;
  cpuUsagePercent?: number;
  errorRate?: number;
  degradationFactor?: number;
}

/**
 * Performance test configuration
 */
interface PerformanceTestConfig {
  dataSetSizes: number[];
  iterations: number;
  memoryLimitMB: number;
  timeoutMs: number;
  concurrencyLevels: number[];
}

/**
 * Performance profiler utility
 */
class PerformanceProfiler {
  private startTime: number = 0;
  private startMemory: number = 0;
  private peakMemory: number = 0;
  private memoryInterval: NodeJS.Timeout | null = null;

  start(): void {
    this.startTime = performance.now();
    this.startMemory = this.getMemoryUsageMB();
    this.peakMemory = this.startMemory;
    
    // Monitor memory usage during operation
    this.memoryInterval = setInterval(() => {
      const current = this.getMemoryUsageMB();
      if (current > this.peakMemory) {
        this.peakMemory = current;
      }
    }, 100);
  }

  stop(): PerformanceMetrics {
    const executionTime = performance.now() - this.startTime;
    const endMemory = this.getMemoryUsageMB();
    
    if (this.memoryInterval) {
      clearInterval(this.memoryInterval);
      this.memoryInterval = null;
    }

    return {
      operationName: '',
      executionTimeMs: executionTime,
      memoryUsageMB: endMemory - this.startMemory,
      throughputItemsPerSecond: 0,
      peakMemoryMB: this.peakMemory
    };
  }

  private getMemoryUsageMB(): number {
    const usage = process.memoryUsage();
    return Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100;
  }
}

/**
 * Test data generator
 */
class TestDataGenerator {
  static generateLogLines(count: number, avgLength: number = 100): string[] {
    const lines: string[] = [];
    const logLevels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    const components = ['Server', 'Database', 'API', 'Cache', 'Worker'];
    
    for (let i = 0; i < count; i++) {
      const level = logLevels[Math.floor(Math.random() * logLevels.length)];
      const component = components[Math.floor(Math.random() * components.length)];
      const message = 'A'.repeat(Math.floor(Math.random() * avgLength) + 50);
      
      lines.push(`[${new Date().toISOString()}] ${level} [${component}] Line ${i}: ${message}`);
    }
    
    return lines;
  }

  static generateLargeContent(sizeMB: number): string {
    const bytesPerMB = 1024 * 1024;
    const targetBytes = sizeMB * bytesPerMB;
    const lineLength = 200;
    const linesNeeded = Math.floor(targetBytes / lineLength);
    
    return this.generateLogLines(linesNeeded, lineLength).join('\n');
  }

  static generateOutputChunks(count: number): any[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `chunk-${i}`,
      content: `Test content for chunk ${i} with some variable length data that simulates real output`,
      timestamp: new Date(Date.now() + i * 1000),
      source: i % 2 === 0 ? 'stdout' : 'stderr',
      lineNumber: i + 1,
      byteOffset: i * 100
    }));
  }
}

describe('Output Management Performance Benchmarks', () => {
  let tempDir: string;
  let profiler: PerformanceProfiler;

  const testConfig: PerformanceTestConfig = {
    dataSetSizes: [1000, 5000, 10000, 50000],
    iterations: 3,
    memoryLimitMB: 100,
    timeoutMs: 30000,
    concurrencyLevels: [1, 5, 10]
  };

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'perf-test-'));
    profiler = new PerformanceProfiler();
    
    // Clear any existing error stats
    globalErrorHandler.reset();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('OutputBuffer Performance', () => {
    it('should handle high-volume sequential writes efficiently', async () => {
      const results: PerformanceMetrics[] = [];

      for (const size of testConfig.dataSetSizes) {
        const buffer = new OutputBuffer({
          maxChunks: size * 2,
          maxBytes: size * 1000,
          maxLines: size * 2,
          retentionMode: 'count',
          retentionValue: size,
          enableMetrics: true,
          chunkIdPrefix: 'perf'
        });

        const testData = TestDataGenerator.generateLogLines(size, 100);
        
        profiler.start();
        
        for (const line of testData) {
          buffer.write(line, 'stdout');
        }
        
        const metrics = profiler.stop();
        metrics.operationName = `OutputBuffer Sequential Write (${size} items)`;
        metrics.throughputItemsPerSecond = size / (metrics.executionTimeMs / 1000);
        
        results.push(metrics);

        // Verify data integrity
        const chunks = buffer.getRange();
        expect(chunks).toHaveLength(size);
        
        buffer.destroy();
      }

      // Performance assertions
      results.forEach(result => {
        expect(result.throughputItemsPerSecond).toBeGreaterThan(1000); // Min 1000 items/sec
        expect(result.peakMemoryMB).toBeLessThan(testConfig.memoryLimitMB);
        console.log(`📊 ${result.operationName}: ${Math.round(result.throughputItemsPerSecond)} items/sec, ${result.peakMemoryMB}MB peak memory`);
      });
    });

    it('should maintain performance with memory pressure', async () => {
      const buffer = new OutputBuffer({
        maxChunks: 5000,
        maxBytes: 10 * 1024 * 1024, // 10MB limit
        maxLines: 5000,
        retentionMode: 'size',
        retentionValue: 10 * 1024 * 1024,
        enableMetrics: true,
        chunkIdPrefix: 'memory-test'
      });

      // Generate data that exceeds memory limit
      const largeContent = TestDataGenerator.generateLargeContent(15); // 15MB of data
      const chunks = largeContent.split('\n');

      profiler.start();
      
      for (const chunk of chunks) {
        buffer.write(chunk, 'stdout');
      }
      
      const metrics = profiler.stop();
      metrics.operationName = 'OutputBuffer Memory Pressure Test';
      
      // Should have handled memory pressure gracefully
      const bufferMetrics = buffer.getMetrics();
      expect(bufferMetrics.memoryUsage).toBeLessThan(15 * 1024 * 1024); // Should not exceed limit significantly in bytes
      
      console.log(`📊 Memory Pressure Test: ${Math.round(bufferMetrics.memoryUsage / 1024 / 1024)}MB actual usage, ${metrics.executionTimeMs}ms execution time`);
      
      buffer.destroy();
    });
  });

  describe('StreamManager Performance', () => {
    it('should handle concurrent stdout/stderr streams efficiently', async () => {
      const streamManager = new StreamManager({
        stdout: { maxChunks: 10000 },
        stderr: { maxChunks: 10000 },
        enableInterleaving: true,
        errorDetectionPatterns: [/ERROR/i],
        warningDetectionPatterns: [/WARN/i]
      });

      const stdoutData = TestDataGenerator.generateLogLines(5000, 80);
      const stderrData = TestDataGenerator.generateLogLines(5000, 80);

      profiler.start();
      
      // Simulate concurrent writing (interleaved)
      for (let i = 0; i < Math.max(stdoutData.length, stderrData.length); i++) {
        if (i < stdoutData.length) {
          streamManager.writeStdout(stdoutData[i]);
        }
        if (i < stderrData.length) {
          streamManager.writeStderr(stderrData[i]);
        }
      }
      
      const metrics = profiler.stop();
      metrics.operationName = 'StreamManager Concurrent Streams';
      metrics.throughputItemsPerSecond = 10000 / (metrics.executionTimeMs / 1000);
      
      // Verify stream integrity
      const combined = streamManager.getCombined();
      expect(combined.length).toBe(10000);
      
      const streamMetrics = streamManager.getMetrics();
      expect(streamMetrics.stdout.chunks).toBe(5000);
      expect(streamMetrics.stderr.chunks).toBe(5000);
      
      console.log(`📊 ${metrics.operationName}: ${Math.round(metrics.throughputItemsPerSecond)} items/sec`);
      
      streamManager.destroy();
    });

    it('should efficiently detect patterns in high-volume streams', async () => {
      const streamManager = new StreamManager({
        stdout: { maxChunks: 20000 },
        stderr: { maxChunks: 20000 },
        enableInterleaving: true,
        errorDetectionPatterns: [/ERROR/i, /FATAL/i, /CRITICAL/i],
        warningDetectionPatterns: [/WARN/i, /WARNING/i, /CAUTION/i]
      });

      // Generate mixed log levels (20% errors, 30% warnings, 50% info)
      const testData: string[] = [];
      const levels = [
        { level: 'ERROR', weight: 0.2 },
        { level: 'WARN', weight: 0.3 },
        { level: 'INFO', weight: 0.5 }
      ];

      for (let i = 0; i < 10000; i++) {
        const rand = Math.random();
        let level = 'INFO';
        let cumWeight = 0;
        
        for (const { level: l, weight } of levels) {
          cumWeight += weight;
          if (rand < cumWeight) {
            level = l;
            break;
          }
        }
        
        testData.push(`[${new Date().toISOString()}] ${level} Message ${i}: Test content for pattern detection`);
      }

      profiler.start();
      
      for (const line of testData) {
        streamManager.writeStdout(line);
      }
      
      const metrics = profiler.stop();
      
      // Verify pattern detection performance
      const errors = streamManager.getErrors();
      const warnings = streamManager.getWarnings();
      
      expect(errors.length).toBeGreaterThan(1500); // ~20% of 10000
      expect(warnings.length).toBeGreaterThan(2500); // ~30% of 10000
      
      console.log(`📊 Pattern Detection: ${errors.length} errors, ${warnings.length} warnings detected in ${metrics.executionTimeMs}ms`);
      
      streamManager.destroy();
    });
  });

  describe('ProgressTracker Performance', () => {
    it('should handle rapid progress updates efficiently', async () => {
      const tracker = new ProgressTracker({
        type: 'spinner',
        refreshRate: 50, // Higher frequency for stress test
        showElapsed: true,
        showETA: true
      });

      profiler.start();
      
      tracker.start(10000);
      
      // Simulate rapid updates
      for (let i = 0; i <= 10000; i += 10) {
        tracker.update(i, `Processing item ${i}`);
        
        // Add some phases
        if (i % 2000 === 0) {
          tracker.setPhase(`Phase ${Math.floor(i / 2000)}`);
        }
      }
      
      tracker.complete('Processing finished');
      
      const metrics = profiler.stop();
      
      const state = tracker.getState();
      expect(state.current).toBe(10000);
      expect(state.percentage).toBe(100);
      
      console.log(`📊 ProgressTracker: 1000 updates in ${metrics.executionTimeMs}ms`);
      
      tracker.stop();
    });
  });

  describe('OutputExporter Performance', () => {
    it('should efficiently export large datasets to multiple formats', async () => {
      const exporter = new OutputExporter();
      const testChunks = TestDataGenerator.generateOutputChunks(20000);

      const formats: ('json' | 'csv' | 'html')[] = ['json', 'csv', 'html'];
      const results: PerformanceMetrics[] = [];

      for (const format of formats) {
        const outputPath = join(tempDir, `large-export.${format}`);
        
        profiler.start();
        
        const result = await exporter.exportToFile(testChunks, outputPath, {
          format,
          includeMetadata: true,
          includeTimestamps: true,
          includeLineNumbers: true,
          includeSource: true,
          compress: false,
          prettyPrint: false
        });
        
        const metrics = profiler.stop();
        metrics.operationName = `Export to ${format.toUpperCase()}`;
        metrics.throughputItemsPerSecond = 20000 / (metrics.executionTimeMs / 1000);
        
        expect(result.success).toBe(true);
        
        // Verify file size
        const stats = await fs.stat(outputPath);
        expect(stats.size).toBeGreaterThan(1000); // Should have substantial content
        
        results.push(metrics);
      }

      results.forEach(result => {
        console.log(`📊 ${result.operationName}: ${Math.round(result.throughputItemsPerSecond)} items/sec, ${result.executionTimeMs}ms`);
      });
    });

    it('should handle streaming export for very large datasets', async () => {
      const exporter = new OutputExporter();
      const largeDataset = TestDataGenerator.generateOutputChunks(100000); // 100k items

      const outputPath = join(tempDir, 'streaming-export.json');
      
      profiler.start();
      
      const result = await exporter.streamExport(largeDataset, outputPath, {
        format: 'json',
        includeMetadata: true,
        includeTimestamps: false, // Reduce overhead
        includeLineNumbers: false,
        includeSource: true,
        compress: true, // Test compression performance
        prettyPrint: false,
        chunkSize: 5000
      });
      
      const metrics = profiler.stop();
      
      expect(result.success).toBe(true);
      
      // Verify compressed file
      const stats = await fs.stat(outputPath);
      expect(stats.size).toBeGreaterThan(1000);
      
      console.log(`📊 Streaming Export: 100k items in ${metrics.executionTimeMs}ms, ${Math.round(stats.size / 1024)}KB compressed`);
    });
  });

  describe('ResultCache Performance', () => {
    it('should maintain high hit rates under concurrent access', async () => {
      const cache = new ResultCache({
        maxItems: 1000,
        maxMemoryMB: 50,
        defaultTTL: 3600,
        enableCompression: true,
        compressionThreshold: 500,
        persistent: false // In-memory for performance test
      });

      const testData = Array.from({ length: 500 }, (_, i) => ({
        key: `test-key-${i}`,
        value: { data: TestDataGenerator.generateLogLines(10, 100), index: i }
      }));

      profiler.start();
      
      // Populate cache
      for (const { key, value } of testData) {
        await cache.set(key, value);
      }
      
      // Perform mixed read/write operations (80% reads, 20% writes)
      const operations = 2000;
      let hits = 0;
      
      for (let i = 0; i < operations; i++) {
        const isWrite = Math.random() < 0.2;
        
        if (isWrite) {
          const key = `dynamic-key-${i}`;
          await cache.set(key, { generated: i, data: 'test' });
        } else {
          const key = testData[Math.floor(Math.random() * testData.length)].key;
          const result = await cache.get(key);
          if (result !== null) hits++;
        }
      }
      
      const metrics = profiler.stop();
      const hitRate = (hits / (operations * 0.8)) * 100; // Only count read operations
      
      const stats = cache.getStats();
      
      expect(hitRate).toBeGreaterThan(90); // Should maintain >90% hit rate
      expect(stats.memoryUsageMB).toBeLessThan(50);
      
      console.log(`📊 Cache Performance: ${Math.round(hitRate)}% hit rate, ${operations} ops in ${metrics.executionTimeMs}ms`);
      
      cache.clear();
    });

    it('should handle cache eviction efficiently under memory pressure', async () => {
      const cache = new ResultCache({
        maxItems: 100, // Small limit to force evictions
        maxMemoryMB: 10,
        defaultTTL: 3600,
        enableCompression: true,
        compressionThreshold: 100
      });

      profiler.start();
      
      // Insert more items than cache can hold
      for (let i = 0; i < 500; i++) {
        const largeData = {
          id: i,
          content: TestDataGenerator.generateLogLines(20, 200), // ~4KB per entry
          metadata: { created: new Date(), index: i }
        };
        
        await cache.set(`item-${i}`, largeData);
      }
      
      const metrics = profiler.stop();
      const stats = cache.getStats();
      
      expect(stats.items).toBeLessThanOrEqual(100);
      expect(stats.memoryUsageMB).toBeLessThanOrEqual(10);
      
      console.log(`📊 Cache Eviction: ${stats.items} items retained, ${stats.memoryUsageMB}MB memory usage`);
      
      cache.clear();
    });
  });

  describe('Concurrent Operations Performance', () => {
    it('should handle multiple components operating concurrently', async () => {
      const components = {
        buffer: new OutputBuffer({
          maxChunks: 5000,
          maxBytes: 10 * 1024 * 1024,
          maxLines: 5000,
          retentionMode: 'count',
          retentionValue: 5000,
          enableMetrics: true,
          chunkIdPrefix: 'concurrent'
        }),
        stream: new StreamManager({
          stdout: { maxChunks: 5000 },
          stderr: { maxChunks: 5000 },
          enableInterleaving: true,
          errorDetectionPatterns: [/ERROR/i],
          warningDetectionPatterns: [/WARN/i]
        }),
        cache: new ResultCache({
          maxItems: 500,
          maxMemoryMB: 25,
          defaultTTL: 1800,
          persistent: false
        })
      };

      const testData = TestDataGenerator.generateLogLines(2000, 150);
      
      profiler.start();
      
      // Simulate concurrent operations
      const promises = [
        // Buffer operations
        Promise.resolve().then(async () => {
          for (const line of testData.slice(0, 1000)) {
            components.buffer.write(line, 'stdout');
          }
        }),
        
        // Stream operations
        Promise.resolve().then(async () => {
          for (const line of testData.slice(1000, 2000)) {
            components.stream.writeStdout(line);
          }
        }),
        
        // Cache operations
        Promise.resolve().then(async () => {
          for (let i = 0; i < 200; i++) {
            await components.cache.set(`concurrent-${i}`, { data: testData[i], index: i });
          }
        }),
        
        // Export operation
        Promise.resolve().then(async () => {
          const exporter = new OutputExporter();
          const chunks = TestDataGenerator.generateOutputChunks(500);
          const outputPath = join(tempDir, 'concurrent-export.json');
          
          return exporter.exportToFile(chunks, outputPath, {
            format: 'json',
            includeMetadata: false,
            includeTimestamps: false,
            includeLineNumbers: false,
            includeSource: false,
            compress: false,
            prettyPrint: false
          });
        })
      ];
      
      await Promise.all(promises);
      
      const metrics = profiler.stop();
      
      // Verify all operations completed successfully
      expect(components.buffer.getRange().length).toBe(1000);
      expect(components.stream.getStdout().length).toBe(1000);
      
      const cacheStats = components.cache.getStats();
      expect(cacheStats.items).toBe(200);
      
      console.log(`📊 Concurrent Operations: ${metrics.executionTimeMs}ms total time, ${metrics.peakMemoryMB}MB peak memory`);
      
      // Cleanup
      components.buffer.destroy();
      components.stream.destroy();
      components.cache.clear();
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not leak memory during extended operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      
      // Run multiple cycles of operations
      for (let cycle = 0; cycle < 5; cycle++) {
        const buffer = new OutputBuffer({
          maxChunks: 1000,
          maxBytes: 5 * 1024 * 1024,
          maxLines: 1000,
          retentionMode: 'count',
          retentionValue: 1000,
          enableMetrics: true,
          chunkIdPrefix: `cycle-${cycle}`
        });

        // Fill and empty buffer
        const testData = TestDataGenerator.generateLogLines(2000, 100);
        for (const line of testData) {
          buffer.write(line, 'stdout');
        }
        
        // Force cleanup
        buffer.clear();
        buffer.destroy();
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be minimal (< 10MB)
      expect(memoryGrowth).toBeLessThan(10);
      
      console.log(`📊 Memory Leak Test: ${Math.round(memoryGrowth * 100) / 100}MB growth after 5 cycles`);
    });
  });
});