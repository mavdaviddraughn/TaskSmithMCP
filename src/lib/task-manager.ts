import {
  SaveScriptOptions,
  RunExecutionOptions,
  ScriptMetadata,
  RunRecord,
  StaleReportItem,
  ServerConfig,
} from '../types/index.js';
import { PathManager } from './path-manager.js';

export class TaskManager {
  private config: ServerConfig;
  private pathManager: PathManager;
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
    if (!this.initialized) {
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
    // TODO: Implement script listing logic
    throw new Error('listScripts not yet implemented');
  }

  async getScript(options: { name: string }): Promise<ScriptMetadata & { content: string }> {
    this.ensureInitialized();
    // TODO: Implement script retrieval logic
    throw new Error('getScript not yet implemented');
  }

  async setTtl(options: { name: string; ttlSeconds: number | null }): Promise<{ success: boolean }> {
    // TODO: Implement TTL setting logic
    throw new Error('setTtl not yet implemented');
  }

  async reportStale(options: { olderThanDays?: number }): Promise<StaleReportItem[]> {
    // TODO: Implement stale reporting logic
    throw new Error('reportStale not yet implemented');
  }

  async deleteScript(options: { name: string; reason?: string }): Promise<{ success: boolean }> {
    // TODO: Implement script deletion logic
    throw new Error('deleteScript not yet implemented');
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