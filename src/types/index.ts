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