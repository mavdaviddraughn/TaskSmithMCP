import { promises as fs } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { ExecutionContext } from '../types/index.js';

export class PathManager {
  private _context: ExecutionContext | null = null;

  /**
   * Initialize and detect the execution context
   */
  async initialize(startingPath?: string): Promise<ExecutionContext> {
    const workingDir = startingPath || process.cwd();
    
    try {
      const repoRoot = await this.findGitRoot(workingDir);
      const scriptsDir = join(repoRoot, 'scripts');
      const tasksmithDir = join(repoRoot, '.tasksmith');

      this._context = {
        repoRoot,
        scriptsDir,
        tasksmithDir,
        workingDir,
      };

      // Ensure required directories exist
      await this.ensureDirectoryStructure();
      
      return this._context;
    } catch (error) {
      throw new Error(`Failed to initialize repository context: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the current execution context
   */
  getContext(): ExecutionContext {
    if (!this._context) {
      throw new Error('PathManager not initialized. Call initialize() first.');
    }
    return this._context;
  }

  /**
   * Find the Git repository root directory
   */
  private async findGitRoot(startPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', ['rev-parse', '--show-toplevel'], {
        cwd: startPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          const repoRoot = stdout.trim();
          resolve(repoRoot);
        } else {
          reject(new Error(`Not in a Git repository: ${stderr.trim()}`));
        }
      });

      git.on('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`));
      });
    });
  }

  /**
   * Ensure all required directories exist
   */
  private async ensureDirectoryStructure(): Promise<void> {
    if (!this._context) throw new Error('Context not initialized');

    const { scriptsDir, tasksmithDir } = this._context;

    // Create main directories
    await this.ensureDir(scriptsDir);
    await this.ensureDir(tasksmithDir);

    // Create subdirectories for different shells
    await this.ensureDir(join(scriptsDir, 'pwsh'));
    await this.ensureDir(join(scriptsDir, 'bash'));
    await this.ensureDir(join(scriptsDir, 'cmd'));
    
    // Create meta directory for registry
    await this.ensureDir(join(scriptsDir, 'meta'));

    // Create TaskSmith internal directories
    await this.ensureDir(join(tasksmithDir, 'runs'));
    await this.ensureDir(join(tasksmithDir, 'artifacts'));

    // Create current year/month directories for runs
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    
    await this.ensureDir(join(tasksmithDir, 'runs', year));
    await this.ensureDir(join(tasksmithDir, 'runs', year, month));
    await this.ensureDir(join(tasksmithDir, 'runs', year, month, day));
  }

  /**
   * Ensure a directory exists, create it if it doesn't
   */
  private async ensureDir(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch (error) {
      // Directory doesn't exist, create it
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Get the path for a script based on its name and shell
   */
  getScriptPath(name: string, shell: 'pwsh' | 'bash' | 'cmd'): string {
    if (!this._context) throw new Error('Context not initialized');

    const extension = shell === 'pwsh' ? 'ps1' : shell === 'bash' ? 'sh' : 'cmd';
    const fileName = `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}.${extension}`;
    
    return join(this._context.scriptsDir, shell, fileName);
  }

  /**
   * Get the path for the script registry
   */
  getRegistryPath(): string {
    if (!this._context) throw new Error('Context not initialized');
    return join(this._context.scriptsDir, 'meta', 'scripts.json');
  }

  /**
   * Get the path for server configuration
   */
  getConfigPath(): string {
    if (!this._context) throw new Error('Context not initialized');
    return join(this._context.tasksmithDir, 'config.json');
  }

  /**
   * Get the path for a run record
   */
  getRunPath(runId: string): { metadataPath: string; logPath: string } {
    if (!this._context) throw new Error('Context not initialized');

    const now = new Date();
    const year = now.getFullYear().toString();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');

    const runDir = join(this._context.tasksmithDir, 'runs', year, month, day);
    
    return {
      metadataPath: join(runDir, `${runId}.json`),
      logPath: join(runDir, `${runId}.log`),
    };
  }

  /**
   * Get the path for run artifacts
   */
  getArtifactsPath(runId: string): string {
    if (!this._context) throw new Error('Context not initialized');
    return join(this._context.tasksmithDir, 'artifacts', runId);
  }

  /**
   * Resolve a path relative to the repository root
   */
  resolveFromRepo(relativePath: string): string {
    if (!this._context) throw new Error('Context not initialized');
    return join(this._context.repoRoot, relativePath);
  }

  /**
   * Check if we're in a Git repository
   */
  async isGitRepository(path?: string): Promise<boolean> {
    try {
      await this.findGitRoot(path || process.cwd());
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current Git commit hash
   */
  async getCurrentCommitHash(): Promise<string> {
    const context = this.getContext(); // This throws if not initialized
    
    return new Promise((resolve, reject) => {
      const git = spawn('git', ['rev-parse', 'HEAD'], {
        cwd: context.repoRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Failed to get commit hash: ${stderr.trim()}`));
        }
      });

      git.on('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`));
      });
    });
  }

  /**
   * Check if the working directory is clean (no uncommitted changes)
   */
  async isWorkingDirectoryClean(): Promise<boolean> {
    const context = this.getContext(); // This throws if not initialized
    
    return new Promise((resolve, reject) => {
      const git = spawn('git', ['status', '--porcelain'], {
        cwd: context.repoRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      git.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      git.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim() === '');
        } else {
          reject(new Error(`Failed to check git status: ${stderr.trim()}`));
        }
      });

      git.on('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`));
      });
    });
  }
}