# Output Management System Documentation

## Overview

The Output Management System is a comprehensive framework for handling script execution output in the TaskSmith MCP server. It provides real-time streaming, formatting, filtering, caching, and export capabilities for script output.

## Architecture

The system consists of seven core components:

1. **OutputBuffer** - High-performance circular buffer for output streaming
2. **StreamManager** - Dual-stream stdout/stderr management  
3. **ProgressTracker** - Real-time execution progress indicators
4. **OutputFormatter** - ANSI formatting and syntax highlighting
5. **OutputFilter** - Advanced filtering and search capabilities
6. **ResultCache** - LRU caching with compression and TTL
7. **OutputExporter** - Multi-format export (JSON, CSV, HTML, Markdown)

## Quick Start

### Basic Usage

```typescript
import { TaskManager } from './lib/task-manager';

const taskManager = new TaskManager();
await taskManager.initialize('/path/to/repo');

// Execute script with streaming output
const result = await taskManager.runScript({
  name: 'my-script',
  args: ['arg1', 'arg2']
}, {
  streaming: {
    stdout: {
      maxLines: 1000,
      retentionMs: 60000,
      maxMemoryBytes: 1024 * 1024
    },
    stderr: {
      maxLines: 500,
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
    showETA: true,
    showPhase: true
  }
});

// Access output
console.log(result.execution?.stdout);
console.log(result.execution?.stderr);
```

## Configuration

### StreamConfig Interface

Controls output streaming behavior:

```typescript
interface StreamConfig {
  stdout: BufferConfig;
  stderr: BufferConfig;
  errorPatterns: string[];
  warningPatterns: string[];
}

interface BufferConfig {
  maxLines: number;        // Maximum lines to retain
  retentionMs: number;     // How long to keep output (ms)
  maxMemoryBytes: number;  // Memory limit for buffer
}
```

**Example:**
```typescript
streaming: {
  stdout: {
    maxLines: 2000,
    retentionMs: 120000,  // 2 minutes
    maxMemoryBytes: 2 * 1024 * 1024  // 2MB
  },
  stderr: {
    maxLines: 1000,
    retentionMs: 60000,   // 1 minute
    maxMemoryBytes: 1024 * 1024  // 1MB
  },
  errorPatterns: ['error', 'fail', 'exception', 'fatal'],
  warningPatterns: ['warn', 'warning', 'caution']
}
```

### ProgressConfig Interface

Controls progress indication during execution:

```typescript
interface ProgressConfig {
  enabled: boolean;
  style: 'spinner' | 'bar' | 'dots' | 'silent';
  updateIntervalMs: number;
  showETA: boolean;
  showPhase: boolean;
}
```

**Example:**
```typescript
progress: {
  enabled: true,
  style: 'bar',           // Progress bar
  updateIntervalMs: 200,  // Update every 200ms
  showETA: true,          // Show estimated time
  showPhase: true         // Show current phase
}
```

### FormatterConfig Interface

Controls output formatting and presentation:

```typescript
interface FormatterConfig {
  colorScheme: 'dark' | 'light' | 'none';
  syntaxHighlighting: boolean;
  timestampFormat: 'iso' | 'relative' | 'elapsed' | 'none';
  includeMetadata: boolean;
}
```

**Example:**
```typescript
formatting: {
  colorScheme: 'dark',         // Dark color scheme
  syntaxHighlighting: true,    // Enable syntax highlighting
  timestampFormat: 'iso',      // ISO timestamp format
  includeMetadata: true        // Include execution metadata
}
```

### FilterConfig Interface

Controls output filtering and search:

```typescript
interface FilterConfig {
  levels: ('debug' | 'info' | 'warn' | 'error')[];
  keywords?: string[];
  excludeKeywords?: string[];
  regex?: string[];
  excludeRegex?: string[];
  timeRange?: {
    start?: Date;
    end?: Date;
  };
}
```

**Example:**
```typescript
filtering: {
  levels: ['info', 'warn', 'error'],  // Show info and above
  keywords: ['success', 'complete'],  // Include these keywords
  excludeKeywords: ['debug', 'trace'],// Exclude debug messages
  regex: ['^ERROR:.*'],               // Error line patterns
  timeRange: {
    start: new Date('2024-01-01'),
    end: new Date()
  }
}
```

### CacheConfig Interface

Controls result caching behavior:

```typescript
interface CacheConfig {
  maxEntries: number;
  maxMemoryBytes: number;
  ttlMs: number;
  compression: boolean;
  persistToDisk: boolean;
}
```

**Example:**
```typescript
caching: {
  maxEntries: 100,                    // Cache up to 100 results
  maxMemoryBytes: 50 * 1024 * 1024,   // 50MB memory limit
  ttlMs: 300000,                      // 5 minute TTL
  compression: true,                  // Enable compression
  persistToDisk: false                // Memory-only cache
}
```

### ExportConfig Interface

Controls output export formats and options:

```typescript
interface ExportConfig {
  format: 'json' | 'csv' | 'html' | 'markdown' | 'text';
  includeMetadata: boolean;
  compress: boolean;
  template?: string;
  streaming?: boolean;
}
```

**Example:**
```typescript
export: {
  format: 'json',          // Export as JSON
  includeMetadata: true,   // Include execution metadata
  compress: false,         // No compression
  streaming: false         // Complete export at end
}
```

## Advanced Usage Examples

### High-Volume Output Processing

For scripts that generate large amounts of output:

```typescript
const result = await taskManager.runScript({
  name: 'data-processing-script'
}, {
  streaming: {
    stdout: {
      maxLines: 10000,
      retentionMs: 300000,  // 5 minutes
      maxMemoryBytes: 10 * 1024 * 1024  // 10MB
    },
    stderr: {
      maxLines: 5000,
      retentionMs: 180000,  // 3 minutes
      maxMemoryBytes: 5 * 1024 * 1024   // 5MB
    },
    errorPatterns: ['error', 'fail', 'exception'],
    warningPatterns: ['warn', 'warning']
  },
  caching: {
    maxEntries: 50,
    maxMemoryBytes: 100 * 1024 * 1024,  // 100MB
    ttlMs: 600000,  // 10 minutes
    compression: true,
    persistToDisk: true
  },
  progress: {
    enabled: true,
    style: 'bar',
    updateIntervalMs: 500,  // Less frequent updates
    showETA: true,
    showPhase: true
  }
});
```

### Error Analysis and Debugging

For comprehensive error tracking and analysis:

```typescript
const result = await taskManager.runScript({
  name: 'test-suite'
}, {
  streaming: {
    stdout: {
      maxLines: 5000,
      retentionMs: 600000,  // 10 minutes
      maxMemoryBytes: 5 * 1024 * 1024
    },
    stderr: {
      maxLines: 2000,
      retentionMs: 600000,
      maxMemoryBytes: 2 * 1024 * 1024
    },
    errorPatterns: [
      'error', 'fail', 'exception', 'fatal', 
      'assertion failed', 'test failed'
    ],
    warningPatterns: [
      'warn', 'warning', 'deprecated', 'skipped'
    ]
  },
  filtering: {
    levels: ['warn', 'error'],
    regex: [
      '^\\s*at\\s+.*\\(.*\\.js:\\d+:\\d+\\)',  // Stack traces
      '^Error:.*',                             // Error messages
      '^\\s*\\d+\\)\\s+.*'                     // Test numbers
    ]
  },
  formatting: {
    colorScheme: 'dark',
    syntaxHighlighting: true,
    timestampFormat: 'iso',
    includeMetadata: true
  },
  export: {
    format: 'html',
    includeMetadata: true,
    compress: false,
    template: 'error-report'
  }
});
```

### Performance Monitoring

For monitoring script performance and resource usage:

```typescript
const result = await taskManager.runScript({
  name: 'performance-test'
}, {
  streaming: {
    stdout: {
      maxLines: 1000,
      retentionMs: 120000,
      maxMemoryBytes: 1024 * 1024
    },
    stderr: {
      maxLines: 500,
      retentionMs: 60000,
      maxMemoryBytes: 512 * 1024
    },
    errorPatterns: ['error', 'timeout', 'memory'],
    warningPatterns: ['slow', 'performance', 'memory']
  },
  progress: {
    enabled: true,
    style: 'dots',
    updateIntervalMs: 100,
    showETA: true,
    showPhase: true
  },
  filtering: {
    levels: ['info', 'warn', 'error'],
    keywords: ['performance', 'memory', 'cpu', 'time']
  },
  formatting: {
    colorScheme: 'light',
    syntaxHighlighting: false,
    timestampFormat: 'elapsed',
    includeMetadata: true
  },
  export: {
    format: 'csv',
    includeMetadata: true,
    compress: false
  }
});

// Access performance metrics
console.log('Execution time:', result.execution?.duration);
console.log('Memory usage:', result.execution?.metadata?.peakMemoryUsage);
console.log('Output lines:', result.execution?.metadata?.outputLines);
```

## API Reference

### TaskManager.runScript()

**Signature:**
```typescript
async runScript(
  options: RunExecutionOptions,
  outputOptions?: OutputManagementOptions
): Promise<{
  runId: string;
  status: 'completed' | 'failed' | 'running';
  exitCode?: number;
  execution?: {
    start: string;
    end?: string;
    duration?: number;
    stdout?: string;
    stderr?: string;
    filteredOutput?: FilterResult;
    exportResult?: ExportResult;
  };
}>
```

**Parameters:**
- `options`: Script execution options (name, args, etc.)
- `outputOptions`: Optional output management configuration

**Returns:**
- `runId`: Unique execution identifier
- `status`: Execution status
- `exitCode`: Process exit code (if completed)
- `execution`: Execution details including output and metadata

### Core Components

#### OutputBuffer

High-performance circular buffer for streaming output:

```typescript
const buffer = new OutputBuffer({
  maxLines: 1000,
  retentionMs: 60000,
  maxMemoryBytes: 1024 * 1024
});

// Write output
buffer.write('Output line', 'stdout');

// Search output
const results = buffer.search('pattern');

// Get metrics
const metrics = buffer.getMetrics();
```

#### StreamManager

Manages stdout and stderr streams independently:

```typescript
const streamManager = new StreamManager({
  stdout: { maxLines: 1000, retentionMs: 60000, maxMemoryBytes: 1024 * 1024 },
  stderr: { maxLines: 500, retentionMs: 30000, maxMemoryBytes: 512 * 1024 },
  errorPatterns: ['error:', 'fail'],
  warningPatterns: ['warn:', 'warning']
});

// Write to streams
streamManager.writeStdout('Standard output');
streamManager.writeStderr('Error output');

// Get combined output
const combined = streamManager.getCombined();
```

#### ProgressTracker

Provides real-time progress indication:

```typescript
const progressTracker = new ProgressTracker({
  enabled: true,
  style: 'bar',
  updateIntervalMs: 100,
  showETA: true,
  showPhase: true
});

progressTracker.start('Initialization');
progressTracker.updatePhase('Processing');
progressTracker.updateProgress(0.5); // 50% complete
progressTracker.complete();
```

## Error Handling

The system provides comprehensive error handling:

```typescript
try {
  const result = await taskManager.runScript(options, outputOptions);
  
  if (result.status === 'failed') {
    console.error('Script failed with exit code:', result.exitCode);
    console.error('Error output:', result.execution?.stderr);
  }
} catch (error) {
  console.error('Execution error:', error.message);
}
```

## Best Practices

### Memory Management

1. **Set appropriate buffer sizes** based on expected output volume
2. **Use retention times** to automatically clean up old output
3. **Enable compression** for long-running processes
4. **Monitor memory usage** through metrics APIs

### Performance Optimization

1. **Adjust update intervals** based on output frequency
2. **Use appropriate progress styles** (silent for batch jobs)
3. **Configure filtering** to reduce processing overhead
4. **Cache results** for frequently executed scripts

### Error Handling

1. **Configure error patterns** to catch relevant issues
2. **Set up warning patterns** for early problem detection
3. **Use filtering** to focus on important messages
4. **Export error reports** for detailed analysis

### Monitoring and Debugging

1. **Enable metadata collection** for performance analysis
2. **Use appropriate timestamp formats** for correlation
3. **Export outputs** in suitable formats for analysis
4. **Monitor buffer metrics** to optimize configuration

## Troubleshooting

### Common Issues

**High Memory Usage:**
- Reduce `maxLines` and `maxMemoryBytes` settings
- Decrease `retentionMs` to clean up faster
- Enable compression in cache configuration

**Missing Output:**
- Check buffer size limits
- Verify retention times are sufficient
- Ensure patterns don't filter out expected content

**Performance Issues:**
- Increase `updateIntervalMs` for progress updates
- Disable unnecessary formatting options
- Use appropriate cache settings

**Export Failures:**
- Check disk space and permissions
- Verify export format compatibility
- Test with smaller output sets first

### Debug Configuration

For debugging output management issues:

```typescript
const debugConfig = {
  streaming: {
    stdout: {
      maxLines: 10000,
      retentionMs: 600000,  // 10 minutes
      maxMemoryBytes: 10 * 1024 * 1024
    },
    stderr: {
      maxLines: 5000,
      retentionMs: 600000,
      maxMemoryBytes: 5 * 1024 * 1024
    },
    errorPatterns: [],  // Capture everything
    warningPatterns: []
  },
  formatting: {
    colorScheme: 'none',
    syntaxHighlighting: false,
    timestampFormat: 'iso',
    includeMetadata: true
  },
  export: {
    format: 'text',
    includeMetadata: true,
    compress: false
  }
};
```

This configuration maximizes output capture and metadata collection for troubleshooting.