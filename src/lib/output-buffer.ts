/**
 * OutputBuffer - Circular buffer implementation for efficient real-time output streaming
 * Part of Run Output Management (T130-T143)
 * 
 * Features:
 * - Circular buffer with configurable size limits
 * - Real-time streaming with event emissions
 * - Memory-efficient chunk management
 * - Line-based and byte-based buffering modes
 * - Configurable retention policies
 */

import { EventEmitter } from 'events';
import {
  OutputManagementError,
  MemoryLimitError,
  ConfigurationError,
  withErrorHandling,
  globalErrorHandler
} from './error-handler';

export interface OutputChunk {
  id: string;
  timestamp: Date;
  content: string;
  source: 'stdout' | 'stderr';
  lineNumber: number;
  byteOffset: number;
}

export interface BufferMetrics {
  totalChunks: number;
  totalBytes: number;
  totalLines: number;
  oldestChunk?: Date;
  newestChunk?: Date;
  memoryUsage: number;
}

export interface BufferConfiguration {
  maxChunks: number;
  maxBytes: number;
  maxLines: number;
  retentionMode: 'time' | 'size' | 'count';
  retentionValue: number;
  enableMetrics: boolean;
  chunkIdPrefix: string;
}

export interface StreamingOptions {
  realTime: boolean;
  batchSize: number;
  flushInterval: number;
  enableLineBuffering: boolean;
}

/**
 * High-performance circular buffer for managing script output streams
 * Supports real-time streaming, efficient memory management, and configurable retention
 */
export class OutputBuffer extends EventEmitter {
  private buffer: OutputChunk[] = [];
  private currentIndex: number = 0;
  private totalBytesWritten: number = 0;
  private totalLinesWritten: number = 0;
  private chunkCounter: number = 0;
  private readonly config: BufferConfiguration;
  private readonly streaming: StreamingOptions;
  private flushTimer?: NodeJS.Timeout;
  private pendingChunks: OutputChunk[] = [];

  constructor(
    config: Partial<BufferConfiguration> = {},
    streamingOptions: Partial<StreamingOptions> = {}
  ) {
    super();
    
    this.config = {
      maxChunks: config.maxChunks ?? 10000,
      maxBytes: config.maxBytes ?? 50 * 1024 * 1024, // 50MB default
      maxLines: config.maxLines ?? 100000,
      retentionMode: config.retentionMode ?? 'size',
      retentionValue: config.retentionValue ?? 10 * 1024 * 1024, // 10MB
      enableMetrics: config.enableMetrics ?? true,
      chunkIdPrefix: config.chunkIdPrefix ?? 'chunk'
    };

    this.streaming = {
      realTime: streamingOptions.realTime ?? true,
      batchSize: streamingOptions.batchSize ?? 100,
      flushInterval: streamingOptions.flushInterval ?? 100,
      enableLineBuffering: streamingOptions.enableLineBuffering ?? true
    };

    if (this.streaming.realTime && this.streaming.flushInterval > 0) {
      this.startFlushTimer();
    }
  }

  /**
   * Write content to the buffer
   */
  write(content: string, source: 'stdout' | 'stderr' = 'stdout'): void {
    if (!content) return;

    try {
      // Validate memory limits before writing
      const estimatedSize = Buffer.byteLength(content, 'utf8');
      const currentMemory = this.estimateMemoryUsage();
      const maxMemoryBytes = this.config.maxBytes;
      
      if (currentMemory + estimatedSize > maxMemoryBytes) {
        throw new MemoryLimitError(
          { component: 'OutputBuffer', operation: 'write' },
          Math.round((currentMemory + estimatedSize) / (1024 * 1024)),
          Math.round(maxMemoryBytes / (1024 * 1024))
        );
      }

      const chunk: OutputChunk = {
        id: `${this.config.chunkIdPrefix}-${++this.chunkCounter}`,
        timestamp: new Date(),
        content,
        source,
        lineNumber: this.totalLinesWritten + this.countLines(content),
        byteOffset: this.totalBytesWritten
      };

      this.addChunk(chunk);
      this.updateMetrics(chunk);
      this.enforceRetentionPolicy();

      if (this.streaming.realTime) {
        if (this.streaming.enableLineBuffering && content.includes('\n')) {
          this.flushPending();
          this.emit('data', chunk);
        } else {
          this.pendingChunks.push(chunk);
          if (this.pendingChunks.length >= this.streaming.batchSize) {
            this.flushPending();
          }
        }
      }
    } catch (error) {
      this.emit('error', error);
      
      // Apply degraded mode - still write but with warnings
      if (error instanceof MemoryLimitError) {
        this.handleMemoryPressure(content, source);
      } else {
        throw error;
      }
    }
  }

  /**
   * Handle memory pressure by applying degraded mode
   */
  private handleMemoryPressure(content: string, source: 'stdout' | 'stderr'): void {
    // Truncate content if too large
    const maxContentLength = 1000;
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + '... [TRUNCATED DUE TO MEMORY PRESSURE]'
      : content;

    // Force cleanup of old data
    const oldMaxChunks = this.config.maxChunks;
    this.config.maxChunks = Math.floor(this.config.maxChunks * 0.5); // Reduce by 50%
    this.enforceRetentionPolicy();
    this.config.maxChunks = oldMaxChunks; // Restore original limit

    // Create degraded chunk
    const chunk: OutputChunk = {
      id: `${this.config.chunkIdPrefix}-${++this.chunkCounter}-degraded`,
      timestamp: new Date(),
      content: truncatedContent,
      source,
      lineNumber: this.totalLinesWritten + this.countLines(truncatedContent),
      byteOffset: this.totalBytesWritten
    };

    this.addChunk(chunk);
    this.updateMetrics(chunk);
    
    this.emit('warning', {
      type: 'memory_pressure',
      message: 'Applied degraded mode due to memory pressure',
      originalLength: content.length,
      truncatedLength: truncatedContent.length
    });
  }

  /**
   * Write multiple lines at once
   */
  writeLines(lines: string[], source: 'stdout' | 'stderr' = 'stdout'): void {
    const content = lines.join('\n') + (lines.length > 0 ? '\n' : '');
    this.write(content, source);
  }

  /**
   * Get buffer contents within a range
   */
  getRange(start: number = 0, end?: number): OutputChunk[] {
    const actualEnd = end ?? this.buffer.length;
    return this.buffer.slice(start, actualEnd).filter(chunk => chunk !== undefined);
  }

  /**
   * Get recent chunks (last N chunks)
   */
  getRecent(count: number): OutputChunk[] {
    const start = Math.max(0, this.buffer.length - count);
    return this.getRange(start);
  }

  /**
   * Search buffer contents
   */
  search(query: string | RegExp, source?: 'stdout' | 'stderr'): OutputChunk[] {
    const searchFn = typeof query === 'string' 
      ? (content: string) => content.includes(query)
      : (content: string) => query.test(content);

    return this.buffer.filter(chunk => 
      chunk && 
      searchFn(chunk.content) &&
      (!source || chunk.source === source)
    );
  }

  /**
   * Get chunks within a time range
   */
  getTimeRange(startTime: Date, endTime: Date): OutputChunk[] {
    return this.buffer.filter(chunk => 
      chunk &&
      chunk.timestamp >= startTime && 
      chunk.timestamp <= endTime
    );
  }

  /**
   * Get all content as a single string
   */
  getFullContent(source?: 'stdout' | 'stderr'): string {
    return this.buffer
      .filter(chunk => chunk && (!source || chunk.source === source))
      .map(chunk => chunk.content)
      .join('');
  }

  /**
   * Clear the buffer
   */
  clear(): void {
    this.buffer = [];
    this.currentIndex = 0;
    this.totalBytesWritten = 0;
    this.totalLinesWritten = 0;
    this.chunkCounter = 0;
    this.pendingChunks = [];
    this.emit('cleared');
  }

  /**
   * Get current buffer metrics
   */
  getMetrics(): BufferMetrics {
    const validChunks = this.buffer.filter(chunk => chunk !== undefined);
    const timestamps = validChunks.map(chunk => chunk.timestamp);
    
    return {
      totalChunks: validChunks.length,
      totalBytes: this.totalBytesWritten,
      totalLines: this.totalLinesWritten,
      oldestChunk: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
      newestChunk: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined,
      memoryUsage: this.estimateMemoryUsage()
    };
  }

  /**
   * Enable/disable real-time streaming
   */
  setRealTimeStreaming(enabled: boolean): void {
    this.streaming.realTime = enabled;
    if (enabled) {
      this.startFlushTimer();
    } else {
      this.stopFlushTimer();
    }
  }

  /**
   * Force flush pending chunks
   */
  flush(): void {
    this.flushPending();
  }

  /**
   * Destroy the buffer and clean up resources
   */
  destroy(): void {
    this.stopFlushTimer();
    this.clear();
    this.removeAllListeners();
  }

  private addChunk(chunk: OutputChunk): void {
    if (this.buffer.length < this.config.maxChunks) {
      this.buffer.push(chunk);
    } else {
      // Circular buffer - overwrite oldest
      this.buffer[this.currentIndex] = chunk;
      this.currentIndex = (this.currentIndex + 1) % this.config.maxChunks;
    }
  }

  private updateMetrics(chunk: OutputChunk): void {
    this.totalBytesWritten += Buffer.byteLength(chunk.content, 'utf8');
    this.totalLinesWritten += this.countLines(chunk.content);
  }

  private enforceRetentionPolicy(): void {
    if (this.config.retentionMode === 'size' && this.totalBytesWritten > this.config.retentionValue) {
      this.trimBySize();
    } else if (this.config.retentionMode === 'count' && this.buffer.length > this.config.retentionValue) {
      this.trimByCount();
    } else if (this.config.retentionMode === 'time') {
      this.trimByTime();
    }
  }

  private trimBySize(): void {
    while (this.totalBytesWritten > this.config.retentionValue && this.buffer.length > 0) {
      const oldestChunk = this.buffer.shift();
      if (oldestChunk) {
        this.totalBytesWritten -= Buffer.byteLength(oldestChunk.content, 'utf8');
        this.totalLinesWritten -= this.countLines(oldestChunk.content);
      }
    }
  }

  private trimByCount(): void {
    while (this.buffer.length > this.config.retentionValue) {
      const oldestChunk = this.buffer.shift();
      if (oldestChunk) {
        this.totalBytesWritten -= Buffer.byteLength(oldestChunk.content, 'utf8');
        this.totalLinesWritten -= this.countLines(oldestChunk.content);
      }
    }
  }

  private trimByTime(): void {
    const cutoffTime = new Date(Date.now() - this.config.retentionValue);
    while (this.buffer.length > 0 && this.buffer[0] && this.buffer[0].timestamp < cutoffTime) {
      const oldestChunk = this.buffer.shift();
      if (oldestChunk) {
        this.totalBytesWritten -= Buffer.byteLength(oldestChunk.content, 'utf8');
        this.totalLinesWritten -= this.countLines(oldestChunk.content);
      }
    }
  }

  private countLines(content: string): number {
    return (content.match(/\n/g) || []).length;
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let usage = 0;
    this.buffer.forEach(chunk => {
      if (chunk) {
        usage += Buffer.byteLength(JSON.stringify(chunk), 'utf8');
      }
    });
    return usage;
  }

  private startFlushTimer(): void {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flushPending();
    }, this.streaming.flushInterval);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  private flushPending(): void {
    if (this.pendingChunks.length > 0) {
      const chunks = [...this.pendingChunks];
      this.pendingChunks = [];
      this.emit('batch', chunks);
    }
  }
}