/**
 * OutputExporter - Multi-format export system for script execution results
 * Part of Run Output Management (T130-T143)
 * 
 * Features:
 * - Multiple export formats (JSON, CSV, HTML, plain text, XML)
 * - Customizable templates and styling
 * - Streaming export for large datasets
 * - Format-specific optimization
 * - Metadata inclusion options
 * - Compression and archiving
 */

import { OutputChunk, BufferMetrics } from './output-buffer.js';
import { StreamMetrics } from './stream-manager.js';
import { createWriteStream, WriteStream } from 'fs';
import { promises as fs } from 'fs';
import { gzipSync } from 'zlib';
import { join, extname } from 'path';

export interface ExportOptions {
  format: 'json' | 'csv' | 'html' | 'txt' | 'xml' | 'markdown';
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includeLineNumbers: boolean;
  includeSource: boolean;
  compress: boolean;
  prettyPrint: boolean;
  template?: ExportTemplate;
  filterOptions?: ExportFilter;
  chunkSize?: number; // For streaming exports
}

export interface ExportTemplate {
  name: string;
  format: string;
  header?: string;
  footer?: string;
  itemTemplate?: string;
  separator?: string;
  styles?: ExportStyles;
}

export interface ExportStyles {
  css?: string;
  inlineStyles?: boolean;
  colorScheme?: 'light' | 'dark' | 'auto';
  fontSize?: string;
  fontFamily?: string;
}

export interface ExportFilter {
  sources?: ('stdout' | 'stderr')[];
  timeRange?: {
    start: Date;
    end: Date;
  };
  contentFilter?: RegExp;
  maxItems?: number;
}

export interface ExportResult {
  success: boolean;
  filePath?: string;
  format: string;
  metadata: {
    itemCount: number;
    fileSize: number;
    compressed: boolean;
    exportTime: number;
    template?: string;
  };
  error?: string;
}

export interface ExportMetadata {
  exportDate: Date;
  totalChunks: number;
  timeRange?: {
    start: Date;
    end: Date;
  };
  sources: {
    stdout: number;
    stderr: number;
  };
  bufferMetrics?: BufferMetrics;
  streamMetrics?: StreamMetrics;
}

/**
 * Predefined export templates
 */
export const EXPORT_TEMPLATES: { [key: string]: ExportTemplate } = {
  // HTML Templates
  'html-modern': {
    name: 'Modern HTML',
    format: 'html',
    header: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Script Output Export</title>
    <style>
        body { font-family: 'Monaco', 'Menlo', 'Consolas', monospace; margin: 0; padding: 20px; background: #1e1e1e; color: #d4d4d4; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .chunk { padding: 4px 0; border-left: 2px solid transparent; }
        .chunk:hover { background: rgba(255,255,255,0.05); }
        .stdout { border-left-color: #007ACC; }
        .stderr { border-left-color: #FF6B6B; color: #FF6B6B; }
        .timestamp { color: #6A9955; font-size: 0.9em; margin-right: 10px; }
        .line-number { color: #858585; margin-right: 10px; min-width: 50px; display: inline-block; }
        .content { white-space: pre-wrap; }
        .metadata { margin-top: 40px; padding: 20px; background: #252526; border-radius: 4px; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>Script Output Export</h1>
        <p>Generated on {{exportDate}}</p>
    </div>`,
    footer: `    <div class="metadata">
        <h3>Export Metadata</h3>
        <p><strong>Total Chunks:</strong> {{totalChunks}}</p>
        <p><strong>Time Range:</strong> {{timeRange}}</p>
        <p><strong>Sources:</strong> stdout: {{stdout}}, stderr: {{stderr}}</p>
    </div>
</div>
</body>
</html>`,
    itemTemplate: `    <div class="chunk {{source}}">
        <span class="timestamp">{{timestamp}}</span>
        <span class="line-number">{{lineNumber}}</span>
        <span class="content">{{content}}</span>
    </div>`
  },

  // JSON Template
  'json-detailed': {
    name: 'Detailed JSON',
    format: 'json',
    header: '{\n  "export": {\n    "date": "{{exportDate}}",\n    "metadata": {{metadata}},\n    "chunks": [',
    footer: '\n    ]\n  }\n}',
    itemTemplate: '{\n      "id": "{{id}}",\n      "timestamp": "{{timestamp}}",\n      "source": "{{source}}",\n      "lineNumber": {{lineNumber}},\n      "content": {{content}}\n    }',
    separator: ',\n      '
  },

  // CSV Template
  'csv-standard': {
    name: 'Standard CSV',
    format: 'csv',
    header: 'Timestamp,Source,Line,Content',
    itemTemplate: '"{{timestamp}}","{{source}}",{{lineNumber}},"{{escapedContent}}"',
    separator: '\n'
  },

  // Markdown Template
  'markdown-formatted': {
    name: 'Formatted Markdown',
    format: 'markdown',
    header: '# Script Output Export\n\n**Export Date:** {{exportDate}}\n\n## Output\n\n```',
    footer: '```\n\n## Metadata\n\n- **Total Chunks:** {{totalChunks}}\n- **Time Range:** {{timeRange}}\n- **Sources:** stdout: {{stdout}}, stderr: {{stderr}}',
    itemTemplate: '{{timestamp}} [{{source}}] {{content}}',
    separator: '\n'
  }
};

/**
 * Multi-format output exporter with streaming support
 */
export class OutputExporter {
  private templates: { [key: string]: ExportTemplate } = { ...EXPORT_TEMPLATES };

  constructor() {}

  /**
   * Export chunks to file
   */
  async exportToFile(
    chunks: OutputChunk[],
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = performance.now();

    try {
      // Apply filters
      const filtered = this.applyFilters(chunks, options.filterOptions);
      
      // Generate content
      const content = await this.generateContent(filtered, options);
      
      // Compress if requested
      const finalContent = options.compress ? gzipSync(content) : Buffer.from(content);
      
      // Write to file
      await fs.writeFile(filePath, finalContent);
      
      const fileSize = finalContent.length;
      const exportTime = performance.now() - startTime;

      return {
        success: true,
        filePath,
        format: options.format,
        metadata: {
          itemCount: filtered.length,
          fileSize,
          compressed: options.compress,
          exportTime,
          template: options.template?.name
        }
      };
    } catch (error) {
      return {
        success: false,
        format: options.format,
        metadata: {
          itemCount: 0,
          fileSize: 0,
          compressed: false,
          exportTime: performance.now() - startTime
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stream export for large datasets
   */
  async streamExport(
    chunks: OutputChunk[],
    filePath: string,
    options: ExportOptions
  ): Promise<ExportResult> {
    const startTime = performance.now();
    const chunkSize = options.chunkSize ?? 1000;

    try {
      const stream = createWriteStream(filePath, { flags: 'w' });
      const filtered = this.applyFilters(chunks, options.filterOptions);
      
      // Write header
      const template = options.template ?? this.getDefaultTemplate(options.format);
      if (template.header) {
        const header = this.processTemplate(template.header, this.createExportMetadata(filtered));
        stream.write(header);
      }

      // Process chunks in batches
      for (let i = 0; i < filtered.length; i += chunkSize) {
        const batch = filtered.slice(i, i + chunkSize);
        const batchContent = this.generateBatchContent(batch, options, i > 0);
        stream.write(batchContent);
      }

      // Write footer
      if (template.footer) {
        const footer = this.processTemplate(template.footer, this.createExportMetadata(filtered));
        stream.write(footer);
      }

      stream.end();

      // Wait for stream to finish
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });

      const stats = await fs.stat(filePath);
      const exportTime = performance.now() - startTime;

      return {
        success: true,
        filePath,
        format: options.format,
        metadata: {
          itemCount: filtered.length,
          fileSize: stats.size,
          compressed: false,
          exportTime,
          template: template.name
        }
      };
    } catch (error) {
      return {
        success: false,
        format: options.format,
        metadata: {
          itemCount: 0,
          fileSize: 0,
          compressed: false,
          exportTime: performance.now() - startTime
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate content as string (for in-memory processing)
   */
  async generateContent(chunks: OutputChunk[], options: ExportOptions): Promise<string> {
    const template = options.template ?? this.getDefaultTemplate(options.format);
    const metadata = this.createExportMetadata(chunks);
    
    let content = '';

    // Header
    if (template.header) {
      content += this.processTemplate(template.header, metadata);
    }

    // Items
    const items = chunks.map((chunk, index) => {
      const item = this.chunkToTemplateData(chunk, options, index);
      return template.itemTemplate ? 
        this.processTemplate(template.itemTemplate, item) : 
        this.formatChunkDefault(chunk, options);
    });

    content += items.join(template.separator ?? '\n');

    // Footer
    if (template.footer) {
      content += this.processTemplate(template.footer, metadata);
    }

    return content;
  }

  /**
   * Export multiple formats simultaneously
   */
  async exportMultiFormat(
    chunks: OutputChunk[],
    basePath: string,
    formats: ExportOptions[]
  ): Promise<ExportResult[]> {
    const results: ExportResult[] = [];

    for (const options of formats) {
      const extension = this.getFileExtension(options.format);
      const filePath = `${basePath}.${extension}`;
      
      const result = await this.exportToFile(chunks, filePath, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Add custom template
   */
  addTemplate(name: string, template: ExportTemplate): void {
    this.templates[name] = template;
  }

  /**
   * Get available templates
   */
  getTemplates(): string[] {
    return Object.keys(this.templates);
  }

  /**
   * Get template by name
   */
  getTemplate(name: string): ExportTemplate | undefined {
    return this.templates[name];
  }

  /**
   * Generate file name with timestamp
   */
  generateFileName(prefix = 'output', format = 'txt', includeTimestamp = true): string {
    const timestamp = includeTimestamp ? 
      new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] : '';
    
    const extension = this.getFileExtension(format);
    return timestamp ? `${prefix}-${timestamp}.${extension}` : `${prefix}.${extension}`;
  }

  private applyFilters(chunks: OutputChunk[], filter?: ExportFilter): OutputChunk[] {
    if (!filter) return chunks;

    let filtered = chunks;

    // Source filter
    if (filter.sources) {
      filtered = filtered.filter(chunk => filter.sources!.includes(chunk.source));
    }

    // Time range filter
    if (filter.timeRange) {
      filtered = filtered.filter(chunk =>
        chunk.timestamp >= filter.timeRange!.start &&
        chunk.timestamp <= filter.timeRange!.end
      );
    }

    // Content filter
    if (filter.contentFilter) {
      filtered = filtered.filter(chunk => filter.contentFilter!.test(chunk.content));
    }

    // Max items filter
    if (filter.maxItems) {
      filtered = filtered.slice(0, filter.maxItems);
    }

    return filtered;
  }

  private generateBatchContent(
    batch: OutputChunk[],
    options: ExportOptions,
    isNotFirst: boolean
  ): string {
    const template = options.template ?? this.getDefaultTemplate(options.format);
    
    const items = batch.map((chunk, index) => {
      const item = this.chunkToTemplateData(chunk, options, index);
      return template.itemTemplate ? 
        this.processTemplate(template.itemTemplate, item) : 
        this.formatChunkDefault(chunk, options);
    });

    const separator = template.separator ?? '\n';
    const content = items.join(separator);

    // Add separator before batch if not first batch
    return (isNotFirst && separator) ? separator + content : content;
  }

  private createExportMetadata(chunks: OutputChunk[]): ExportMetadata & { [key: string]: any } {
    const timestamps = chunks.map(c => c.timestamp);
    const sources = {
      stdout: chunks.filter(c => c.source === 'stdout').length,
      stderr: chunks.filter(c => c.source === 'stderr').length
    };

    return {
      exportDate: new Date(),
      totalChunks: chunks.length,
      timeRange: timestamps.length > 0 ? {
        start: new Date(Math.min(...timestamps.map(t => t.getTime()))),
        end: new Date(Math.max(...timestamps.map(t => t.getTime())))
      } : undefined,
      sources,
      // Template variables
      stdout: sources.stdout,
      stderr: sources.stderr
    };
  }

  private chunkToTemplateData(chunk: OutputChunk, options: ExportOptions, index: number): { [key: string]: any } {
    return {
      id: chunk.id,
      timestamp: options.includeTimestamps ? chunk.timestamp.toISOString() : '',
      source: chunk.source,
      lineNumber: options.includeLineNumbers ? chunk.lineNumber : index + 1,
      content: chunk.content,
      escapedContent: this.escapeForFormat(chunk.content, options.format),
      byteOffset: chunk.byteOffset
    };
  }

  private processTemplate(template: string, data: { [key: string]: any }): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = data[key];
      if (value === undefined) return match;
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    });
  }

  private formatChunkDefault(chunk: OutputChunk, options: ExportOptions): string {
    const parts: string[] = [];

    if (options.includeTimestamps) {
      parts.push(chunk.timestamp.toISOString());
    }

    if (options.includeSource) {
      parts.push(`[${chunk.source.toUpperCase()}]`);
    }

    if (options.includeLineNumbers) {
      parts.push(`${chunk.lineNumber}:`);
    }

    parts.push(chunk.content);

    return parts.join(' ');
  }

  private escapeForFormat(content: string, format: string): string {
    switch (format) {
      case 'csv':
        return content.replace(/"/g, '""');
      case 'html':
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      case 'xml':
        return content
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      case 'json':
        return JSON.stringify(content);
      default:
        return content;
    }
  }

  private getDefaultTemplate(format: string): ExportTemplate {
    const defaultTemplates: { [key: string]: string } = {
      html: 'html-modern',
      json: 'json-detailed',
      csv: 'csv-standard',
      markdown: 'markdown-formatted'
    };

    return this.templates[defaultTemplates[format]] ?? {
      name: 'Default',
      format,
      itemTemplate: '{{timestamp}} [{{source}}] {{content}}',
      separator: '\n'
    };
  }

  private getFileExtension(format: string): string {
    const extensions: { [key: string]: string } = {
      json: 'json',
      csv: 'csv',
      html: 'html',
      txt: 'txt',
      xml: 'xml',
      markdown: 'md'
    };

    return extensions[format] ?? 'txt';
  }
}