/**
 * OutputFormatter - Advanced output formatting with syntax highlighting and ANSI support
 * Part of Run Output Management (T130-T143)
 * 
 * Features:
 * - ANSI color code support and stripping
 * - Syntax highlighting for various formats
 * - Timestamp injection and formatting
 * - Multiple output formats (plain, JSON, HTML)
 * - Custom formatting templates
 * - Log level colorization
 */

import { OutputChunk } from './output-buffer.js';

export interface FormattingOptions {
  format: 'plain' | 'json' | 'html' | 'markdown' | 'ansi';
  includeTimestamps: boolean;
  timestampFormat: string;
  includeLineNumbers: boolean;
  includeSource: boolean;
  highlightErrors: boolean;
  highlightWarnings: boolean;
  stripAnsi: boolean;
  colorScheme: ColorScheme;
  syntaxHighlighting: SyntaxHighlightConfig;
}

export interface ColorScheme {
  error: string;
  warning: string;
  info: string;
  debug: string;
  timestamp: string;
  lineNumber: string;
  stdout: string;
  stderr: string;
}

export interface SyntaxHighlightConfig {
  enabled: boolean;
  language?: string;
  detectLanguage: boolean;
  themes: {
    [key: string]: HighlightTheme;
  };
  currentTheme: string;
}

export interface HighlightTheme {
  keyword: string;
  string: string;
  number: string;
  comment: string;
  operator: string;
  function: string;
  variable: string;
}

export interface FormattedOutput {
  content: string;
  metadata: {
    format: string;
    chunkCount: number;
    totalBytes: number;
    hasErrors: boolean;
    hasWarnings: boolean;
    timeRange?: {
      start: Date;
      end: Date;
    };
  };
}

/**
 * ANSI color codes for terminal output
 */
export const ANSI_COLORS = {
  // Reset
  reset: '\x1b[0m',
  
  // Text colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Bright text colors
  brightBlack: '\x1b[90m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',
  
  // Text styles
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  strikethrough: '\x1b[9m'
};

/**
 * Default color schemes
 */
export const COLOR_SCHEMES: { [key: string]: ColorScheme } = {
  default: {
    error: ANSI_COLORS.brightRed,
    warning: ANSI_COLORS.brightYellow,
    info: ANSI_COLORS.brightBlue,
    debug: ANSI_COLORS.brightBlack,
    timestamp: ANSI_COLORS.brightBlack,
    lineNumber: ANSI_COLORS.dim,
    stdout: ANSI_COLORS.reset,
    stderr: ANSI_COLORS.red
  },
  dark: {
    error: ANSI_COLORS.red,
    warning: ANSI_COLORS.yellow,
    info: ANSI_COLORS.cyan,
    debug: ANSI_COLORS.brightBlack,
    timestamp: ANSI_COLORS.brightBlack,
    lineNumber: ANSI_COLORS.brightBlack,
    stdout: ANSI_COLORS.white,
    stderr: ANSI_COLORS.brightRed
  },
  light: {
    error: ANSI_COLORS.red,
    warning: ANSI_COLORS.yellow,
    info: ANSI_COLORS.blue,
    debug: ANSI_COLORS.black,
    timestamp: ANSI_COLORS.black,
    lineNumber: ANSI_COLORS.black,
    stdout: ANSI_COLORS.black,
    stderr: ANSI_COLORS.red
  }
};

/**
 * Default syntax highlighting themes
 */
export const HIGHLIGHT_THEMES: { [key: string]: HighlightTheme } = {
  default: {
    keyword: ANSI_COLORS.blue,
    string: ANSI_COLORS.green,
    number: ANSI_COLORS.cyan,
    comment: ANSI_COLORS.brightBlack,
    operator: ANSI_COLORS.magenta,
    function: ANSI_COLORS.yellow,
    variable: ANSI_COLORS.white
  },
  monokai: {
    keyword: ANSI_COLORS.magenta,
    string: ANSI_COLORS.yellow,
    number: ANSI_COLORS.brightBlue,
    comment: ANSI_COLORS.brightBlack,
    operator: ANSI_COLORS.red,
    function: ANSI_COLORS.green,
    variable: ANSI_COLORS.white
  }
};

/**
 * Advanced output formatting with syntax highlighting and multiple format support
 */
export class OutputFormatter {
  private readonly options: FormattingOptions;

  constructor(options: Partial<FormattingOptions> = {}) {
    this.options = {
      format: options.format ?? 'plain',
      includeTimestamps: options.includeTimestamps ?? true,
      timestampFormat: options.timestampFormat ?? 'ISO',
      includeLineNumbers: options.includeLineNumbers ?? false,
      includeSource: options.includeSource ?? true,
      highlightErrors: options.highlightErrors ?? true,
      highlightWarnings: options.highlightWarnings ?? true,
      stripAnsi: options.stripAnsi ?? false,
      colorScheme: options.colorScheme ?? COLOR_SCHEMES.default,
      syntaxHighlighting: {
        enabled: options.syntaxHighlighting?.enabled ?? false,
        language: options.syntaxHighlighting?.language,
        detectLanguage: options.syntaxHighlighting?.detectLanguage ?? true,
        themes: { ...HIGHLIGHT_THEMES, ...(options.syntaxHighlighting?.themes ?? {}) },
        currentTheme: options.syntaxHighlighting?.currentTheme ?? 'default'
      }
    };
  }

  /**
   * Format a single chunk
   */
  formatChunk(chunk: OutputChunk): string {
    let content = chunk.content;

    // Strip ANSI codes if requested
    if (this.options.stripAnsi) {
      content = this.stripAnsiCodes(content);
    }

    // Apply syntax highlighting
    if (this.options.syntaxHighlighting.enabled) {
      content = this.applySyntaxHighlighting(content);
    }

    // Apply log level highlighting
    content = this.applyLogLevelHighlighting(content, chunk.source);

    // Build formatted line
    return this.buildFormattedLine(chunk, content);
  }

  /**
   * Format multiple chunks
   */
  formatChunks(chunks: OutputChunk[]): FormattedOutput {
    if (chunks.length === 0) {
      return {
        content: '',
        metadata: {
          format: this.options.format,
          chunkCount: 0,
          totalBytes: 0,
          hasErrors: false,
          hasWarnings: false
        }
      };
    }

    const formatted = chunks.map(chunk => this.formatChunk(chunk));
    const content = this.joinFormattedContent(formatted);
    
    // Calculate metadata
    const totalBytes = chunks.reduce((sum, chunk) => 
      sum + Buffer.byteLength(chunk.content, 'utf8'), 0
    );
    
    const hasErrors = chunks.some(chunk => this.isError(chunk.content));
    const hasWarnings = chunks.some(chunk => this.isWarning(chunk.content));
    
    const timestamps = chunks.map(chunk => chunk.timestamp);
    const timeRange = timestamps.length > 0 ? {
      start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
      end: new Date(Math.max(...timestamps.map(t => t.getTime())))
    } : undefined;

    return {
      content,
      metadata: {
        format: this.options.format,
        chunkCount: chunks.length,
        totalBytes,
        hasErrors,
        hasWarnings,
        timeRange
      }
    };
  }

  /**
   * Format as JSON
   */
  formatAsJson(chunks: OutputChunk[]): string {
    const data = {
      chunks: chunks.map(chunk => ({
        id: chunk.id,
        timestamp: chunk.timestamp.toISOString(),
        content: this.options.stripAnsi ? this.stripAnsiCodes(chunk.content) : chunk.content,
        source: chunk.source,
        lineNumber: chunk.lineNumber,
        byteOffset: chunk.byteOffset
      })),
      metadata: {
        totalChunks: chunks.length,
        formatOptions: {
          timestampFormat: this.options.timestampFormat,
          includeSource: this.options.includeSource,
          stripAnsi: this.options.stripAnsi
        }
      }
    };

    return JSON.stringify(data, null, 2);
  }

  /**
   * Format as HTML
   */
  formatAsHtml(chunks: OutputChunk[]): string {
    const header = `
<!DOCTYPE html>
<html>
<head>
  <title>Script Output</title>
  <style>
    body { font-family: 'Courier New', monospace; background: #1e1e1e; color: #d4d4d4; }
    .chunk { margin: 0; padding: 2px 0; }
    .timestamp { color: #6a6a6a; font-size: 0.9em; }
    .line-number { color: #6a6a6a; margin-right: 10px; }
    .stdout { color: #d4d4d4; }
    .stderr { color: #f44747; }
    .error { color: #f44747; font-weight: bold; }
    .warning { color: #ffcc02; }
    .info { color: #3794ff; }
  </style>
</head>
<body>
<pre>`;

    const body = chunks.map(chunk => {
      const timestamp = this.options.includeTimestamps ? 
        `<span class="timestamp">${this.formatTimestamp(chunk.timestamp)}</span> ` : '';
      
      const lineNumber = this.options.includeLineNumbers ? 
        `<span class="line-number">${chunk.lineNumber.toString().padStart(4, ' ')}</span>` : '';
      
      const source = this.options.includeSource ? 
        `<span class="${chunk.source}">[${chunk.source.toUpperCase()}]</span> ` : '';

      let content = this.escapeHtml(chunk.content);
      content = this.applyHtmlHighlighting(content);

      return `<div class="chunk">${timestamp}${lineNumber}${source}${content}</div>`;
    }).join('\n');

    const footer = `
</pre>
</body>
</html>`;

    return header + body + footer;
  }

  /**
   * Format as Markdown
   */
  formatAsMarkdown(chunks: OutputChunk[]): string {
    const header = `# Script Output\n\n\`\`\`\n`;
    const body = chunks.map(chunk => {
      const timestamp = this.options.includeTimestamps ? 
        `${this.formatTimestamp(chunk.timestamp)} ` : '';
      
      const source = this.options.includeSource ? `[${chunk.source.toUpperCase()}] ` : '';
      
      return `${timestamp}${source}${chunk.content}`;
    }).join('');
    
    const footer = `\n\`\`\`\n`;

    return header + body + footer;
  }

  /**
   * Create a custom formatter
   */
  createCustomFormat(
    template: string,
    chunks: OutputChunk[]
  ): string {
    return chunks.map(chunk => {
      return template
        .replace('{timestamp}', this.formatTimestamp(chunk.timestamp))
        .replace('{id}', chunk.id)
        .replace('{source}', chunk.source)
        .replace('{lineNumber}', chunk.lineNumber.toString())
        .replace('{byteOffset}', chunk.byteOffset.toString())
        .replace('{content}', chunk.content)
        .replace('{escapedContent}', this.escapeHtml(chunk.content));
    }).join('');
  }

  /**
   * Update formatting options
   */
  updateOptions(options: Partial<FormattingOptions>): void {
    Object.assign(this.options, options);
  }

  /**
   * Set color scheme
   */
  setColorScheme(scheme: keyof typeof COLOR_SCHEMES | ColorScheme): void {
    if (typeof scheme === 'string' && scheme in COLOR_SCHEMES) {
      this.options.colorScheme = COLOR_SCHEMES[scheme];
    } else if (typeof scheme === 'object') {
      this.options.colorScheme = scheme;
    }
  }

  private buildFormattedLine(chunk: OutputChunk, content: string): string {
    const parts: string[] = [];

    // Timestamp
    if (this.options.includeTimestamps) {
      const timestamp = this.formatTimestamp(chunk.timestamp);
      parts.push(`${this.options.colorScheme.timestamp}${timestamp}${ANSI_COLORS.reset}`);
    }

    // Line number
    if (this.options.includeLineNumbers) {
      const lineNum = chunk.lineNumber.toString().padStart(4, ' ');
      parts.push(`${this.options.colorScheme.lineNumber}${lineNum}${ANSI_COLORS.reset}`);
    }

    // Source indicator
    if (this.options.includeSource) {
      const sourceColor = chunk.source === 'stderr' ? 
        this.options.colorScheme.stderr : this.options.colorScheme.stdout;
      parts.push(`${sourceColor}[${chunk.source.toUpperCase()}]${ANSI_COLORS.reset}`);
    }

    // Content
    parts.push(content);

    return parts.join(' ');
  }

  private joinFormattedContent(formatted: string[]): string {
    switch (this.options.format) {
      case 'json':
        return JSON.stringify(formatted, null, 2);
      case 'html':
        return formatted.join('<br>\n');
      case 'markdown':
        return formatted.join('  \n');
      default:
        return formatted.join('\n');
    }
  }

  private formatTimestamp(timestamp: Date): string {
    switch (this.options.timestampFormat) {
      case 'ISO':
        return timestamp.toISOString();
      case 'local':
        return timestamp.toLocaleString();
      case 'time':
        return timestamp.toLocaleTimeString();
      case 'short':
        return timestamp.toISOString().split('T')[1].split('.')[0];
      default:
        return timestamp.toISOString();
    }
  }

  private stripAnsiCodes(content: string): string {
    // Remove ANSI escape codes
    return content.replace(/\x1b\[[0-9;]*m/g, '');
  }

  private applySyntaxHighlighting(content: string): string {
    if (!this.options.syntaxHighlighting.enabled) return content;

    const theme = this.options.syntaxHighlighting.themes[this.options.syntaxHighlighting.currentTheme];
    if (!theme) return content;

    // Simple syntax highlighting patterns
    let highlighted = content;

    // Keywords
    highlighted = highlighted.replace(
      /\b(function|var|let|const|if|else|for|while|return|class|import|export)\b/g,
      `${theme.keyword}$1${ANSI_COLORS.reset}`
    );

    // Strings
    highlighted = highlighted.replace(
      /(["'])((?:(?!\1)[^\\]|\\.)*)(\1)/g,
      `${theme.string}$1$2$3${ANSI_COLORS.reset}`
    );

    // Numbers
    highlighted = highlighted.replace(
      /\b\d+\.?\d*\b/g,
      `${theme.number}$&${ANSI_COLORS.reset}`
    );

    // Comments
    highlighted = highlighted.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      `${theme.comment}$1${ANSI_COLORS.reset}`
    );

    return highlighted;
  }

  private applyLogLevelHighlighting(content: string, source: 'stdout' | 'stderr'): string {
    let highlighted = content;

    if (this.options.highlightErrors && this.isError(content)) {
      highlighted = `${this.options.colorScheme.error}${highlighted}${ANSI_COLORS.reset}`;
    } else if (this.options.highlightWarnings && this.isWarning(content)) {
      highlighted = `${this.options.colorScheme.warning}${highlighted}${ANSI_COLORS.reset}`;
    } else if (this.isInfo(content)) {
      highlighted = `${this.options.colorScheme.info}${highlighted}${ANSI_COLORS.reset}`;
    } else if (this.isDebug(content)) {
      highlighted = `${this.options.colorScheme.debug}${highlighted}${ANSI_COLORS.reset}`;
    }

    return highlighted;
  }

  private applyHtmlHighlighting(content: string): string {
    if (this.isError(content)) {
      return `<span class="error">${content}</span>`;
    } else if (this.isWarning(content)) {
      return `<span class="warning">${content}</span>`;
    } else if (this.isInfo(content)) {
      return `<span class="info">${content}</span>`;
    }
    return content;
  }

  private isError(content: string): boolean {
    return /error|exception|fatal|fail|\[ERROR\]|ERROR:/i.test(content);
  }

  private isWarning(content: string): boolean {
    return /warn|warning|\[WARN\]|WARNING:|deprecated/i.test(content);
  }

  private isInfo(content: string): boolean {
    return /info|information|\[INFO\]|INFO:/i.test(content);
  }

  private isDebug(content: string): boolean {
    return /debug|trace|\[DEBUG\]|DEBUG:/i.test(content);
  }

  private escapeHtml(content: string): string {
    return content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}