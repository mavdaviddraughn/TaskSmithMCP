import {
  SaveScriptOptions,
  RunExecutionOptions,
  ScriptMetadata,
  RunRecord,
  StaleReportItem,
  ServerConfig,
  ArgumentValidationResult,
  EnhancedRunExecutionOptions,
  EnhancedSaveScriptOptions,
  OutputManagementOptions,
  FilterResult,
  ExportResult,
} from '../types/index.js';
import { PathManager } from './path-manager.js';
import { RegistryManager } from './registry-manager.js';
import { GitManager } from './git-manager.js';
import { ParameterValidator } from './parameter-validator.js';
import { ArgumentMaterializer } from './argument-materializer.js';
import { StreamManager } from './stream-manager.js';
import { ProgressTracker } from './progress-tracker.js';
import { OutputFormatter } from './output-formatter.js';
import { OutputFilter } from './output-filter.js';
import { ResultCache } from './result-cache.js';
import { OutputExporter } from './output-exporter.js';
import { promises as fs } from 'fs';
import { dirname } from 'path';
import { spawn } from 'child_process';
import { randomUUID } from 'crypto';

export class TaskManager {
  private config: ServerConfig;
  private pathManager: PathManager;
  private registryManager: RegistryManager | null = null;
  private gitManager: GitManager | null = null;
  private parameterValidator: ParameterValidator;
  private argumentMaterializer: ArgumentMaterializer;
  private streamManager: StreamManager | null = null;
  private progressTracker: ProgressTracker | null = null;
  private outputFormatter: OutputFormatter | null = null;
  private outputFilter: OutputFilter | null = null;
  private resultCache: ResultCache | null = null;
  private outputExporter: OutputExporter | null = null;
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
      // Enhanced Git Integration (T119-T122)
      allowBatchCommits: false,
      requireGpgSigning: false,
      enforceStrictCommitPolicy: true,
    };

    this.pathManager = new PathManager();
    this.parameterValidator = new ParameterValidator();
    this.argumentMaterializer = new ArgumentMaterializer();
  }

  /**
   * Initialize output management components
   */
  private initializeOutputManagement(): void {
    // Initialize output management components with default configuration
    this.streamManager = new StreamManager({
      stdout: {
        maxChunks: 5000,
        maxBytes: 50 * 1024 * 1024, // 50MB
        maxLines: 10000,
        retentionMode: 'size',
        retentionValue: 50 * 1024 * 1024
      },
      stderr: {
        maxChunks: 2500,
        maxBytes: 25 * 1024 * 1024, // 25MB
        maxLines: 5000,
        retentionMode: 'size',
        retentionValue: 25 * 1024 * 1024
      },
      enableInterleaving: true,
      errorDetectionPatterns: [
        /error:/i,
        /exception:/i,
        /fatal:/i,
        /failed:/i,
        /cannot/i,
        /unable to/i
      ],
      warningDetectionPatterns: [
        /warning:/i,
        /warn:/i,
        /deprecated/i,
        /obsolete/i
      ]
    });

    this.progressTracker = new ProgressTracker({
      type: 'spinner',
      refreshRate: 100,
      showElapsed: true,
      showETA: true,
      showPercentage: true,
      width: 40
    });

    this.outputFormatter = new OutputFormatter({
      format: 'ansi',
      includeTimestamps: true,
      timestampFormat: 'ISO',
      includeLineNumbers: true,
      includeSource: true,
      highlightErrors: true,
      highlightWarnings: true,
      stripAnsi: false,
      colorScheme: {
        error: '\x1b[31m',    // Red
        warning: '\x1b[33m',  // Yellow
        info: '\x1b[32m',     // Green
        debug: '\x1b[36m',    // Cyan
        timestamp: '\x1b[90m', // Gray
        lineNumber: '\x1b[90m', // Gray
        stdout: '\x1b[37m',   // White
        stderr: '\x1b[91m'    // Bright Red
      },
      syntaxHighlighting: {
        enabled: true,
        detectLanguage: true,
        themes: {
          monokai: {
            keyword: '\x1b[35m',    // Magenta
            string: '\x1b[32m',     // Green
            number: '\x1b[36m',     // Cyan
            comment: '\x1b[90m',    // Gray
            operator: '\x1b[37m',   // White
            function: '\x1b[33m',   // Yellow
            variable: '\x1b[37m'    // White
          }
        },
        currentTheme: 'monokai'
      }
    });

    this.outputFilter = new OutputFilter();

    // Initialize cache with default configuration
    this.resultCache = new ResultCache({
      maxItems: 1000,
      maxMemoryMB: 100, // 100MB
      defaultTTL: 7 * 24 * 60 * 60, // 7 days in seconds
      enableCompression: true,
      compressionThreshold: 1024, // 1KB
      persistent: true,
      cleanupInterval: 3600 // 1 hour
    });

    this.outputExporter = new OutputExporter();
  }

  /**
   * Setup output management for a specific script run
   */
  private async setupOutputManagementForRun(
    runId: string,
    options?: OutputManagementOptions
  ): Promise<void> {
    // Output management components are already initialized
    // They're ready to use for this run
  }

  /**
   * Get the appropriate shell command for the given shell type
   */
  private getShellCommand(shell: 'pwsh' | 'bash' | 'cmd'): string {
    switch (shell) {
      case 'pwsh':
        return 'powershell.exe';
      case 'bash':
        return 'bash';
      case 'cmd':
        return 'cmd.exe';
      default:
        throw new Error(`Unsupported shell: ${shell}`);
    }
  }

  /**
   * Execute script with streaming output management
   */
  private async executeScriptWithStreaming(
    command: string,
    args: string[],
    options: {
      cwd: string;
      stdin?: string | null;
      runId: string;
      outputOptions: OutputManagementOptions;
    }
  ): Promise<{
    exitCode: number;
    endTime: string;
    duration: number;
    stdout: string;
    stderr: string;
  }> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: options.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false
      });

      let stdoutBuffer = '';
      let stderrBuffer = '';

      // Handle stdout streaming
      child.stdout?.on('data', (data: Buffer) => {
        const content = data.toString();
        stdoutBuffer += content;
        
        if (this.streamManager) {
          this.streamManager.writeStdout(content);
        }
      });

      // Handle stderr streaming
      child.stderr?.on('data', (data: Buffer) => {
        const content = data.toString();
        stderrBuffer += content;
        
        if (this.streamManager) {
          this.streamManager.writeStderr(content);
        }
      });

      // Handle stdin if provided
      if (options.stdin && child.stdin) {
        child.stdin.write(options.stdin);
        child.stdin.end();
      }

      // Handle process completion
      child.on('close', (code: number | null) => {
        const endTime = new Date().toISOString();
        const duration = Date.now() - startTime;

        resolve({
          exitCode: code ?? -1,
          endTime,
          duration,
          stdout: stdoutBuffer,
          stderr: stderrBuffer
        });
      });

      // Handle process errors
      child.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Initialize the task manager (must be called before other operations)
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.pathManager.initialize();
      const context = this.pathManager.getContext();
      
      // Initialize registry manager
      const registryPath = this.pathManager.getRegistryPath();
      this.registryManager = new RegistryManager(registryPath);
      await this.registryManager.initialize();
      
      // Initialize git manager
      this.gitManager = new GitManager(context.repoRoot);
      
      // Verify we're in a git repository
      const isGitRepo = await this.gitManager.isGitRepository();
      if (!isGitRepo) {
        throw new Error('TaskManager requires a Git repository');
      }
      
      // Inject git manager into registry manager for changelog tracking
      this.registryManager.setGitManager(this.gitManager);
      
      // Initialize output management system
      this.initializeOutputManagement();
      
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
    if (!this.initialized || !this.registryManager || !this.gitManager) {
      throw new Error('TaskManager not initialized. Call initialize() first.');
    }
  }

  async saveScript(options: SaveScriptOptions): Promise<{ success: boolean; message: string }> {
    this.ensureInitialized();
    
    try {
      // Validate required fields
      if (!options.name || !options.shell || !options.content) {
        throw new Error('Name, shell, and content are required');
      }

      // Validate script name (no slashes or special characters)
      if (!/^[a-zA-Z0-9_-]+$/.test(options.name)) {
        throw new Error('Script name can only contain letters, numbers, hyphens, and underscores');
      }

      // Validate shell
      const validShells = ['pwsh', 'bash', 'cmd'];
      if (!validShells.includes(options.shell)) {
        throw new Error(`Shell must be one of: ${validShells.join(', ')}`);
      }

      const context = this.pathManager.getContext();
      const shellDir = `${context.scriptsDir}/${options.shell}`;
      const extension = options.shell === 'pwsh' ? 'ps1' : options.shell === 'bash' ? 'sh' : 'cmd';
      const scriptPath = `${shellDir}/${options.name}.${extension}`;
      
      // Check if script already exists
      const existingScript = await this.registryManager!.getScript(options.name);
      
      // Create directory if it doesn't exist
      await fs.mkdir(dirname(scriptPath), { recursive: true });
      
      // Write script content to file
      await fs.writeFile(scriptPath, options.content, 'utf-8');
      
      // Update or create registry entry
      const now = new Date().toISOString();
      const scriptMetadata: ScriptMetadata = {
        name: options.name,
        shell: options.shell,
        path: scriptPath,
        description: options.description || '',
        tags: options.tags || [],
        ttlSeconds: options.ttlSeconds || null,
        cwdStrategy: options.cwdStrategy || 'repoRoot',
        precheck: options.precheck,
        argsSchema: options.argsSchema || null,
        createdAt: existingScript?.createdAt || now,
        updatedAt: now,
        lastUsedAt: existingScript?.lastUsedAt || null,
        createdBy: 'system', // TODO: Get actual user
        updatedBy: 'system'  // TODO: Get actual user
      };
      
      // Save to registry (always use saveScript - it handles both create and update)
      await this.registryManager!.saveScript(options.name, scriptMetadata);
      
      // Stage files for git commit
      // Make paths relative to repository root
      const relativeScriptPath = scriptPath.replace(`${context.repoRoot}\\`, '').replace(`${context.repoRoot}/`, '');
      const relativeRegistryPath = this.pathManager.getRegistryPath().replace(`${context.repoRoot}\\`, '').replace(`${context.repoRoot}/`, '');
      
      await this.gitManager!.stageFiles([relativeScriptPath, relativeRegistryPath]);
      
      // Validate commit policy with enhanced options
      const validation = await this.gitManager!.validateOneScriptPerCommit(
        context.scriptsDir, 
        relativeScriptPath,
        this.config.allowBatchCommits
      );
      
      if (!validation.valid && this.config.enforceStrictCommitPolicy) {
        throw new Error(`Commit policy violation: ${validation.error}`);
      }
      
      // Generate commit message with enhanced format
      const action = existingScript ? 'update' : 'add';
      const commitMessage = options.commitMessage || 
        this.gitManager!.generateCommitMessage(
          action, 
          options.name, 
          options.description,
          this.config.customCommitMessagePattern
        );
      
      // Commit the changes with enhanced options
      await this.gitManager!.commit({ 
        message: commitMessage,
        signCommit: this.config.requireGpgSigning
      });
      
      // Create tag if specified
      if (options.tag) {
        await this.gitManager!.createTag({ 
          name: options.tag, 
          message: `Tag for script ${options.name}`,
          annotated: true 
        });
      }
      
      return { 
        success: true, 
        message: existingScript ? `Script '${options.name}' updated successfully` : `Script '${options.name}' created successfully` 
      };
      
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to save script: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Enhanced saveScript with argument schema validation (T126)
   */
  async saveScriptEnhanced(options: EnhancedSaveScriptOptions): Promise<{ success: boolean; message: string; version?: number }> {
    // Validate argument schema if provided
    if (options.argsSchema && (options.validateArgsSchema !== false)) {
      const schemaValidation = this.parameterValidator.validateSchema(options.argsSchema);
      if (!schemaValidation.valid) {
        return {
          success: false,
          message: `Invalid arguments schema: ${schemaValidation.errors.join(', ')}`
        };
      }
    }

    // Call existing saveScript logic
    const result = await this.saveScript(options);
    return {
      ...result,
      version: 1 // TODO: Get actual version from registry v2
    };
  }

  /**
   * Validate arguments against a script schema without executing (T129)
   */
  async validateScriptArguments(
    name: string,
    args: (string | number | boolean)[]
  ): Promise<{ success: boolean; message: string; validation?: ArgumentValidationResult }> {
    this.ensureInitialized();
    
    const script = await this.registryManager!.getScript(name);
    if (!script) {
      return { success: false, message: `Script '${name}' not found` };
    }

    if (!script.argsSchema) {
      return { success: true, message: 'No argument schema defined for this script' };
    }

    const validation = this.parameterValidator.validateArguments(script.argsSchema, args);
    
    if (!validation.valid) {
      return {
        success: false,
        message: `Validation failed: ${validation.errors.join(', ')}`,
        validation
      };
    }

    return {
      success: true,
      message: 'Arguments validated successfully',
      validation
    };
  }

  /**
   * Preview how arguments will be materialized for shell execution (T127-T128)
   */
  async previewArgumentMaterialization(
    name: string,
    args: (string | number | boolean)[]
  ): Promise<{ success: boolean; message: string; preview?: any }> {
    this.ensureInitialized();
    
    const script = await this.registryManager!.getScript(name);
    if (!script) {
      return { success: false, message: `Script '${name}' not found` };
    }

    if (!script.argsSchema) {
      return { 
        success: true, 
        message: 'No argument schema defined - arguments will be passed as-is',
        preview: { 
          originalArgs: args, 
          materializedArgs: args.map(String),
          shell: script.shell,
          schema: null
        }
      };
    }

    const validation = this.parameterValidator.validateArguments(script.argsSchema, args);
    
    if (!validation.valid) {
      return {
        success: false,
        message: `Validation failed: ${validation.errors.join(', ')}`
      };
    }

    const materializedResult = await this.argumentMaterializer.materializeArguments(
      {
        shell: script.shell,
        argsSchema: script.argsSchema,
        providedArgs: args
      },
      validation
    );

    return {
      success: true,
      message: 'Argument materialization preview',
      preview: {
        originalArgs: args,
        processedValues: materializedResult.processedValues,
        materializedArgs: materializedResult.materializedArgs,
        shell: script.shell,
        schema: script.argsSchema
      }
    };
  }

  /**
   * Enhanced runScript with typed parameter validation and materialization (T129)
   */
  async runScriptEnhanced(options: EnhancedRunExecutionOptions): Promise<any> {
    this.ensureInitialized();
    
    try {
      // Get script metadata
      const script = await this.registryManager!.getScript(options.name);
      if (!script) {
        return { success: false, message: `Script '${options.name}' not found` };
      }

      // Validate and materialize arguments if schema exists
      let validationResult: ArgumentValidationResult | null = null;
      if (script.argsSchema && options.args) {
        validationResult = this.parameterValidator.validateArguments(
          script.argsSchema,
          options.args
        );

        if (!validationResult.valid) {
          return {
            success: false,
            message: `Argument validation failed: ${validationResult.errors.join(', ')}`
          };
        }

        // Materialize arguments for shell execution
        const materializedResult = await this.argumentMaterializer.materializeArguments(
          {
            shell: script.shell,
            argsSchema: script.argsSchema,
            providedArgs: options.args
          },
          validationResult
        );

        if (!materializedResult.valid) {
          return {
            success: false,
            message: `Argument materialization failed: ${materializedResult.errors.join(', ')}`
          };
        }

        validationResult = materializedResult;
      }

      // Handle special validation modes
      if (options.validateOnly) {
        return {
          success: true,
          message: 'Arguments validated successfully',
          validation: validationResult
        };
      }

      if (options.materializedPreview) {
        return {
          success: true,
          message: 'Argument materialization preview',
          validation: validationResult,
          preview: {
            originalArgs: options.args,
            materializedArgs: validationResult?.materializedArgs || [],
            processedValues: validationResult?.processedValues || {}
          }
        };
      }

      // Use materialized arguments for execution
      const executionArgs = validationResult?.materializedArgs || options.args?.map(String) || [];

      // TODO: Implement actual script execution with materialized args
      return {
        success: true,
        message: 'Script execution would proceed with materialized arguments',
        materializedArgs: executionArgs
      };

    } catch (error) {
      return {
        success: false,
        message: `Script execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Enhanced runScript with comprehensive output management (T130-T143)
   */
  async runScript(
    options: RunExecutionOptions,
    outputOptions?: OutputManagementOptions
  ): Promise<{ 
    runId: string; 
    status: 'completed' | 'failed' | 'running'; 
    exitCode?: number;
    execution?: {
      start: string;
      end?: string;
      duration?: number;
      stdout?: string;
      stderr?: string;
      filteredOutput?: FilterResult;
      exportResult?: ExportResult;
    };
  }> {
    this.ensureInitialized();
    
    const runId = randomUUID();
    const startTime = new Date().toISOString();
    
    try {
      // Get script metadata
      const script = await this.registryManager!.getScript(options.name);
      if (!script) {
        return { 
          runId, 
          status: 'failed',
          execution: {
            start: startTime,
            end: new Date().toISOString()
          }
        };
      }

      // Validate and materialize arguments if needed
      let executionArgs = options.args?.map(String) || [];
      if (script.argsSchema && options.args) {
        const validation = this.parameterValidator.validateArguments(
          script.argsSchema,
          options.args
        );

        if (!validation.valid) {
          return {
            runId,
            status: 'failed',
            execution: {
              start: startTime,
              end: new Date().toISOString()
            }
          };
        }

        const materializedResult = await this.argumentMaterializer.materializeArguments(
          {
            shell: script.shell,
            argsSchema: script.argsSchema,
            providedArgs: options.args
          },
          validation
        );

        if (materializedResult.valid) {
          executionArgs = materializedResult.materializedArgs;
        }
      }

      // Handle dry run mode
      if (options.dryRun) {
        return {
          runId,
          status: 'completed',
          exitCode: 0,
          execution: {
            start: startTime,
            end: new Date().toISOString(),
            duration: 0,
            stdout: `[DRY RUN] Would execute: ${script.name} with args: ${executionArgs.join(' ')}`,
            stderr: ''
          }
        };
      }

      // Initialize output management for this run
      await this.setupOutputManagementForRun(runId, outputOptions);

      // Start progress tracking if enabled
      if (outputOptions?.progress?.enabled !== false) {
        // Progress tracking ready (simplified for now)
      }

      // Determine working directory
      const context = this.pathManager.getContext();
      const workingDir = script.cwdStrategy === 'scriptDir' 
        ? dirname(script.path)
        : context.repoRoot;

      // Prepare execution command
      const shellCommand = this.getShellCommand(script.shell);
      const fullArgs = [script.path, ...executionArgs];

      // Execute script with output streaming
      const result = await this.executeScriptWithStreaming(
        shellCommand,
        fullArgs,
        {
          cwd: workingDir,
          stdin: options.stdin,
          runId,
          outputOptions: outputOptions || {}
        }
      );

      // Update progress tracker (simplified)
      // Progress tracking completed

      // Process output with filtering if configured (simplified)
      let filteredOutput: FilterResult | undefined;
      if (outputOptions?.filtering && this.streamManager) {
        const allOutput = this.streamManager.getCombined();
        // Basic filtering for now
        filteredOutput = {
          chunks: allOutput,
          totalMatches: allOutput.length,
          totalFiltered: 0,
          executionTime: 0
        };
      }

      // Handle export if configured (simplified)
      let exportResult: ExportResult | undefined;
      if (outputOptions?.export && this.outputExporter && this.streamManager) {
        const exportData = this.streamManager.getCombined();
        const context = this.pathManager.getContext();
        const exportPath = `${context.tasksmithDir}/output/${runId}-output`;
        
        // Skip export for now due to interface mismatch
        // TODO: Fix OutputChunk interface compatibility
        exportResult = {
          success: false,
          format: outputOptions.export.format,
          size: 0,
          compressed: false,
          error: 'Export temporarily disabled due to interface mismatch'
        };
      }

      // Cache result if caching is enabled
      if (outputOptions?.caching?.ttlMs && this.resultCache) {
        const cacheKey = `run:${script.name}:${JSON.stringify(executionArgs)}`;
        await this.resultCache.set(cacheKey, {
          runId,
          script: script.name,
          args: executionArgs,
          result,
          filteredOutput,
          exportResult
        });
      }

      // Update script usage timestamp (simplified - just update registry)
      const updatedMetadata = { ...script, lastUsedAt: new Date().toISOString() };
      await this.registryManager!.saveScript(script.name, updatedMetadata);

      return {
        runId,
        status: result.exitCode === 0 ? 'completed' : 'failed',
        exitCode: result.exitCode,
        execution: {
          start: startTime,
          end: result.endTime,
          duration: result.duration,
          stdout: result.stdout,
          stderr: result.stderr,
          filteredOutput,
          exportResult
        }
      };

    } catch (error) {
      // Complete progress tracker on error (simplified)
      // Progress tracking would be completed here

      return {
        runId,
        status: 'failed',
        execution: {
          start: startTime,
          end: new Date().toISOString(),
          stderr: `Execution error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      };
    }
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
    
    try {
      // Read script content from file system
      const content = await fs.readFile(metadata.path, 'utf-8');
      
      return {
        ...metadata,
        content,
      };
    } catch (error) {
      throw new Error(`Failed to read script content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
    
    try {
      // Get script metadata to find the file path
      const metadata = await this.registryManager!.getScript(options.name);
      if (!metadata) {
        // Script doesn't exist - return success: false instead of throwing
        return { success: false };
      }
      
      // Delete from registry first
      const registrySuccess = await this.registryManager!.deleteScript(options.name);
      if (!registrySuccess) {
        throw new Error('Failed to remove script from registry');
      }
      
      // Delete script file from file system
      try {
        await fs.unlink(metadata.path);
      } catch (error) {
        // File might not exist, that's okay
        console.warn(`Could not delete script file ${metadata.path}:`, error);
      }

      // Stage the registry file for commit
      await this.gitManager!.stageFiles(['scripts/meta/scripts.json']);
      
      // Generate commit message
      const commitMessage = this.gitManager!.generateCommitMessage(
        'remove', 
        options.name, 
        options.reason
      );
      
      // Commit the changes
      await this.gitManager!.commit({ message: commitMessage });
      
      return { success: true };
      
    } catch (error) {
      console.error('Failed to delete script:', error);
      return { success: false };
    }
  }

  async listRuns(_options: {
    name?: string;
    since?: string;
    limit?: number;
    status?: string;
  }): Promise<RunRecord[]> {
    // TODO: Implement run listing logic
    throw new Error('listRuns not yet implemented');
  }

  async getRunOutput(_options: { runId: string }): Promise<{ stdout: string; stderr: string }> {
    // TODO: Implement run output retrieval logic
    throw new Error('getRunOutput not yet implemented');
  }

  async searchRuns(_options: {
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
  async getRepositoryInfo(): Promise<{ 
    repoRoot: string; 
    scriptsDir: string; 
    tasksmithDir: string; 
    isGitRepo: boolean;
    currentBranch?: string;
    currentCommit?: string;
    isClean?: boolean;
  }> {
    this.ensureInitialized();
    const context = this.pathManager.getContext();
    
    try {
      const isGitRepo = await this.gitManager!.isGitRepository();
      let currentBranch: string | undefined;
      let currentCommit: string | undefined;
      let isClean: boolean | undefined;
      
      if (isGitRepo) {
        currentBranch = await this.gitManager!.getCurrentBranch();
        currentCommit = await this.gitManager!.getCurrentCommitHash();
        isClean = await this.gitManager!.isWorkingDirectoryClean();
      }
      
      return {
        repoRoot: context.repoRoot,
        scriptsDir: context.scriptsDir,
        tasksmithDir: context.tasksmithDir,
        isGitRepo,
        currentBranch,
        currentCommit,
        isClean,
      };
    } catch (error) {
      return {
        repoRoot: context.repoRoot,
        scriptsDir: context.scriptsDir,
        tasksmithDir: context.tasksmithDir,
        isGitRepo: false,
      };
    }
  }

  /**
   * Get the path manager instance
   */
  getPathManager(): PathManager {
    return this.pathManager;
  }

  /**
   * Get the git manager instance
   */
  getGitManager(): GitManager {
    this.ensureInitialized();
    return this.gitManager!;
  }

  // Schema v2 Methods

  /**
   * Get script version history
   */
  async getScriptVersionHistory(options: { name: string }): Promise<{ success: boolean; changelog?: any[]; message?: string }> {
    this.ensureInitialized();
    
    try {
      const changelog = await this.registryManager!.getScriptVersionHistory(options.name);
      return { success: true, changelog };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to get version history: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get scripts requiring approval
   */
  async getScriptsRequiringApproval(): Promise<ScriptMetadata[]> {
    this.ensureInitialized();
    return await this.registryManager!.getScriptsRequiringApproval();
  }

  /**
   * Set script approval requirement
   */
  async setScriptApprovalRequirement(options: { name: string; requireApproval: boolean }): Promise<{ success: boolean; message?: string }> {
    this.ensureInitialized();
    
    try {
      const success = await this.registryManager!.setScriptApprovalRequirement(options.name, options.requireApproval);
      if (!success) {
        return { success: false, message: `Script '${options.name}' not found` };
      }
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to set approval requirement: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Validate script tags
   */
  validateScriptTags(tags: string[]): { valid: boolean; normalized: string[]; errors: string[] } {
    this.ensureInitialized();
    return this.registryManager!.validateScriptTags(tags);
  }

  /**
   * Get enhanced registry statistics
   */
  async getRegistryStats(): Promise<any> {
    this.ensureInitialized();
    return await this.registryManager!.getStats();
  }

  // Enhanced Git Integration Methods (T119-T125)

  /**
   * Get version tags for a specific script
   */
  async getScriptVersionTags(options: { name: string }): Promise<Array<{
    tag: string;
    version: number;
    commit: string;
    date: string;
  }>> {
    this.ensureInitialized();
    return await this.gitManager!.getScriptVersionTags(options.name, this.config.tagPattern);
  }

  /**
   * Create version tag manually (if automatic tagging failed)
   */
  async createScriptVersionTag(options: { 
    name: string; 
    version: number; 
    force?: boolean;
    includeDiffSummary?: boolean;
  }): Promise<{ success: boolean; tagName?: string; message?: string }> {
    this.ensureInitialized();
    
    try {
      const tagName = await this.gitManager!.tagScriptVersion(
        options.name,
        options.version,
        undefined,
        {
          tagPattern: this.config.tagPattern,
          force: options.force || false,
          includeDiffSummary: options.includeDiffSummary !== false
        }
      );
      
      return { success: true, tagName };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to create version tag: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Configure git policies and options
   */
  async configureGitPolicies(options: {
    allowBatchCommits?: boolean;
    requireGpgSigning?: boolean;
    customCommitMessagePattern?: string;
    enforceStrictCommitPolicy?: boolean;
    tagPattern?: string;
  }): Promise<{ success: boolean; message?: string }> {
    this.ensureInitialized();
    
    try {
      // Update configuration
      if (options.allowBatchCommits !== undefined) {
        this.config.allowBatchCommits = options.allowBatchCommits;
      }
      if (options.requireGpgSigning !== undefined) {
        this.config.requireGpgSigning = options.requireGpgSigning;
      }
      if (options.customCommitMessagePattern !== undefined) {
        this.config.customCommitMessagePattern = options.customCommitMessagePattern;
      }
      if (options.enforceStrictCommitPolicy !== undefined) {
        this.config.enforceStrictCommitPolicy = options.enforceStrictCommitPolicy;
      }
      if (options.tagPattern !== undefined) {
        this.config.tagPattern = options.tagPattern;
      }
      
      // TODO: Persist configuration to disk
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to configure git policies: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}