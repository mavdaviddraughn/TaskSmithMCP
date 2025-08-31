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
   * Validate one-script-per-commit policy with enhanced options
   */
  async validateOneScriptPerCommit(
    scriptsDir: string, 
    scriptFile?: string,
    allowBatch = false
  ): Promise<{
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
      const normalizedFile = file.replace(/\\/g, '/'); // Normalize path separators
      const normalizedScriptsDir = scriptsDir.replace(/\\/g, '/');
      
      if (normalizedFile.startsWith(normalizedScriptsDir) && !normalizedFile.includes('/meta/') && 
          (file.endsWith('.ps1') || file.endsWith('.sh') || file.endsWith('.cmd'))) {
        scriptFiles.push(file);
      } else if (normalizedFile.includes('/meta/scripts.json') || normalizedFile.includes('\\meta\\scripts.json')) {
        registryFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }
    
    // Enhanced validation rules
    if (scriptFiles.length === 0 && registryFiles.length === 0 && otherFiles.length > 0) {
      return { 
        valid: false, 
        scriptFiles, 
        otherFiles, 
        error: 'No script or registry files in commit, but other files present' 
      };
    }
    
    if (scriptFiles.length > 1 && !allowBatch) {
      return { 
        valid: false, 
        scriptFiles, 
        otherFiles, 
        error: `Multiple script files in commit (batch mode disabled): ${scriptFiles.join(', ')}` 
      };
    }
    
    if (scriptFiles.length >= 1 && otherFiles.length > 0 && registryFiles.length === 0) {
      return { 
        valid: false, 
        scriptFiles, 
        otherFiles, 
        error: 'Script changes must include registry updates. Missing registry file in commit.' 
      };
    }
    
    // Registry-only commits are allowed (for maintenance operations)
    if (scriptFiles.length === 0 && registryFiles.length > 0 && otherFiles.length === 0) {
      return { valid: true, scriptFiles, otherFiles };
    }
    
    // If scriptFile specified, ensure it matches (when not in batch mode)
    if (scriptFile && !allowBatch && scriptFiles.length === 1 && !scriptFiles.includes(scriptFile)) {
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
   * Generate enhanced structured commit message (T120)
   */
  generateCommitMessage(
    action: 'add' | 'update' | 'remove', 
    scriptName: string, 
    description?: string,
    customPattern?: string
  ): string {
    if (customPattern) {
      return customPattern
        .replace('${action}', action)
        .replace('${name}', scriptName)
        .replace('${description}', description || '')
        .replace('${iso}', new Date().toISOString());
    }
    
    // Default structured format: mcp(script): action scriptName — description
    const base = `mcp(script): ${action} ${scriptName}`;
    
    if (description) {
      return `${base} — ${description}`;
    }
    
    return base;
  }

  /**
   * Generate batch commit message for multiple scripts
   */
  generateBatchCommitMessage(
    actions: Array<{ action: 'add' | 'update' | 'remove'; scriptName: string; description?: string }>,
    batchDescription?: string
  ): string {
    if (actions.length === 0) {
      return 'mcp(script): batch commit - no scripts';
    }
    
    if (actions.length === 1) {
      const { action, scriptName, description } = actions[0];
      return this.generateCommitMessage(action, scriptName, description);
    }
    
    // Multi-script batch commit
    const actionCounts = actions.reduce((acc, { action }) => {
      acc[action] = (acc[action] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const actionSummary = Object.entries(actionCounts)
      .map(([action, count]) => `${count} ${action}${count > 1 ? 's' : ''}`)
      .join(', ');
    
    const header = `mcp(script): batch commit - ${actionSummary}`;
    
    if (batchDescription) {
      return `${header} — ${batchDescription}`;
    }
    
    return header;
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
   * Commit script changes with enhanced validation and policies
   */
  async commitScriptChanges(
    scriptName: string,
    action: 'add' | 'update' | 'remove',
    scriptsDir: string,
    scriptFile?: string,
    description?: string,
    options?: {
      customMessage?: string;
      signCommit?: boolean;
      allowBatch?: boolean;
      customMessagePattern?: string;
    }
  ): Promise<GitCommitInfo> {
    const opts = options || {};
    
    // Validate commit policy with enhanced options
    const validation = await this.validateOneScriptPerCommit(
      scriptsDir, 
      scriptFile,
      opts.allowBatch
    );
    
    if (!validation.valid) {
      throw new Error(`Commit policy violation: ${validation.error}`);
    }
    
    // Generate commit message
    const message = opts.customMessage || 
      this.generateCommitMessage(action, scriptName, description, opts.customMessagePattern);
    
    // Commit the changes
    return await this.commit({
      message,
      signCommit: opts.signCommit,
    });
  }

  /**
   * Commit batch script changes
   */
  async commitBatchScriptChanges(
    actions: Array<{ action: 'add' | 'update' | 'remove'; scriptName: string; description?: string }>,
    scriptsDir: string,
    batchDescription?: string,
    options?: {
      customMessage?: string;
      signCommit?: boolean;
    }
  ): Promise<GitCommitInfo> {
    const opts = options || {};
    
    // Validate commit policy with batch allowed
    const validation = await this.validateOneScriptPerCommit(scriptsDir, undefined, true);
    
    if (!validation.valid) {
      throw new Error(`Batch commit policy violation: ${validation.error}`);
    }
    
    // Generate batch commit message
    const message = opts.customMessage || 
      this.generateBatchCommitMessage(actions, batchDescription);
    
    // Commit the changes
    return await this.commit({
      message,
      signCommit: opts.signCommit,
    });
  }

  /**
   * Create annotated tag for script version with enhanced diff summary (T124-T125)
   */
  async tagScriptVersion(
    scriptName: string,
    version: number,
    commitHash?: string,
    options?: {
      tagPattern?: string;
      force?: boolean;
      includeDiffSummary?: boolean;
      maxDiffLines?: number;
    }
  ): Promise<string> {
    const opts = {
      tagPattern: undefined,
      force: false,
      includeDiffSummary: true,
      maxDiffLines: 10,
      ...options
    };
    
    const tagName = this.generateTagName(scriptName, version, opts.tagPattern);
    
    let tagMessage = `${scriptName} v${version}`;
    
    if (opts.includeDiffSummary) {
      try {
        // Get diff for the commit (staged changes or last commit)
        const diff = await this.getDiff();
        
        if (diff) {
          const diffLines = diff.split('\n');
          const summaryLines = diffLines
            .filter(line => line.startsWith('+') || line.startsWith('-'))
            .filter(line => !line.startsWith('+++') && !line.startsWith('---'))
            .slice(0, opts.maxDiffLines);
          
          if (summaryLines.length > 0) {
            tagMessage += '\n\nChanges:\n' + summaryLines.join('\n');
            
            if (diffLines.length > opts.maxDiffLines) {
              tagMessage += `\n... (${diffLines.length - opts.maxDiffLines} more lines)`;
            }
          }
        }
      } catch (error) {
        // If diff fails, continue without summary
        tagMessage += '\n\n(Diff summary unavailable)';
      }
    }
    
    await this.createTag({
      name: tagName,
      message: tagMessage,
      annotated: true,
      force: opts.force,
    });
    
    return tagName;
  }

  /**
   * Create version tags for multiple scripts in batch
   */
  async tagScriptVersionsBatch(
    scripts: Array<{ name: string; version: number }>,
    options?: {
      tagPattern?: string;
      force?: boolean;
      batchDescription?: string;
    }
  ): Promise<string[]> {
    const opts = options || {};
    const createdTags: string[] = [];
    
    for (const script of scripts) {
      try {
        const tagName = await this.tagScriptVersion(
          script.name, 
          script.version, 
          undefined,
          {
            tagPattern: opts.tagPattern,
            force: opts.force,
            includeDiffSummary: false // Skip individual diffs in batch mode
          }
        );
        createdTags.push(tagName);
      } catch (error) {
        // Log error but continue with other tags
        console.warn(`Failed to create tag for ${script.name}@${script.version}:`, error);
      }
    }
    
    return createdTags;
  }

  /**
   * Get version tags for a specific script
   */
  async getScriptVersionTags(scriptName: string, tagPattern?: string): Promise<Array<{
    tag: string;
    version: number;
    commit: string;
    date: string;
  }>> {
    const allTags = await this.listTags();
    const pattern = tagPattern || 'mcp-scripts/${name}@${version}';
    const prefix = pattern.replace('${name}', scriptName).replace('@${version}', '@');
    
    const scriptTags = allTags
      .filter(tag => tag.startsWith(prefix))
      .map(tag => {
        const versionMatch = tag.match(/@(\d+)$/);
        if (!versionMatch) return null;
        
        return {
          tag,
          version: parseInt(versionMatch[1], 10),
          commit: '',
          date: ''
        };
      })
      .filter(Boolean) as Array<{ tag: string; version: number; commit: string; date: string }>;
    
    // Get commit info for each tag
    for (const tagInfo of scriptTags) {
      try {
        const commitInfo = await this.getCommitInfo(tagInfo.tag);
        tagInfo.commit = commitInfo.hash;
        tagInfo.date = commitInfo.date;
      } catch (error) {
        // Continue without commit info if tag doesn't exist
      }
    }
    
    return scriptTags.sort((a, b) => b.version - a.version); // Most recent first
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