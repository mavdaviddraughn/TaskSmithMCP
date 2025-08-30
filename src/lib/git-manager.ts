import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { basename } from 'path';

export interface GitCommitOptions {
  message: string;
  files?: string[];
  allowEmpty?: boolean;
  signCommit?: boolean;
}

export interface GitTagOptions {
  name: string;
  message?: string;
  annotated?: boolean;
  force?: boolean;
}

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export class GitManager {
  private repoRoot: string;
  
  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  /**
   * Check if we're in a Git repository
   */
  async isGitRepository(): Promise<boolean> {
    try {
      await this.runGitCommand(['rev-parse', '--git-dir']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommitHash(): Promise<string> {
    const result = await this.runGitCommand(['rev-parse', 'HEAD']);
    return result.stdout.trim();
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const result = await this.runGitCommand(['branch', '--show-current']);
    return result.stdout.trim();
  }

  /**
   * Check if working directory is clean
   */
  async isWorkingDirectoryClean(): Promise<boolean> {
    const result = await this.runGitCommand(['status', '--porcelain']);
    return result.stdout.trim() === '';
  }

  /**
   * Get list of staged files
   */
  async getStagedFiles(): Promise<string[]> {
    const result = await this.runGitCommand(['diff', '--cached', '--name-only']);
    return result.stdout.trim() === '' ? [] : result.stdout.trim().split('\n');
  }

  /**
   * Get list of modified files
   */
  async getModifiedFiles(): Promise<string[]> {
    const result = await this.runGitCommand(['diff', '--name-only']);
    return result.stdout.trim() === '' ? [] : result.stdout.trim().split('\n');
  }

  /**
   * Get list of untracked files
   */
  async getUntrackedFiles(): Promise<string[]> {
    const result = await this.runGitCommand(['ls-files', '--others', '--exclude-standard']);
    return result.stdout.trim() === '' ? [] : result.stdout.trim().split('\n');
  }

  /**
   * Stage specific files
   */
  async stageFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;
    
    // Validate files exist
    for (const file of files) {
      try {
        await fs.access(file);
      } catch (error) {
        throw new Error(`File does not exist: ${file}`);
      }
    }

    await this.runGitCommand(['add', ...files]);
  }

  /**
   * Stage all changes
   */
  async stageAllChanges(): Promise<void> {
    await this.runGitCommand(['add', '.']);
  }

  /**
   * Unstage files
   */
  async unstageFiles(files: string[]): Promise<void> {
    if (files.length === 0) return;
    await this.runGitCommand(['reset', 'HEAD', ...files]);
  }

  /**
   * Commit staged changes
   */
  async commit(options: GitCommitOptions): Promise<GitCommitInfo> {
    const args = ['commit'];
    
    if (options.allowEmpty) {
      args.push('--allow-empty');
    }
    
    if (options.signCommit) {
      args.push('-S');
    }
    
    args.push('-m', options.message);
    
    // If specific files provided, stage them first
    if (options.files && options.files.length > 0) {
      await this.stageFiles(options.files);
    }
    
    await this.runGitCommand(args);
    
    // Get commit info
    return await this.getCommitInfo('HEAD');
  }

  /**
   * Create a tag
   */
  async createTag(options: GitTagOptions): Promise<void> {
    const args = ['tag'];
    
    if (options.force) {
      args.push('-f');
    }
    
    if (options.annotated && options.message) {
      args.push('-a', '-m', options.message);
    } else if (options.message) {
      args.push('-m', options.message);
    }
    
    args.push(options.name);
    
    await this.runGitCommand(args);
  }

  /**
   * Delete a tag
   */
  async deleteTag(tagName: string): Promise<void> {
    await this.runGitCommand(['tag', '-d', tagName]);
  }

  /**
   * List all tags
   */
  async listTags(): Promise<string[]> {
    const result = await this.runGitCommand(['tag', '-l']);
    return result.stdout.trim() === '' ? [] : result.stdout.trim().split('\n');
  }

  /**
   * Check if a tag exists
   */
  async tagExists(tagName: string): Promise<boolean> {
    try {
      await this.runGitCommand(['rev-parse', `refs/tags/${tagName}`]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get commit information
   */
  async getCommitInfo(ref = 'HEAD'): Promise<GitCommitInfo> {
    const result = await this.runGitCommand([
      'log', 
      '-1', 
      '--pretty=format:%H%n%s%n%an <%ae>%n%ai', 
      ref
    ]);
    
    const lines = result.stdout.trim().split('\n');
    return {
      hash: lines[0],
      message: lines[1],
      author: lines[2],
      date: lines[3],
    };
  }

  /**
   * Get file diff
   */
  async getDiff(file?: string, staged = false): Promise<string> {
    const args = ['diff'];
    
    if (staged) {
      args.push('--cached');
    }
    
    if (file) {
      args.push(file);
    }
    
    const result = await this.runGitCommand(args);
    return result.stdout;
  }

  /**
   * Validate one-script-per-commit policy
   */
  async validateOneScriptPerCommit(scriptsDir: string, scriptFile?: string): Promise<{
    valid: boolean;
    scriptFiles: string[];
    otherFiles: string[];
    error?: string;
  }> {
    // Get all staged files
    const stagedFiles = await this.getStagedFiles();
    
    if (stagedFiles.length === 0) {
      return { valid: false, scriptFiles: [], otherFiles: [], error: 'No files staged for commit' };
    }
    
    // Categorize files
    const scriptFiles: string[] = [];
    const registryFiles: string[] = [];
    const otherFiles: string[] = [];
    
    for (const file of stagedFiles) {
      const fileName = basename(file);
      
      if (file.startsWith(scriptsDir) && !file.includes('/meta/') && 
          (file.endsWith('.ps1') || file.endsWith('.sh') || file.endsWith('.cmd'))) {
        scriptFiles.push(file);
      } else if (file.includes('/meta/scripts.json')) {
        registryFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }
    
    // Validation rules
    if (scriptFiles.length === 0 && otherFiles.length > 0) {
      return { 
        valid: false, 
        scriptFiles, 
        otherFiles, 
        error: 'No script files in commit, but other files present' 
      };
    }
    
    if (scriptFiles.length > 1) {
      return { 
        valid: false, 
        scriptFiles, 
        otherFiles, 
        error: `Multiple script files in commit: ${scriptFiles.join(', ')}` 
      };
    }
    
    if (scriptFiles.length === 1 && otherFiles.length > 0 && registryFiles.length === 0) {
      return { 
        valid: false, 
        scriptFiles, 
        otherFiles, 
        error: 'Script changes must be committed with registry updates only' 
      };
    }
    
    // If scriptFile specified, ensure it matches
    if (scriptFile && scriptFiles.length === 1 && !scriptFiles.includes(scriptFile)) {
      return { 
        valid: false, 
        scriptFiles, 
        otherFiles, 
        error: `Expected script ${scriptFile} but found ${scriptFiles[0]}` 
      };
    }
    
    return { valid: true, scriptFiles, otherFiles };
  }

  /**
   * Generate standardized commit message
   */
  generateCommitMessage(
    action: 'add' | 'update' | 'remove', 
    scriptName: string, 
    description?: string
  ): string {
    const verb = action === 'add' ? 'Add' : action === 'update' ? 'Update' : 'Remove';
    const base = `mcp(script): ${action} ${scriptName}`;
    
    if (description) {
      return `${base} — ${description}`;
    }
    
    return base;
  }

  /**
   * Generate standardized tag name
   */
  generateTagName(scriptName: string, version: number, pattern?: string): string {
    if (pattern) {
      return pattern
        .replace('${name}', scriptName)
        .replace('${version}', version.toString())
        .replace('${iso}', new Date().toISOString());
    }
    
    return `mcp-scripts/${scriptName}@${version}`;
  }

  /**
   * Commit script changes with validation
   */
  async commitScriptChanges(
    scriptName: string,
    action: 'add' | 'update' | 'remove',
    scriptsDir: string,
    scriptFile?: string,
    description?: string,
    customMessage?: string,
    signCommit = false
  ): Promise<GitCommitInfo> {
    // Validate one-script-per-commit policy
    const validation = await this.validateOneScriptPerCommit(scriptsDir, scriptFile);
    
    if (!validation.valid) {
      throw new Error(`Commit policy violation: ${validation.error}`);
    }
    
    // Generate commit message
    const message = customMessage || this.generateCommitMessage(action, scriptName, description);
    
    // Commit the changes
    return await this.commit({
      message,
      signCommit,
    });
  }

  /**
   * Create annotated tag for script version
   */
  async tagScriptVersion(
    scriptName: string,
    version: number,
    commitHash?: string,
    tagPattern?: string,
    force = false
  ): Promise<string> {
    const tagName = this.generateTagName(scriptName, version, tagPattern);
    
    // Create short summary for tag message
    const diff = await this.getDiff();
    const shortSummary = diff.split('\n').slice(0, 5).join('\n');
    const tagMessage = `${scriptName} v${version}\n\nChanges:\n${shortSummary}`;
    
    await this.createTag({
      name: tagName,
      message: tagMessage,
      annotated: true,
      force,
    });
    
    return tagName;
  }

  /**
   * Run a git command and return the result
   */
  private async runGitCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, {
        cwd: this.repoRoot,
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
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Git command failed: ${stderr.trim() || stdout.trim()}`));
        }
      });

      git.on('error', (error) => {
        reject(new Error(`Git command failed: ${error.message}`));
      });
    });
  }
}