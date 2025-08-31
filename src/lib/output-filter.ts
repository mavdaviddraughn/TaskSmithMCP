/**
 * OutputFilter - Advanced filtering and search system for output streams
 * Part of Run Output Management (T130-T143)
 * 
 * Features:
 * - Multiple filter types (regex, keyword, level, time-based)
 * - Chainable filter operations
 * - Custom filter functions
 * - Performance-optimized searching
 * - Filter presets and saved filters
 * - Real-time filter application
 */

import { OutputChunk } from './output-buffer.js';

export interface FilterRule {
  id: string;
  name: string;
  type: 'regex' | 'keyword' | 'level' | 'time' | 'custom' | 'source';
  enabled: boolean;
  inverted: boolean; // If true, excludes matching items instead of including
  config: FilterConfig;
}

export interface FilterConfig {
  // Regex filter
  pattern?: RegExp;
  flags?: string;
  
  // Keyword filter
  keywords?: string[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
  
  // Level filter
  levels?: ('error' | 'warning' | 'info' | 'debug' | 'trace')[];
  
  // Time filter
  timeRange?: {
    start: Date;
    end: Date;
  };
  
  // Source filter
  sources?: ('stdout' | 'stderr')[];
  
  // Custom filter function
  customFilter?: (chunk: OutputChunk) => boolean;
}

export interface FilterResult {
  chunks: OutputChunk[];
  metadata: {
    totalMatches: number;
    filteredOut: number;
    executionTime: number;
    appliedFilters: string[];
  };
}

export interface SearchOptions {
  query: string | RegExp;
  searchIn: 'content' | 'source' | 'both';
  caseSensitive: boolean;
  wholeWord: boolean;
  maxResults?: number;
  contextLines: number;
}

export interface SearchResult {
  chunk: OutputChunk;
  matchIndex: number;
  matchLength: number;
  context: {
    before: OutputChunk[];
    after: OutputChunk[];
  };
  highlights: Array<{
    start: number;
    end: number;
    text: string;
  }>;
}

/**
 * Predefined filter presets
 */
export const FILTER_PRESETS: { [key: string]: FilterRule[] } = {
  errorsOnly: [{
    id: 'errors-only',
    name: 'Errors Only',
    type: 'level',
    enabled: true,
    inverted: false,
    config: { levels: ['error'] }
  }],
  
  warningsAndErrors: [{
    id: 'warnings-errors',
    name: 'Warnings and Errors',
    type: 'level',
    enabled: true,
    inverted: false,
    config: { levels: ['error', 'warning'] }
  }],
  
  stderrOnly: [{
    id: 'stderr-only',
    name: 'Standard Error Only',
    type: 'source',
    enabled: true,
    inverted: false,
    config: { sources: ['stderr'] }
  }],
  
  noDebug: [{
    id: 'no-debug',
    name: 'Exclude Debug Messages',
    type: 'level',
    enabled: true,
    inverted: true,
    config: { levels: ['debug', 'trace'] }
  }]
};

/**
 * Advanced filtering and search system for output streams
 */
export class OutputFilter {
  private filters: FilterRule[] = [];
  private presets: { [key: string]: FilterRule[] } = { ...FILTER_PRESETS };
  private performanceMetrics: {
    lastFilterTime: number;
    lastSearchTime: number;
    totalFiltered: number;
    totalSearches: number;
  } = {
    lastFilterTime: 0,
    lastSearchTime: 0,
    totalFiltered: 0,
    totalSearches: 0
  };

  constructor(initialFilters: FilterRule[] = []) {
    this.filters = [...initialFilters];
  }

  /**
   * Add a new filter rule
   */
  addFilter(filter: FilterRule): void {
    // Check if filter with same ID exists
    const existingIndex = this.filters.findIndex(f => f.id === filter.id);
    if (existingIndex >= 0) {
      this.filters[existingIndex] = filter;
    } else {
      this.filters.push(filter);
    }
  }

  /**
   * Remove a filter by ID
   */
  removeFilter(filterId: string): boolean {
    const index = this.filters.findIndex(f => f.id === filterId);
    if (index >= 0) {
      this.filters.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Enable or disable a filter
   */
  toggleFilter(filterId: string, enabled?: boolean): boolean {
    const filter = this.filters.find(f => f.id === filterId);
    if (filter) {
      filter.enabled = enabled ?? !filter.enabled;
      return true;
    }
    return false;
  }

  /**
   * Apply all enabled filters to chunks
   */
  applyFilters(chunks: OutputChunk[]): FilterResult {
    const startTime = performance.now();
    
    const enabledFilters = this.filters.filter(f => f.enabled);
    let filtered = [...chunks];
    let filteredOut = 0;

    for (const filter of enabledFilters) {
      const beforeCount = filtered.length;
      filtered = this.applyFilter(filtered, filter);
      filteredOut += beforeCount - filtered.length;
    }

    const executionTime = performance.now() - startTime;
    this.performanceMetrics.lastFilterTime = executionTime;
    this.performanceMetrics.totalFiltered++;

    return {
      chunks: filtered,
      metadata: {
        totalMatches: filtered.length,
        filteredOut,
        executionTime,
        appliedFilters: enabledFilters.map(f => f.name)
      }
    };
  }

  /**
   * Search chunks for specific patterns
   */
  search(chunks: OutputChunk[], options: SearchOptions): SearchResult[] {
    const startTime = performance.now();
    const results: SearchResult[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const matches = this.findMatches(chunk, options);

      for (const match of matches) {
        if (options.maxResults && results.length >= options.maxResults) {
          break;
        }

        const context = this.getContext(chunks, i, options.contextLines);
        results.push({
          chunk,
          matchIndex: match.index,
          matchLength: match.length,
          context,
          highlights: [{
            start: match.index,
            end: match.index + match.length,
            text: match.text
          }]
        });
      }

      if (options.maxResults && results.length >= options.maxResults) {
        break;
      }
    }

    this.performanceMetrics.lastSearchTime = performance.now() - startTime;
    this.performanceMetrics.totalSearches++;

    return results;
  }

  /**
   * Create a quick keyword filter
   */
  createKeywordFilter(id: string, keywords: string[], caseSensitive = false): FilterRule {
    return {
      id,
      name: `Keywords: ${keywords.join(', ')}`,
      type: 'keyword',
      enabled: true,
      inverted: false,
      config: {
        keywords,
        caseSensitive,
        wholeWord: false
      }
    };
  }

  /**
   * Create a quick regex filter
   */
  createRegexFilter(id: string, pattern: string, flags = 'i'): FilterRule {
    return {
      id,
      name: `Regex: ${pattern}`,
      type: 'regex',
      enabled: true,
      inverted: false,
      config: {
        pattern: new RegExp(pattern, flags)
      }
    };
  }

  /**
   * Create a time range filter
   */
  createTimeRangeFilter(id: string, start: Date, end: Date): FilterRule {
    return {
      id,
      name: `Time Range: ${start.toISOString()} - ${end.toISOString()}`,
      type: 'time',
      enabled: true,
      inverted: false,
      config: {
        timeRange: { start, end }
      }
    };
  }

  /**
   * Create a level filter
   */
  createLevelFilter(id: string, levels: string[], inverted = false): FilterRule {
    return {
      id,
      name: `Levels: ${levels.join(', ')}`,
      type: 'level',
      enabled: true,
      inverted,
      config: {
        levels: levels as any
      }
    };
  }

  /**
   * Apply a filter preset
   */
  applyPreset(presetName: string): boolean {
    if (!(presetName in this.presets)) {
      return false;
    }

    const preset = this.presets[presetName];
    preset.forEach(filter => this.addFilter(filter));
    return true;
  }

  /**
   * Save current filters as a preset
   */
  savePreset(name: string): void {
    this.presets[name] = [...this.filters];
  }

  /**
   * Get all available presets
   */
  getPresets(): string[] {
    return Object.keys(this.presets);
  }

  /**
   * Clear all filters
   */
  clearFilters(): void {
    this.filters = [];
  }

  /**
   * Get current filters
   */
  getFilters(): FilterRule[] {
    return [...this.filters];
  }

  /**
   * Get performance metrics
   */
  getMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Chain multiple filters together
   */
  chain(chunks: OutputChunk[], ...filterIds: string[]): FilterResult {
    const chainedFilters = this.filters.filter(f => 
      filterIds.includes(f.id) && f.enabled
    );

    const startTime = performance.now();
    let filtered = [...chunks];
    let filteredOut = 0;

    for (const filter of chainedFilters) {
      const beforeCount = filtered.length;
      filtered = this.applyFilter(filtered, filter);
      filteredOut += beforeCount - filtered.length;
    }

    return {
      chunks: filtered,
      metadata: {
        totalMatches: filtered.length,
        filteredOut,
        executionTime: performance.now() - startTime,
        appliedFilters: chainedFilters.map(f => f.name)
      }
    };
  }

  private applyFilter(chunks: OutputChunk[], filter: FilterRule): OutputChunk[] {
    let result = chunks.filter(chunk => {
      let matches = false;

      switch (filter.type) {
        case 'regex':
          matches = this.matchesRegex(chunk, filter.config);
          break;
        case 'keyword':
          matches = this.matchesKeyword(chunk, filter.config);
          break;
        case 'level':
          matches = this.matchesLevel(chunk, filter.config);
          break;
        case 'time':
          matches = this.matchesTimeRange(chunk, filter.config);
          break;
        case 'source':
          matches = this.matchesSource(chunk, filter.config);
          break;
        case 'custom':
          matches = filter.config.customFilter ? filter.config.customFilter(chunk) : false;
          break;
        default:
          matches = false;
      }

      return filter.inverted ? !matches : matches;
    });

    return result;
  }

  private matchesRegex(chunk: OutputChunk, config: FilterConfig): boolean {
    if (!config.pattern) return false;
    return config.pattern.test(chunk.content);
  }

  private matchesKeyword(chunk: OutputChunk, config: FilterConfig): boolean {
    if (!config.keywords || config.keywords.length === 0) return false;

    const content = config.caseSensitive ? chunk.content : chunk.content.toLowerCase();
    const keywords = config.caseSensitive ? 
      config.keywords : 
      config.keywords.map(k => k.toLowerCase());

    return keywords.some(keyword => {
      if (config.wholeWord) {
        const regex = new RegExp(`\\b${keyword}\\b`, config.caseSensitive ? 'g' : 'gi');
        return regex.test(chunk.content);
      } else {
        return content.includes(keyword);
      }
    });
  }

  private matchesLevel(chunk: OutputChunk, config: FilterConfig): boolean {
    if (!config.levels || config.levels.length === 0) return false;

    const content = chunk.content.toLowerCase();
    
    for (const level of config.levels) {
      switch (level) {
        case 'error':
          if (/error|exception|fatal|fail|\[error\]|error:/i.test(chunk.content)) return true;
          break;
        case 'warning':
          if (/warn|warning|\[warn\]|warning:|deprecated/i.test(chunk.content)) return true;
          break;
        case 'info':
          if (/info|information|\[info\]|info:/i.test(chunk.content)) return true;
          break;
        case 'debug':
          if (/debug|\[debug\]|debug:/i.test(chunk.content)) return true;
          break;
        case 'trace':
          if (/trace|\[trace\]|trace:/i.test(chunk.content)) return true;
          break;
      }
    }

    return false;
  }

  private matchesTimeRange(chunk: OutputChunk, config: FilterConfig): boolean {
    if (!config.timeRange) return false;

    return chunk.timestamp >= config.timeRange.start && 
           chunk.timestamp <= config.timeRange.end;
  }

  private matchesSource(chunk: OutputChunk, config: FilterConfig): boolean {
    if (!config.sources || config.sources.length === 0) return false;
    return config.sources.includes(chunk.source);
  }

  private findMatches(chunk: OutputChunk, options: SearchOptions): Array<{index: number, length: number, text: string}> {
    const matches: Array<{index: number, length: number, text: string}> = [];
    
    const searchText = options.searchIn === 'source' ? chunk.source : chunk.content;
    
    if (typeof options.query === 'string') {
      const query = options.caseSensitive ? options.query : options.query.toLowerCase();
      const text = options.caseSensitive ? searchText : searchText.toLowerCase();
      
      if (options.wholeWord) {
        const regex = new RegExp(`\\b${query}\\b`, options.caseSensitive ? 'g' : 'gi');
        let match;
        while ((match = regex.exec(searchText)) !== null) {
          matches.push({
            index: match.index,
            length: match[0].length,
            text: match[0]
          });
        }
      } else {
        let index = text.indexOf(query);
        while (index !== -1) {
          matches.push({
            index,
            length: query.length,
            text: searchText.substr(index, query.length)
          });
          index = text.indexOf(query, index + 1);
        }
      }
    } else {
      // RegExp search
      let match;
      while ((match = options.query.exec(searchText)) !== null) {
        matches.push({
          index: match.index,
          length: match[0].length,
          text: match[0]
        });
        if (!options.query.global) break;
      }
    }

    return matches;
  }

  private getContext(chunks: OutputChunk[], currentIndex: number, contextLines: number): {before: OutputChunk[], after: OutputChunk[]} {
    const before = chunks.slice(
      Math.max(0, currentIndex - contextLines),
      currentIndex
    );
    
    const after = chunks.slice(
      currentIndex + 1,
      Math.min(chunks.length, currentIndex + contextLines + 1)
    );

    return { before, after };
  }
}