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