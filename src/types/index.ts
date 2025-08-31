export interface ChangelogEntry {
  version: number;
  commit: string;
  tag?: string;
  timestamp: string;
  description?: string;
}

export interface ScriptMetadata {
  name: string;
  shell: 'pwsh' | 'bash' | 'cmd';
  path: string;
  description?: string;
  tags?: string[];
  ttlSeconds?: number | null;
  cwdStrategy: 'repoRoot' | 'scriptDir';
  precheck?: string;
  argsSchema?: object | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string | null;
  createdBy: string;
  updatedBy: string;
  // Schema v2 fields
  version?: number;
  requireApproval?: boolean;
  changelog?: ChangelogEntry[];
}

// Tag taxonomy for structured tagging system
export type DomainTag = 
  | 'domain:build' 
  | 'domain:db' 
  | 'domain:deploy' 
  | 'domain:test' 
  | 'domain:tooling' 
  | 'domain:analytics' 
  | 'domain:infra' 
  | 'domain:release';

export type RiskTag = 'risk:standard' | 'risk:dangerous';

export type LifecycleTag = 
  | 'lifecycle:exempt' 
  | 'lifecycle:stale-candidate' 
  | `lifecycle:ttl:${number}d` 
  | `lifecycle:ttl:${number}h`;

export type MaintenanceTag = 
  | 'maintenance:updated' 
  | `maintenance:renamed:${string}`;

export type StructuredTag = DomainTag | RiskTag | LifecycleTag | MaintenanceTag;

export interface TagValidationResult {
  valid: boolean;
  invalid: string[];
  structured: StructuredTag[];
  unstructured: string[];
}

export interface ScriptRegistry {
  $schema?: string;
  scripts: Record<string, ScriptMetadata>;
}

export interface RunRecord {
  runId: string;
  name: string;
  start: string;
  end?: string;
  exitCode?: number;
  args?: (string | number | boolean)[];
  stdinBytes: number;
  stdoutPreview: string;
  stderrPreview: string;
  logPath: string;
}

export interface ServerConfig {
  defaultTtlSeconds?: number | null;
  allowShells: ('pwsh' | 'bash' | 'cmd')[];
  allowAdhoc: boolean;
  dockerSandbox: boolean;
  tagPattern: string;
  maxLogSize: number;
  previewSize: number;
  // Enhanced Git Integration (T119-T122)
  allowBatchCommits?: boolean;
  requireGpgSigning?: boolean;
  customCommitMessagePattern?: string;
  enforceStrictCommitPolicy?: boolean;
}

export interface RunExecutionOptions {
  name: string;
  args?: (string | number | boolean)[];
  stdin?: string | null;
  dryRun?: boolean;
}

export interface SaveScriptOptions {
  name: string;
  shell: 'pwsh' | 'bash' | 'cmd';
  content: string;
  description?: string;
  tags?: string[];
  ttlSeconds?: number | null;
  cwdStrategy?: 'repoRoot' | 'scriptDir';
  precheck?: string;
  argsSchema?: object | null;
  commitMessage?: string;
  tag?: string | null;
}

export interface StaleReportItem {
  name: string;
  lastUsedAt: string | null;
  daysSinceLastUse: number | null;
  ttlSeconds: number | null;
  shell: string;
  description?: string;
  tags?: string[];
}

export interface ExecutionContext {
  repoRoot: string;
  scriptsDir: string;
  tasksmithDir: string;
  workingDir: string;
}

export interface PreviewLimits {
  stdout: number;
  stderr: number;
}

// Typed Parameters & JSON Schema Validation (T126-T129)
export interface ArgumentValidationResult {
  valid: boolean;
  errors: string[];
  materializedArgs: string[]; // For shell execution
  processedValues: Record<string, any>; // Original typed values
}

export interface ParameterMaterializationOptions {
  shell: 'pwsh' | 'bash' | 'cmd';
  argsSchema: object;
  providedArgs: (string | number | boolean)[];
}

// Enhanced types for parameter schema features
export interface EnhancedRunExecutionOptions extends RunExecutionOptions {
  validateOnly?: boolean; // Just validate args without running
  materializedPreview?: boolean; // Show how args will be materialized
}

// Schema-aware save options
export interface EnhancedSaveScriptOptions extends SaveScriptOptions {
  validateArgsSchema?: boolean; // Validate the schema itself on save
}

// Run Output Management (T130-T143)
export interface OutputChunk {
  content: string;
  timestamp: Date;
  source: 'stdout' | 'stderr';
}

export interface BufferConfig {
  maxLines: number;
  retentionMs: number;
  maxMemoryBytes: number;
}

export interface StreamConfig {
  stdout: BufferConfig;
  stderr: BufferConfig;
  errorPatterns: string[];
  warningPatterns: string[];
}

export interface ProgressConfig {
  enabled: boolean;
  style: 'spinner' | 'bar' | 'dots' | 'silent';
  updateIntervalMs: number;
  showETA: boolean;
  showPhase: boolean;
}

export interface FormatterConfig {
  colorScheme: 'dark' | 'light' | 'none';
  syntaxHighlighting: boolean;
  timestampFormat: 'iso' | 'relative' | 'elapsed' | 'none';
  includeMetadata: boolean;
}

export interface FilterConfig {
  levels: ('debug' | 'info' | 'warn' | 'error')[];
  keywords?: string[];
  excludeKeywords?: string[];
  regex?: string[];
  excludeRegex?: string[];
  timeRange?: {
    start?: Date;
    end?: Date;
  };
}

export interface CacheConfig {
  maxEntries: number;
  maxMemoryBytes: number;
  ttlMs: number;
  compression: boolean;
  persistToDisk: boolean;
}

export interface ExportConfig {
  format: 'json' | 'csv' | 'html' | 'markdown' | 'text';
  includeMetadata: boolean;
  compress: boolean;
  template?: string;
  streaming?: boolean;
}

export interface OutputManagementOptions {
  streaming?: StreamConfig;
  progress?: ProgressConfig;
  formatting?: FormatterConfig;
  filtering?: FilterConfig;
  caching?: CacheConfig;
  export?: ExportConfig;
}

export interface OutputSearchResult {
  chunk: OutputChunk;
  matchIndex: number;
  context: string;
}

export interface FilterResult {
  chunks: OutputChunk[];
  totalMatches: number;
  totalFiltered: number;
  executionTime: number;
}

export interface ExportResult {
  success: boolean;
  path?: string;
  size: number;
  format: string;
  compressed: boolean;
  error?: string;
}