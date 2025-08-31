/**
 * StreamManager - Dual-stream output management with independent stdout/stderr handling
 * Part of Run Output Management (T130-T143)
 * 
 * Features:
 * - Independent stdout/stderr buffers
 * - Stream-specific filtering and formatting
 * - Combined stream view with proper interleaving
 * - Stream isolation and redirection
 * - Error detection and highlighting
 */

import { EventEmitter } from 'events';
import { OutputBuffer, OutputChunk, BufferConfiguration, StreamingOptions } from './output-buffer.js';

export interface StreamConfiguration {
  stdout: Partial<BufferConfiguration>;
  stderr: Partial<BufferConfiguration>;
  enableInterleaving: boolean;
  errorDetectionPatterns: RegExp[];
  warningDetectionPatterns: RegExp[];
}

export interface StreamMetrics {
  stdout: {
    chunks: number;
    bytes: number;
    lines: number;
  };
  stderr: {
    chunks: number;
    bytes: number;
    lines: number;
  };
  combined: {
    totalChunks: number;
    totalBytes: number;
    totalLines: number;
    errorCount: number;
    warningCount: number;
  };
}

export interface StreamFilter {
  stream?: 'stdout' | 'stderr' | 'both';
  patterns?: RegExp[];
  keywords?: string[];
  levels?: ('error' | 'warning' | 'info' | 'debug')[];
  timeRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Manages separate stdout and stderr streams with independent buffering and filtering
 */
export class StreamManager extends EventEmitter {
  private stdoutBuffer!: OutputBuffer;
  private stderrBuffer!: OutputBuffer;
  private readonly config: StreamConfiguration;
  private readonly streamingOptions: StreamingOptions;
  private combinedView: OutputChunk[] = [];
  private errorCount: number = 0;
  private warningCount: number = 0;

  constructor(
    config: Partial<StreamConfiguration> = {},
    streamingOptions: Partial<StreamingOptions> = {}
  ) {
    super();

    this.config = {
      stdout: config.stdout ?? {},
      stderr: config.stderr ?? { 
        chunkIdPrefix: 'stderr-chunk',
        maxChunks: 5000 // Smaller buffer for stderr by default
      },
      enableInterleaving: config.enableInterleaving ?? true,
      errorDetectionPatterns: config.errorDetectionPatterns ?? [
        /error/i,
        /exception/i,
        /fatal/i,
        /fail/i,
        /\[ERROR\]/i,
        /ERROR:/i
      ],
      warningDetectionPatterns: config.warningDetectionPatterns ?? [
        /warn/i,
        /warning/i,
        /\[WARN\]/i,
        /WARNING:/i,
        /deprecated/i
      ]
    };

    this.streamingOptions = {
      realTime: streamingOptions.realTime ?? true,
      batchSize: streamingOptions.batchSize ?? 50,
      flushInterval: streamingOptions.flushInterval ?? 100,
      enableLineBuffering: streamingOptions.enableLineBuffering ?? true
    };

    this.initializeBuffers();
    this.setupEventHandlers();
  }

  /**
   * Write to stdout stream
   */
  writeStdout(content: string): void {
    this.stdoutBuffer.write(content, 'stdout');
    this.updateCombinedView();
  }

  /**
   * Write to stderr stream
   */
  writeStderr(content: string): void {
    this.stderrBuffer.write(content, 'stderr');
    this.detectErrorsAndWarnings(content);
    this.updateCombinedView();
  }

  /**
   * Write to both streams simultaneously (for debugging)
   */
  writeBoth(content: string): void {
    const timestamp = new Date();
    this.writeStdout(`[STDOUT] ${content}`);
    this.writeStderr(`[STDERR] ${content}`);
  }

  /**
   * Get stdout buffer contents
   */
  getStdout(start?: number, end?: number): OutputChunk[] {
    return this.stdoutBuffer.getRange(start, end);
  }

  /**
   * Get stderr buffer contents
   */
  getStderr(start?: number, end?: number): OutputChunk[] {
    return this.stderrBuffer.getRange(start, end);
  }

  /**
   * Get combined, time-ordered view of both streams
   */
  getCombined(start?: number, end?: number): OutputChunk[] {
    if (!this.config.enableInterleaving) {
      // Return streams separately if interleaving disabled
      return [...this.getStdout(), ...this.getStderr()];
    }

    const actualEnd = end ?? this.combinedView.length;
    return this.combinedView.slice(start ?? 0, actualEnd);
  }

  /**
   * Search across streams with filtering
   */
  search(query: string | RegExp, filter?: StreamFilter): OutputChunk[] {
    let results: OutputChunk[] = [];

    // Determine which streams to search
    const searchStdout = !filter?.stream || filter.stream === 'stdout' || filter.stream === 'both';
    const searchStderr = !filter?.stream || filter.stream === 'stderr' || filter.stream === 'both';

    if (searchStdout) {
      results = results.concat(this.stdoutBuffer.search(query));
    }

    if (searchStderr) {
      results = results.concat(this.stderrBuffer.search(query));
    }

    // Apply additional filters
    if (filter) {
      results = this.applyStreamFilter(results, filter);
    }

    // Sort by timestamp if interleaving enabled
    if (this.config.enableInterleaving) {
      results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    }

    return results;
  }

  /**
   * Get recent chunks from both streams
   */
  getRecent(count: number, stream?: 'stdout' | 'stderr' | 'both'): OutputChunk[] {
    switch (stream) {
      case 'stdout':
        return this.stdoutBuffer.getRecent(count);
      case 'stderr':
        return this.stderrBuffer.getRecent(count);
      case 'both':
      default:
        return this.getCombined().slice(-count);
    }
  }

  /**
   * Get stream-specific metrics
   */
  getMetrics(): StreamMetrics {
    const stdoutMetrics = this.stdoutBuffer.getMetrics();
    const stderrMetrics = this.stderrBuffer.getMetrics();

    return {
      stdout: {
        chunks: stdoutMetrics.totalChunks,
        bytes: stdoutMetrics.totalBytes,
        lines: stdoutMetrics.totalLines
      },
      stderr: {
        chunks: stderrMetrics.totalChunks,
        bytes: stderrMetrics.totalBytes,
        lines: stderrMetrics.totalLines
      },
      combined: {
        totalChunks: stdoutMetrics.totalChunks + stderrMetrics.totalChunks,
        totalBytes: stdoutMetrics.totalBytes + stderrMetrics.totalBytes,
        totalLines: stdoutMetrics.totalLines + stderrMetrics.totalLines,
        errorCount: this.errorCount,
        warningCount: this.warningCount
      }
    };
  }

  /**
   * Get all errors detected in stderr
   */
  getErrors(): OutputChunk[] {
    return this.stderrBuffer.search(new RegExp(
      this.config.errorDetectionPatterns.map(p => p.source).join('|'), 'i'
    ));
  }

  /**
   * Get all warnings detected in streams
   */
  getWarnings(): OutputChunk[] {
    const warningPattern = new RegExp(
      this.config.warningDetectionPatterns.map(p => p.source).join('|'), 'i'
    );
    
    return [
      ...this.stdoutBuffer.search(warningPattern),
      ...this.stderrBuffer.search(warningPattern)
    ].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Clear specific stream or both
   */
  clear(stream?: 'stdout' | 'stderr' | 'both'): void {
    switch (stream) {
      case 'stdout':
        this.stdoutBuffer.clear();
        break;
      case 'stderr':
        this.stderrBuffer.clear();
        this.errorCount = 0;
        this.warningCount = 0;
        break;
      case 'both':
      default:
        this.stdoutBuffer.clear();
        this.stderrBuffer.clear();
        this.combinedView = [];
        this.errorCount = 0;
        this.warningCount = 0;
        break;
    }

    this.emit('cleared', stream);
  }

  /**
   * Enable/disable interleaved view
   */
  setInterleaving(enabled: boolean): void {
    this.config.enableInterleaving = enabled;
    if (enabled) {
      this.rebuildCombinedView();
    }
  }

  /**
   * Update error detection patterns
   */
  setErrorPatterns(patterns: RegExp[]): void {
    this.config.errorDetectionPatterns = patterns;
  }

  /**
   * Update warning detection patterns
   */
  setWarningPatterns(patterns: RegExp[]): void {
    this.config.warningDetectionPatterns = patterns;
  }

  /**
   * Flush both buffers
   */
  flush(): void {
    this.stdoutBuffer.flush();
    this.stderrBuffer.flush();
  }

  /**
   * Destroy the stream manager and clean up resources
   */
  destroy(): void {
    this.stdoutBuffer.destroy();
    this.stderrBuffer.destroy();
    this.combinedView = [];
    this.removeAllListeners();
  }

  private initializeBuffers(): void {
    this.stdoutBuffer = new OutputBuffer(
      { ...this.config.stdout, chunkIdPrefix: 'stdout-chunk' },
      this.streamingOptions
    );

    this.stderrBuffer = new OutputBuffer(
      this.config.stderr,
      this.streamingOptions
    );
  }

  private setupEventHandlers(): void {
    this.stdoutBuffer.on('data', (chunk: OutputChunk) => {
      this.emit('stdout', chunk);
      this.emit('data', chunk);
    });

    this.stdoutBuffer.on('batch', (chunks: OutputChunk[]) => {
      this.emit('stdout-batch', chunks);
      this.emit('batch', chunks);
    });

    this.stderrBuffer.on('data', (chunk: OutputChunk) => {
      this.emit('stderr', chunk);
      this.emit('data', chunk);
      
      // Check for errors/warnings in real-time
      if (this.isError(chunk.content)) {
        this.emit('error-detected', chunk);
      } else if (this.isWarning(chunk.content)) {
        this.emit('warning-detected', chunk);
      }
    });

    this.stderrBuffer.on('batch', (chunks: OutputChunk[]) => {
      this.emit('stderr-batch', chunks);
      this.emit('batch', chunks);
    });
  }

  private updateCombinedView(): void {
    if (!this.config.enableInterleaving) return;

    // Rebuild combined view by merging both buffers
    this.rebuildCombinedView();
  }

  private rebuildCombinedView(): void {
    const stdoutChunks = this.stdoutBuffer.getRange();
    const stderrChunks = this.stderrBuffer.getRange();

    this.combinedView = [...stdoutChunks, ...stderrChunks]
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  private detectErrorsAndWarnings(content: string): void {
    if (this.isError(content)) {
      this.errorCount++;
    }
    if (this.isWarning(content)) {
      this.warningCount++;
    }
  }

  private isError(content: string): boolean {
    return this.config.errorDetectionPatterns.some(pattern => pattern.test(content));
  }

  private isWarning(content: string): boolean {
    return this.config.warningDetectionPatterns.some(pattern => pattern.test(content));
  }

  private applyStreamFilter(chunks: OutputChunk[], filter: StreamFilter): OutputChunk[] {
    let filtered = chunks;

    // Apply pattern filters
    if (filter.patterns && filter.patterns.length > 0) {
      filtered = filtered.filter(chunk =>
        filter.patterns!.some(pattern => pattern.test(chunk.content))
      );
    }

    // Apply keyword filters
    if (filter.keywords && filter.keywords.length > 0) {
      filtered = filtered.filter(chunk =>
        filter.keywords!.some(keyword => 
          chunk.content.toLowerCase().includes(keyword.toLowerCase())
        )
      );
    }

    // Apply level filters
    if (filter.levels && filter.levels.length > 0) {
      filtered = filtered.filter(chunk => {
        const content = chunk.content.toLowerCase();
        return filter.levels!.some(level => {
          switch (level) {
            case 'error': return this.isError(chunk.content);
            case 'warning': return this.isWarning(chunk.content);
            case 'info': return /info|information/i.test(content);
            case 'debug': return /debug|trace/i.test(content);
            default: return false;
          }
        });
      });
    }

    // Apply time range filter
    if (filter.timeRange) {
      filtered = filtered.filter(chunk =>
        chunk.timestamp >= filter.timeRange!.start &&
        chunk.timestamp <= filter.timeRange!.end
      );
    }

    return filtered;
  }
}