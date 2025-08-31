import { promises as fs } from 'fs';
import { dirname } from 'path';
import lockFile from 'proper-lockfile';
import { ScriptRegistry, ScriptMetadata, ChangelogEntry } from '../types/index.js';
import { TagManager } from './tag-manager.js';

export class RegistryManager {
  private registryPath: string;
  private lockOptions = {
    stale: 10000, // 10 seconds
    update: 2000, // 2 seconds
    retries: 3,
  };
  private gitManager?: any; // Will be injected for commit tracking

  constructor(registryPath: string) {
    this.registryPath = registryPath;
  }

  /**
   * Set git manager for changelog tracking
   */
  setGitManager(gitManager: any): void {
    this.gitManager = gitManager;
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
   * Read the registry with proper locking and automatic migration
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
      
      // Perform schema migration if needed
      const migratedRegistry = this.migrateRegistry(registry);
      
      // Write back if migration occurred
      if (migratedRegistry !== registry) {
        await this.writeRegistryUnsafe(migratedRegistry);
        return migratedRegistry;
      }
      
      return registry;
    } catch (error) {
      throw new Error(`Failed to read registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await release();
    }
  }

  /**
   * Migrate registry from v1 to v2+ schema
   */
  private migrateRegistry(registry: ScriptRegistry): ScriptRegistry {
    let migrationOccurred = false;
    const migratedScripts: Record<string, ScriptMetadata> = {};
    
    for (const [name, script] of Object.entries(registry.scripts)) {
      const migratedScript = { ...script };
      
      // Add version field if missing (v2 requirement)
      if (migratedScript.version === undefined) {
        migratedScript.version = 1;
        migrationOccurred = true;
      }
      
      // Add requireApproval field if missing (v2 requirement)
      if (migratedScript.requireApproval === undefined) {
        // Auto-determine based on tags if present
        migratedScript.requireApproval = script.tags 
          ? TagManager.shouldRequireApproval(script.tags)
          : false;
        migrationOccurred = true;
      }
      
      // Add changelog field if missing (v2 requirement)
      if (migratedScript.changelog === undefined) {
        migratedScript.changelog = [];
        migrationOccurred = true;
      }
      
      // Normalize tags if present
      if (migratedScript.tags) {
        const normalizedTags = TagManager.normalizeTags(migratedScript.tags);
        if (JSON.stringify(normalizedTags) !== JSON.stringify(migratedScript.tags)) {
          migratedScript.tags = normalizedTags;
          migrationOccurred = true;
        }
      }
      
      migratedScripts[name] = migratedScript;
    }
    
    if (migrationOccurred) {
      return {
        ...registry,
        scripts: migratedScripts
      };
    }
    
    return registry;
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
   * Add or update a script in the registry with version management
   */
  async saveScript(name: string, metadata: ScriptMetadata): Promise<void> {
    const registry = await this.readRegistry();
    
    // Check if script exists to determine if this is an update
    const isUpdate = name in registry.scripts;
    const now = new Date().toISOString();
    
    let newVersion = 1;
    let changelog: ChangelogEntry[] = [];
    
    if (isUpdate) {
      // Update existing script, preserve creation info and increment version
      const existing = registry.scripts[name];
      newVersion = (existing.version || 1) + 1;
      changelog = existing.changelog || [];
      
      // Create changelog entry
      const changelogEntry: ChangelogEntry = {
        version: newVersion,
        commit: '', // Will be filled by git manager if available
        timestamp: now,
        description: `Updated script from version ${existing.version || 1}`
      };
      
      // Try to get current commit hash if git manager is available
      if (this.gitManager) {
        try {
          changelogEntry.commit = await this.gitManager.getCurrentCommitHash();
          changelogEntry.tag = `mcp-scripts/${name}@${newVersion}`;
          
          // Create version tag automatically
          await this.gitManager.tagScriptVersion(name, newVersion, undefined, {
            includeDiffSummary: true,
            maxDiffLines: 10
          });
        } catch (error) {
          // Git not available or tag creation failed, continue without commit info
          console.warn(`Failed to create version tag for ${name}@${newVersion}:`, error);
        }
      }
      
      changelog.push(changelogEntry);
      
      // Ensure tags are normalized
      const tags = metadata.tags ? TagManager.normalizeTags(metadata.tags) : undefined;
      
      registry.scripts[name] = {
        ...metadata,
        name,
        tags,
        version: newVersion,
        requireApproval: metadata.requireApproval ?? (tags ? TagManager.shouldRequireApproval(tags) : false),
        changelog,
        updatedAt: now,
        createdAt: existing.createdAt,
        createdBy: existing.createdBy,
      };
    } else {
      // New script
      const tags = metadata.tags ? TagManager.normalizeTags(metadata.tags) : undefined;
      
      // Create initial changelog entry
      const initialChangelogEntry: ChangelogEntry = {
        version: 1,
        commit: '',
        timestamp: now,
        description: 'Initial script creation'
      };
      
      // Try to get current commit hash if git manager is available
      if (this.gitManager) {
        try {
          initialChangelogEntry.commit = await this.gitManager.getCurrentCommitHash();
          initialChangelogEntry.tag = `mcp-scripts/${name}@1`;
          
          // Create initial version tag
          await this.gitManager.tagScriptVersion(name, 1, undefined, {
            includeDiffSummary: true,
            maxDiffLines: 10
          });
        } catch (error) {
          // Git not available or tag creation failed, continue without commit info
          console.warn(`Failed to create initial version tag for ${name}@1:`, error);
        }
      }
      
      changelog = [initialChangelogEntry];
      
      registry.scripts[name] = {
        ...metadata,
        name,
        tags,
        version: 1,
        requireApproval: metadata.requireApproval ?? (tags ? TagManager.shouldRequireApproval(tags) : false),
        changelog,
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
   * Get registry statistics with v2 schema information
   */
  async getStats(): Promise<{
    totalScripts: number;
    scriptsByShell: Record<string, number>;
    scriptsWithTtl: number;
    scriptsWithoutTtl: number;
    scriptsNeverUsed: number;
    scriptsByRisk: Record<string, number>;
    scriptsByDomain: Record<string, number>;
    requireApprovalCount: number;
    averageVersion: number;
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
    const requireApprovalCount = scripts.filter(s => s.requireApproval).length;
    
    // Analyze tags
    const scriptsByRisk: Record<string, number> = {};
    const scriptsByDomain: Record<string, number> = {};
    
    scripts.forEach(script => {
      if (script.tags) {
        script.tags.forEach(tag => {
          if (tag.startsWith('risk:')) {
            scriptsByRisk[tag] = (scriptsByRisk[tag] || 0) + 1;
          } else if (tag.startsWith('domain:')) {
            scriptsByDomain[tag] = (scriptsByDomain[tag] || 0) + 1;
          }
        });
      }
    });
    
    // Calculate average version
    const totalVersions = scripts.reduce((sum, script) => sum + (script.version || 1), 0);
    const averageVersion = scripts.length > 0 ? totalVersions / scripts.length : 0;
    
    return {
      totalScripts: scripts.length,
      scriptsByShell,
      scriptsWithTtl,
      scriptsWithoutTtl,
      scriptsNeverUsed,
      scriptsByRisk,
      scriptsByDomain,
      requireApprovalCount,
      averageVersion,
    };
  }

  /**
   * Get script version history
   */
  async getScriptVersionHistory(name: string): Promise<ChangelogEntry[]> {
    const script = await this.getScript(name);
    return script?.changelog || [];
  }

  /**
   * Get scripts that require approval
   */
  async getScriptsRequiringApproval(): Promise<ScriptMetadata[]> {
    const registry = await this.readRegistry();
    return Object.values(registry.scripts).filter(script => script.requireApproval);
  }

  /**
   * Update script approval requirement
   */
  async setScriptApprovalRequirement(name: string, requireApproval: boolean): Promise<boolean> {
    const registry = await this.readRegistry();
    
    if (!(name in registry.scripts)) {
      return false; // Script not found
    }
    
    registry.scripts[name].requireApproval = requireApproval;
    registry.scripts[name].updatedAt = new Date().toISOString();
    
    await this.writeRegistry(registry);
    return true;
  }

  /**
   * Validate and normalize script tags
   */
  validateScriptTags(tags: string[]): { valid: boolean; normalized: string[]; errors: string[] } {
    const validation = TagManager.validateTags(tags);
    const normalized = TagManager.normalizeTags([...validation.structured, ...validation.unstructured]);
    
    return {
      valid: validation.valid,
      normalized,
      errors: validation.invalid.map(tag => `Invalid tag: ${tag}`)
    };
  }
}