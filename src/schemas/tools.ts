// JSON Schema definitions for all MCP tools

export const saveScript = {
  type: 'object',
  required: ['name', 'shell', 'content'],
  properties: {
    name: {
      type: 'string',
      description: 'Unique script identifier, e.g., build:app',
      pattern: '^[a-zA-Z][a-zA-Z0-9_:-]*$',
    },
    shell: {
      type: 'string',
      enum: ['pwsh', 'bash', 'cmd'],
      description: 'Script shell type',
    },
    content: {
      type: 'string',
      description: 'Full script contents',
      minLength: 1,
    },
    description: {
      type: 'string',
      description: 'Human-readable description of what this script does',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Categorization tags for the script',
    },
    ttlSeconds: {
      type: ['integer', 'null'],
      minimum: 60,
      description: 'Time-to-live in seconds, null to disable TTL',
    },
    cwdStrategy: {
      type: 'string',
      enum: ['repoRoot', 'scriptDir'],
      default: 'repoRoot',
      description: 'Working directory strategy',
    },
    precheck: {
      type: 'string',
      description: 'Command to verify prerequisites before running',
    },
    argsSchema: {
      type: ['object', 'null'],
      description: 'JSON Schema for runtime arguments validation',
    },
    commitMessage: {
      type: 'string',
      description: 'Custom commit message (optional)',
    },
    tag: {
      type: ['string', 'null'],
      description: 'Override default tag name or null to skip tagging',
    },
  },
  additionalProperties: false,
};

export const runScript = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      description: 'Name of the script to run',
    },
    args: {
      type: 'array',
      items: {
        type: ['string', 'number', 'boolean'],
      },
      description: 'Arguments to pass to the script',
    },
    stdin: {
      type: ['string', 'null'],
      description: 'Optional input piped to the process',
    },
    dryRun: {
      type: 'boolean',
      default: false,
      description: 'Preview execution without running',
    },
  },
  additionalProperties: false,
};

export const listScripts = {
  type: 'object',
  properties: {
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Filter by tags',
    },
    shell: {
      type: 'string',
      enum: ['pwsh', 'bash', 'cmd'],
      description: 'Filter by shell type',
    },
  },
  additionalProperties: false,
};

export const getScript = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      description: 'Name of the script to retrieve',
    },
  },
  additionalProperties: false,
};

export const setTtl = {
  type: 'object',
  required: ['name', 'ttlSeconds'],
  properties: {
    name: {
      type: 'string',
      description: 'Name of the script',
    },
    ttlSeconds: {
      type: ['integer', 'null'],
      minimum: 60,
      description: 'TTL in seconds, null to disable',
    },
  },
  additionalProperties: false,
};

export const reportStale = {
  type: 'object',
  properties: {
    olderThanDays: {
      type: 'integer',
      minimum: 1,
      default: 14,
      description: 'Report scripts unused for this many days',
    },
  },
  additionalProperties: false,
};

export const deleteScript = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      description: 'Name of the script to delete',
    },
    reason: {
      type: 'string',
      description: 'Reason for deletion',
    },
  },
  additionalProperties: false,
};

export const listRuns = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      description: 'Filter by script name',
    },
    since: {
      type: 'string',
      description: 'ISO date string to filter runs after',
      format: 'date-time',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 200,
      default: 50,
      description: 'Maximum number of runs to return',
    },
    status: {
      type: 'string',
      enum: ['success', 'error', 'running'],
      description: 'Filter by run status',
    },
  },
  additionalProperties: false,
};

export const getRunOutput = {
  type: 'object',
  required: ['runId'],
  properties: {
    runId: {
      type: 'string',
      description: 'ID of the run to retrieve output for',
    },
  },
  additionalProperties: false,
};

export const searchRuns = {
  type: 'object',
  required: ['query'],
  properties: {
    query: {
      type: 'string',
      description: 'Search query (substring or regex)',
      minLength: 1,
    },
    name: {
      type: 'string',
      description: 'Filter by script name',
    },
    regex: {
      type: 'boolean',
      default: false,
      description: 'Treat query as regex',
    },
    caseSensitive: {
      type: 'boolean',
      default: false,
      description: 'Case-sensitive search',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      default: 10,
      description: 'Maximum results to return',
    },
  },
  additionalProperties: false,
};

export const configure = {
  type: 'object',
  properties: {
    defaultTtlSeconds: {
      type: ['integer', 'null'],
      minimum: 60,
      description: 'Default TTL for new scripts',
    },
    allowShells: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['pwsh', 'bash', 'cmd'],
      },
      description: 'Allowed shell types',
    },
    allowAdhoc: {
      type: 'boolean',
      description: 'Enable ad-hoc script execution',
    },
    dockerSandbox: {
      type: 'boolean',
      description: 'Enable Docker sandbox for execution',
    },
    tagPattern: {
      type: 'string',
      description: 'Template for git tag naming',
      default: 'mcp-scripts/${name}@${version}',
    },
    maxLogSize: {
      type: 'integer',
      minimum: 1024,
      description: 'Maximum log file size in bytes',
    },
    previewSize: {
      type: 'integer',
      minimum: 100,
      description: 'Size of log preview in characters',
    },
  },
  additionalProperties: false,
};

// Enhanced save script with schema validation (T126)
export const saveScriptEnhanced = {
  ...saveScript,
  properties: {
    ...saveScript.properties,
    validateArgsSchema: {
      type: 'boolean',
      default: true,
      description: 'Validate the arguments schema on save',
    },
  },
};

// Validate arguments against script schema (T129)
export const validateArguments = {
  type: 'object',
  required: ['name', 'args'],
  properties: {
    name: {
      type: 'string',
      description: 'Name of the script to validate arguments for',
    },
    args: {
      type: 'array',
      items: {
        type: ['string', 'number', 'boolean'],
      },
      description: 'Arguments to validate against the script schema',
    },
  },
  additionalProperties: false,
};

// Preview argument materialization (T127-T128)
export const previewArgumentMaterialization = {
  type: 'object',
  required: ['name', 'args'],
  properties: {
    name: {
      type: 'string',
      description: 'Name of the script to preview argument materialization for',
    },
    args: {
      type: 'array',
      items: {
        type: ['string', 'number', 'boolean'],
      },
      description: 'Arguments to materialize for shell execution',
    },
  },
  additionalProperties: false,
};

// Enhanced runScript with validation options (T129)
export const runScriptEnhanced = {
  type: 'object',
  required: ['name'],
  properties: {
    name: {
      type: 'string',
      description: 'Name of the script to run',
    },
    args: {
      type: 'array',
      items: {
        type: ['string', 'number', 'boolean'],
      },
      description: 'Arguments to pass to the script (will be validated and materialized)',
    },
    stdin: {
      type: ['string', 'null'],
      description: 'Optional input piped to the process',
    },
    dryRun: {
      type: 'boolean',
      default: false,
      description: 'Preview execution without running',
    },
    validateOnly: {
      type: 'boolean',
      default: false,
      description: 'Only validate arguments without executing',
    },
    materializedPreview: {
      type: 'boolean',
      default: false,
      description: 'Show how arguments will be materialized for shell execution',
    },
  },
  additionalProperties: false,
};