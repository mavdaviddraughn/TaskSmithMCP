import {
  SaveScriptOptions,
  RunExecutionOptions,
  ScriptMetadata,
  RunRecord,
  StaleReportItem,
  ServerConfig,
} from '../types/index.js';
import { PathManager } from './path-manager.js';
import { RegistryManager } from './registry-manager.js';

export class TaskManager {
  private config: ServerConfig;
  private pathManager: PathManager;
  private registryManager: RegistryManager | null = null;
  private initialized = false;

  constructor() {
    // Default configuration
    this.config = {
      defaultTtlSeconds: 7 * 24 * 60 * 60, // 1 week
      allowShells: ['pwsh', 'bash', 'cmd'],
      allowAdhoc: false,
      dockerSandbox: false,
      tagPattern: 'mcp-scripts/${name}@${version}',
      maxLogSize: 10 * 1024 * 1024, // 10MB
      previewSize: 1000,
    };

    this.pathManager = new PathManager();
  }

  /**
   * Initialize the task manager (must be called before other operations)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.pathManager.initialize();
      
      // Initialize registry manager
      const registryPath = this.pathManager.getRegistryPath();
      this.registryManager = new RegistryManager(registryPath);
      await this.registryManager.initialize();
      
      // TODO: Load configuration from disk if it exists
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize TaskManager: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensure the manager is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.registryManager) {
      throw new Error('TaskManager not initialized. Call initialize() first.');
    }
  }

  async saveScript(options: SaveScriptOptions): Promise<{ success: boolean; message: string }> {
    this.ensureInitialized();
    // TODO: Implement script saving logic
    throw new Error('saveScript not yet implemented');
  }

  async runScript(options: RunExecutionOptions): Promise<{ runId: string; status: string }> {
    this.ensureInitialized();
    // TODO: Implement script execution logic
    throw new Error('runScript not yet implemented');
  }

  async listScripts(filter?: { tags?: string[]; shell?: string }): Promise<ScriptMetadata[]> {
    this.ensureInitialized();
    return await this.registryManager!.listScripts(filter);
  }

  async getScript(options: { name: string }): Promise<ScriptMetadata & { content: string }> {
    this.ensureInitialized();
    
    const metadata = await this.registryManager!.getScript(options.name);
    if (!metadata) {
      throw new Error(`Script '${options.name}' not found`);
    }
    
    // TODO: Read script content from file system
    // For now, return metadata with empty content
    return {
      ...metadata,
      content: '# TODO: Load script content from file',
    };
  }

  async setTtl(options: { name: string; ttlSeconds: number | null }): Promise<{ success: boolean }> {
    this.ensureInitialized();
    const success = await this.registryManager!.setScriptTtl(options.name, options.ttlSeconds);
    return { success };
  }

  async reportStale(options: { olderThanDays?: number }): Promise<StaleReportItem[]> {
    this.ensureInitialized();
    const olderThanDays = options.olderThanDays || 14;
    const staleScripts = await this.registryManager!.getStaleScripts(olderThanDays);
    
    const now = Date.now();
    return staleScripts.map(script => {
      const lastUsedAt = script.lastUsedAt || null;
      let daysSinceLastUse: number | null = null;
      
      if (lastUsedAt) {
        const lastUsedTime = new Date(lastUsedAt).getTime();
        daysSinceLastUse = Math.floor((now - lastUsedTime) / (24 * 60 * 60 * 1000));
      } else {
        // Never used, calculate from creation
        const createdTime = new Date(script.createdAt).getTime();
        daysSinceLastUse = Math.floor((now - createdTime) / (24 * 60 * 60 * 1000));
      }
      
      return {
        name: script.name,
        lastUsedAt,
        daysSinceLastUse,
        ttlSeconds: script.ttlSeconds || null,
        shell: script.shell,
        description: script.description,
        tags: script.tags,
      };
    });
  }

  async deleteScript(options: { name: string; reason?: string }): Promise<{ success: boolean }> {
    this.ensureInitialized();
    // TODO: Also delete script file from file system
    const success = await this.registryManager!.deleteScript(options.name);
    return { success };
  }

  async listRuns(options: {
    name?: string;
    since?: string;
    limit?: number;
    status?: string;
  }): Promise<RunRecord[]> {
    // TODO: Implement run listing logic
    throw new Error('listRuns not yet implemented');
  }

  async getRunOutput(options: { runId: string }): Promise<{ stdout: string; stderr: string }> {
    // TODO: Implement run output retrieval logic
    throw new Error('getRunOutput not yet implemented');
  }

  async searchRuns(options: {
    query: string;
    name?: string;
    regex?: boolean;
    caseSensitive?: boolean;
    limit?: number;
  }): Promise<any[]> {
    // TODO: Implement run search logic
    throw new Error('searchRuns not yet implemented');
  }

  async configure(newConfig: Partial<ServerConfig>): Promise<{ success: boolean }> {
    // Update configuration
    this.config = { ...this.config, ...newConfig };
    // TODO: Persist configuration to disk
    return { success: true };
  }

  getConfig(): ServerConfig {
    return { ...this.config };
  }

  /**
   * Get repository context information
   */
  getRepositoryInfo(): { 
    repoRoot: string; 
    scriptsDir: string; 
    tasksmithDir: string; 
    isGitRepo: boolean;
  } {
    this.ensureInitialized();
    const context = this.pathManager.getContext();
    return {
      repoRoot: context.repoRoot,
      scriptsDir: context.scriptsDir,
      tasksmithDir: context.tasksmithDir,
      isGitRepo: true, // If we got here, we found a git repo
    };
  }

  /**
   * Get the path manager instance
   */
  getPathManager(): PathManager {
    return this.pathManager;
  }
}