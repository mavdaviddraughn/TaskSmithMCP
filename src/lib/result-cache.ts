/**
 * ResultCache - High-performance caching system for script execution results
 * Part of Run Output Management (T130-T143)
 * 
 * Features:
 * - TTL-based cache expiration
 * - Configurable size limits with LRU eviction
 * - Compression support for large results
 * - Cache invalidation strategies
 * - Memory usage monitoring
 * - Persistent cache option
 */

import { EventEmitter } from 'events';
import { createHash } from 'crypto';
import { gzipSync, gunzipSync } from 'zlib';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface CacheConfiguration {
  maxItems: number;
  maxMemoryMB: number;
  defaultTTL: number; // seconds
  enableCompression: boolean;
  compressionThreshold: number; // bytes
  persistent: boolean;
  persistentPath?: string;
  cleanupInterval: number; // seconds
}

export interface CacheItem<T = any> {
  key: string;
  value: T;
  metadata: CacheItemMetadata;
  compressedData?: Buffer;
  isCompressed: boolean;
}

export interface CacheItemMetadata {
  createdAt: Date;
  expiresAt: Date;
  lastAccessed: Date;
  hitCount: number;
  sizeBytes: number;
  compressionRatio?: number;
  tags: string[];
}

export interface CacheStats {
  items: number;
  memoryUsageMB: number;
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalEvictions: number;
  averageItemSize: number;
  compressionRatio: number;
  oldestItem?: Date;
  newestItem?: Date;
}

export interface CacheQuery {
  tags?: string[];
  keyPattern?: RegExp;
  createdAfter?: Date;
  createdBefore?: Date;
  minHitCount?: number;
}

/**
 * High-performance LRU cache with TTL, compression, and persistence
 */
export class ResultCache<T = any> extends EventEmitter {
  private cache = new Map<string, CacheItem<T>>();
  private readonly config: CacheConfiguration;
  private cleanupTimer?: NodeJS.Timeout;
  private stats = {
    totalHits: 0,
    totalMisses: 0,
    totalEvictions: 0,
    memoryUsageBytes: 0
  };

  constructor(config: Partial<CacheConfiguration> = {}) {
    super();

    this.config = {
      maxItems: config.maxItems ?? 1000,
      maxMemoryMB: config.maxMemoryMB ?? 100,
      defaultTTL: config.defaultTTL ?? 3600, // 1 hour
      enableCompression: config.enableCompression ?? true,
      compressionThreshold: config.compressionThreshold ?? 1024, // 1KB
      persistent: config.persistent ?? false,
      persistentPath: config.persistentPath,
      cleanupInterval: config.cleanupInterval ?? 300 // 5 minutes
    };

    this.startCleanupTimer();

    if (this.config.persistent) {
      this.loadFromDisk();
    }

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  /**
   * Get item from cache
   */
  async get(key: string): Promise<T | undefined> {
    const item = this.cache.get(key);
    
    if (!item) {
      this.stats.totalMisses++;
      return undefined;
    }

    // Check expiration
    if (this.isExpired(item)) {
      this.delete(key);
      this.stats.totalMisses++;
      return undefined;
    }

    // Update access metadata
    item.metadata.lastAccessed = new Date();
    item.metadata.hitCount++;
    this.stats.totalHits++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, item);

    // Decompress if needed
    if (item.isCompressed && item.compressedData) {
      const decompressed = gunzipSync(item.compressedData);
      item.value = JSON.parse(decompressed.toString('utf8'));
    }

    this.emit('hit', { key, metadata: item.metadata });
    return item.value;
  }

  /**
   * Set item in cache
   */
  async set(
    key: string, 
    value: T, 
    ttl?: number, 
    tags: string[] = []
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (ttl ?? this.config.defaultTTL) * 1000);
    
    // Calculate size
    const serialized = JSON.stringify(value);
    const sizeBytes = Buffer.byteLength(serialized, 'utf8');

    // Compression decision
    const shouldCompress = this.config.enableCompression && 
                          sizeBytes >= this.config.compressionThreshold;
    
    let compressedData: Buffer | undefined;
    let compressionRatio: number | undefined;

    if (shouldCompress) {
      compressedData = gzipSync(serialized);
      compressionRatio = compressedData.length / sizeBytes;
    }

    const item: CacheItem<T> = {
      key,
      value: shouldCompress ? undefined as any : value,
      compressedData,
      isCompressed: shouldCompress,
      metadata: {
        createdAt: now,
        expiresAt,
        lastAccessed: now,
        hitCount: 0,
        sizeBytes: shouldCompress ? compressedData!.length : sizeBytes,
        compressionRatio,
        tags
      }
    };

    // Remove existing item if present
    if (this.cache.has(key)) {
      const existingItem = this.cache.get(key)!;
      this.stats.memoryUsageBytes -= existingItem.metadata.sizeBytes;
    }

    // Check memory limits before adding
    this.enforceMemoryLimits(item.metadata.sizeBytes);

    // Add to cache
    this.cache.set(key, item);
    this.stats.memoryUsageBytes += item.metadata.sizeBytes;

    // Enforce size limits
    this.enforceSizeLimits();

    this.emit('set', { key, sizeBytes, compressed: shouldCompress });
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.stats.memoryUsageBytes -= item.metadata.sizeBytes;
      this.cache.delete(key);
      this.emit('delete', { key });
      return true;
    }
    return false;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (this.isExpired(item)) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.cache.clear();
    this.stats.memoryUsageBytes = 0;
    this.emit('clear');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const items = Array.from(this.cache.values());
    const totalSize = items.reduce((sum, item) => sum + item.metadata.sizeBytes, 0);
    const compressedItems = items.filter(item => item.isCompressed);
    
    let totalCompressionRatio = 0;
    if (compressedItems.length > 0) {
      totalCompressionRatio = compressedItems.reduce((sum, item) => 
        sum + (item.metadata.compressionRatio || 1), 0
      ) / compressedItems.length;
    }

    const timestamps = items.map(item => item.metadata.createdAt);

    return {
      items: this.cache.size,
      memoryUsageMB: this.stats.memoryUsageBytes / (1024 * 1024),
      hitRate: this.stats.totalHits / (this.stats.totalHits + this.stats.totalMisses) || 0,
      totalHits: this.stats.totalHits,
      totalMisses: this.stats.totalMisses,
      totalEvictions: this.stats.totalEvictions,
      averageItemSize: totalSize / this.cache.size || 0,
      compressionRatio: totalCompressionRatio,
      oldestItem: timestamps.length > 0 ? new Date(Math.min(...timestamps.map(t => t.getTime()))) : undefined,
      newestItem: timestamps.length > 0 ? new Date(Math.max(...timestamps.map(t => t.getTime()))) : undefined
    };
  }

  /**
   * Query cache items
   */
  query(query: CacheQuery): Array<{ key: string; metadata: CacheItemMetadata }> {
    const results: Array<{ key: string; metadata: CacheItemMetadata }> = [];

    for (const [key, item] of this.cache.entries()) {
      let matches = true;

      // Tag filter
      if (query.tags && query.tags.length > 0) {
        matches = matches && query.tags.some(tag => item.metadata.tags.includes(tag));
      }

      // Key pattern filter
      if (query.keyPattern) {
        matches = matches && query.keyPattern.test(key);
      }

      // Date range filters
      if (query.createdAfter) {
        matches = matches && item.metadata.createdAt >= query.createdAfter;
      }

      if (query.createdBefore) {
        matches = matches && item.metadata.createdAt <= query.createdBefore;
      }

      // Hit count filter
      if (query.minHitCount !== undefined) {
        matches = matches && item.metadata.hitCount >= query.minHitCount;
      }

      if (matches) {
        results.push({ key, metadata: item.metadata });
      }
    }

    return results;
  }

  /**
   * Invalidate cache items by tags
   */
  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (tags.some(tag => item.metadata.tags.includes(tag))) {
        this.delete(key);
        invalidated++;
      }
    }

    this.emit('invalidated', { tags, count: invalidated });
    return invalidated;
  }

  /**
   * Invalidate cache items by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  /**
   * Generate cache key from object
   */
  static generateKey(obj: any, prefix = 'cache'): string {
    const hash = createHash('sha256')
      .update(JSON.stringify(obj))
      .digest('hex')
      .substring(0, 16);
    
    return `${prefix}:${hash}`;
  }

  /**
   * Preload cache with multiple items
   */
  async preload(items: Array<{
    key: string;
    value: T;
    ttl?: number;
    tags?: string[];
  }>): Promise<void> {
    for (const item of items) {
      await this.set(item.key, item.value, item.ttl, item.tags);
    }
    
    this.emit('preloaded', { count: items.length });
  }

  /**
   * Export cache contents
   */
  export(): Array<{
    key: string;
    value: T;
    metadata: CacheItemMetadata;
  }> {
    const exported: Array<{ key: string; value: T; metadata: CacheItemMetadata }> = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (!this.isExpired(item)) {
        let value = item.value;
        
        // Decompress if needed
        if (item.isCompressed && item.compressedData) {
          const decompressed = gunzipSync(item.compressedData);
          value = JSON.parse(decompressed.toString('utf8'));
        }
        
        exported.push({
          key,
          value,
          metadata: item.metadata
        });
      }
    }
    
    return exported;
  }

  private isExpired(item: CacheItem<T>): boolean {
    return new Date() > item.metadata.expiresAt;
  }

  private enforceMemoryLimits(newItemSize: number): void {
    const maxBytes = this.config.maxMemoryMB * 1024 * 1024;
    
    while (this.stats.memoryUsageBytes + newItemSize > maxBytes && this.cache.size > 0) {
      this.evictLRU();
    }
  }

  private enforceSizeLimits(): void {
    while (this.cache.size > this.config.maxItems) {
      this.evictLRU();
    }
  }

  private evictLRU(): void {
    // Find least recently used item
    let oldestKey: string | undefined;
    let oldestTime = new Date();

    for (const [key, item] of this.cache.entries()) {
      if (item.metadata.lastAccessed < oldestTime) {
        oldestTime = item.metadata.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.totalEvictions++;
      this.emit('evicted', { key: oldestKey });
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval * 1000);
  }

  private cleanup(): void {
    const keysToDelete: string[] = [];
    
    for (const [key, item] of this.cache.entries()) {
      if (this.isExpired(item)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.delete(key));
    
    if (keysToDelete.length > 0) {
      this.emit('cleanup', { deletedCount: keysToDelete.length });
    }
  }

  private async loadFromDisk(): Promise<void> {
    if (!this.config.persistent || !this.config.persistentPath) return;

    try {
      const data = await fs.readFile(this.config.persistentPath, 'utf8');
      const exported = JSON.parse(data);
      
      for (const item of exported) {
        if (new Date(item.metadata.expiresAt) > new Date()) {
          await this.set(
            item.key,
            item.value,
            Math.ceil((new Date(item.metadata.expiresAt).getTime() - Date.now()) / 1000),
            item.metadata.tags
          );
        }
      }
      
      this.emit('loaded', { count: exported.length });
    } catch (error) {
      // File doesn't exist or is corrupted - start with empty cache
    }
  }

  private async saveToDisk(): Promise<void> {
    if (!this.config.persistent || !this.config.persistentPath) return;

    try {
      const exported = this.export();
      await fs.writeFile(this.config.persistentPath, JSON.stringify(exported, null, 2));
      this.emit('saved', { count: exported.length });
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    if (this.config.persistent) {
      await this.saveToDisk();
    }
  }
}