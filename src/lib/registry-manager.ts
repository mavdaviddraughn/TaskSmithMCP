import { promises as fs } from 'fs';
import { dirname } from 'path';
import lockFile from 'proper-lockfile';
import { ScriptRegistry, ScriptMetadata } from '../types/index.js';

export class RegistryManager {
  private registryPath: string;
  private lockOptions = {
    stale: 10000, // 10 seconds
    update: 2000, // 2 seconds
    retries: 3,
  };

  constructor(registryPath: string) {
    this.registryPath = registryPath;
  }

  /**
   * Initialize the registry file if it doesn't exist
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.registryPath);
    } catch (error) {
      // Registry file doesn't exist, create it
      const emptyRegistry: ScriptRegistry = {
        $schema: 'https://raw.githubusercontent.com/mavdaviddraughn/TaskSmithMCP/main/schema/scripts.json',
        scripts: {},
      };
      
      // Ensure directory exists
      await fs.mkdir(dirname(this.registryPath), { recursive: true });
      await this.writeRegistryUnsafe(emptyRegistry);
    }
  }

  /**
   * Read the registry with proper locking
   */
  async readRegistry(): Promise<ScriptRegistry> {
    const release = await lockFile.lock(this.registryPath, this.lockOptions);
    
    try {
      const content = await fs.readFile(this.registryPath, 'utf-8');
      const registry = JSON.parse(content) as ScriptRegistry;
      
      // Validate basic structure
      if (!registry.scripts || typeof registry.scripts !== 'object') {
        throw new Error('Invalid registry format: missing scripts object');
      }
      
      return registry;
    } catch (error) {
      throw new Error(`Failed to read registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await release();
    }
  }

  /**
   * Write the registry with proper locking
   */
  async writeRegistry(registry: ScriptRegistry): Promise<void> {
    const release = await lockFile.lock(this.registryPath, this.lockOptions);
    
    try {
      await this.writeRegistryUnsafe(registry);
    } finally {
      await release();
    }
  }

  /**
   * Write registry without locking (for internal use)
   */
  private async writeRegistryUnsafe(registry: ScriptRegistry): Promise<void> {
    // Ensure schema is set
    if (!registry.$schema) {
      registry.$schema = 'https://raw.githubusercontent.com/mavdaviddraughn/TaskSmithMCP/main/schema/scripts.json';
    }
    
    const content = JSON.stringify(registry, null, 2);
    await fs.writeFile(this.registryPath, content, 'utf-8');
  }

  /**
   * Add or update a script in the registry
   */
  async saveScript(name: string, metadata: ScriptMetadata): Promise<void> {
    const registry = await this.readRegistry();
    
    // Check if script exists to determine if this is an update
    const isUpdate = name in registry.scripts;
    const now = new Date().toISOString();
    
    if (isUpdate) {
      // Update existing script, preserve creation info
      const existing = registry.scripts[name];
      registry.scripts[name] = {
        ...metadata,
        updatedAt: now,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
      };
    } else {
      // New script
      registry.scripts[name] = {
        ...metadata,
        createdAt: now,
        updatedAt: now,
      };
    }
    
    await this.writeRegistry(registry);
  }

  /**
   * Get a specific script from the registry
   */
  async getScript(name: string): Promise<ScriptMetadata | null> {
    const registry = await this.readRegistry();
    return registry.scripts[name] || null;
  }

  /**
   * List all scripts with optional filtering
   */
  async listScripts(filter?: { 
    tags?: string[]; 
    shell?: string; 
    ttlStatus?: 'has-ttl' | 'no-ttl' | 'expired';
  }): Promise<ScriptMetadata[]> {
    const registry = await this.readRegistry();
    let scripts = Object.values(registry.scripts);
    
    if (filter?.shell) {
      scripts = scripts.filter(script => script.shell === filter.shell);
    }
    
    if (filter?.tags && filter.tags.length > 0) {
      scripts = scripts.filter(script => {
        if (!script.tags) return false;
        return filter.tags!.some(tag => script.tags!.includes(tag));
      });
    }
    
    if (filter?.ttlStatus) {
      const now = Date.now();
      scripts = scripts.filter(script => {
        switch (filter.ttlStatus) {
          case 'has-ttl':
            return script.ttlSeconds !== null && script.ttlSeconds !== undefined;
          case 'no-ttl':
            return script.ttlSeconds === null || script.ttlSeconds === undefined;
          case 'expired':
            if (!script.ttlSeconds || !script.lastUsedAt) return false;
            const lastUsed = new Date(script.lastUsedAt).getTime();
            const expiryTime = lastUsed + (script.ttlSeconds * 1000);
            return now > expiryTime;
          default:
            return true;
        }
      });
    }
    
    return scripts;
  }

  /**
   * Delete a script from the registry
   */
  async deleteScript(name: string): Promise<boolean> {
    const registry = await this.readRegistry();
    
    if (!(name in registry.scripts)) {
      return false; // Script not found
    }
    
    delete registry.scripts[name];
    await this.writeRegistry(registry);
    return true;
  }

  /**
   * Update script TTL
   */
  async setScriptTtl(name: string, ttlSeconds: number | null): Promise<boolean> {
    const registry = await this.readRegistry();
    
    if (!(name in registry.scripts)) {
      return false; // Script not found
    }
    
    registry.scripts[name].ttlSeconds = ttlSeconds;
    registry.scripts[name].updatedAt = new Date().toISOString();
    
    await this.writeRegistry(registry);
    return true;
  }

  /**
   * Update script last used timestamp
   */
  async updateLastUsed(name: string): Promise<boolean> {
    const registry = await this.readRegistry();
    
    if (!(name in registry.scripts)) {
      return false; // Script not found
    }
    
    registry.scripts[name].lastUsedAt = new Date().toISOString();
    await this.writeRegistry(registry);
    return true;
  }

  /**
   * Get scripts that are candidates for stale reporting
   */
  async getStaleScripts(olderThanDays: number): Promise<ScriptMetadata[]> {
    const registry = await this.readRegistry();
    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    return Object.values(registry.scripts).filter(script => {
      // Only consider scripts without TTL
      if (script.ttlSeconds !== null) return false;
      
      // Check if never used or last used before cutoff
      if (!script.lastUsedAt) {
        // Never used, check creation date
        const createdTime = new Date(script.createdAt).getTime();
        return createdTime < cutoffTime;
      }
      
      const lastUsedTime = new Date(script.lastUsedAt).getTime();
      return lastUsedTime < cutoffTime;
    });
  }

  /**
   * Get all script names
   */
  async getScriptNames(): Promise<string[]> {
    const registry = await this.readRegistry();
    return Object.keys(registry.scripts);
  }

  /**
   * Check if a script exists
   */
  async scriptExists(name: string): Promise<boolean> {
    const registry = await this.readRegistry();
    return name in registry.scripts;
  }

  /**
   * Get registry statistics
   */
  async getStats(): Promise<{
    totalScripts: number;
    scriptsByShell: Record<string, number>;
    scriptsWithTtl: number;
    scriptsWithoutTtl: number;
    scriptsNeverUsed: number;
  }> {
    const registry = await this.readRegistry();
    const scripts = Object.values(registry.scripts);
    
    const scriptsByShell = scripts.reduce((acc, script) => {
      acc[script.shell] = (acc[script.shell] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const scriptsWithTtl = scripts.filter(s => s.ttlSeconds !== null).length;
    const scriptsWithoutTtl = scripts.filter(s => s.ttlSeconds === null).length;
    const scriptsNeverUsed = scripts.filter(s => !s.lastUsedAt).length;
    
    return {
      totalScripts: scripts.length,
      scriptsByShell,
      scriptsWithTtl,
      scriptsWithoutTtl,
      scriptsNeverUsed,
    };
  }
}