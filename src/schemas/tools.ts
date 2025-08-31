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
    outputOptions: {
      type: 'object',
      description: 'Output management configuration',
      properties: {
        streaming: {
          type: 'object',
          description: 'Stream buffer configuration',
          properties: {
            stdout: {
              type: 'object',
              properties: {
                maxLines: {
                  type: 'integer',
                  minimum: 100,
                  default: 10000,
                  description: 'Maximum lines to buffer for stdout',
                },
                retentionMs: {
                  type: 'integer',
                  minimum: 1000,
                  default: 86400000,
                  description: 'How long to retain output in milliseconds (24h default)',
                },
                maxMemoryBytes: {
                  type: 'integer',
                  minimum: 1024,
                  default: 52428800,
                  description: 'Maximum memory usage in bytes (50MB default)',
                },
              },
              additionalProperties: false,
            },
            stderr: {
              type: 'object',
              properties: {
                maxLines: {
                  type: 'integer',
                  minimum: 100,
                  default: 5000,
                  description: 'Maximum lines to buffer for stderr',
                },
                retentionMs: {
                  type: 'integer',
                  minimum: 1000,
                  default: 86400000,
                  description: 'How long to retain output in milliseconds (24h default)',
                },
                maxMemoryBytes: {
                  type: 'integer',
                  minimum: 1024,
                  default: 26214400,
                  description: 'Maximum memory usage in bytes (25MB default)',
                },
              },
              additionalProperties: false,
            },
            errorPatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Regex patterns to identify error lines',
              default: ['error:', 'exception:', 'fatal:', 'failed:'],
            },
            warningPatterns: {
              type: 'array',
              items: { type: 'string' },
              description: 'Regex patterns to identify warning lines',
              default: ['warning:', 'warn:', 'deprecated'],
            },
          },
          additionalProperties: false,
        },
        progress: {
          type: 'object',
          description: 'Progress tracking configuration',
          properties: {
            enabled: {
              type: 'boolean',
              default: true,
              description: 'Enable progress indicators',
            },
            style: {
              type: 'string',
              enum: ['spinner', 'bar', 'dots', 'silent'],
              default: 'spinner',
              description: 'Progress indicator style',
            },
            updateIntervalMs: {
              type: 'integer',
              minimum: 50,
              default: 100,
              description: 'Update interval in milliseconds',
            },
            showETA: {
              type: 'boolean',
              default: true,
              description: 'Show estimated time to completion',
            },
            showPhase: {
              type: 'boolean',
              default: true,
              description: 'Show current execution phase',
            },
          },
          additionalProperties: false,
        },
        formatting: {
          type: 'object',
          description: 'Output formatting options',
          properties: {
            colorScheme: {
              type: 'string',
              enum: ['dark', 'light', 'none'],
              default: 'dark',
              description: 'Color scheme for output',
            },
            syntaxHighlighting: {
              type: 'boolean',
              default: true,
              description: 'Enable syntax highlighting',
            },
            timestampFormat: {
              type: 'string',
              enum: ['iso', 'relative', 'elapsed', 'none'],
              default: 'iso',
              description: 'Timestamp format in output',
            },
            includeMetadata: {
              type: 'boolean',
              default: true,
              description: 'Include execution metadata',
            },
          },
          additionalProperties: false,
        },
        filtering: {
          type: 'object',
          description: 'Output filtering configuration',
          properties: {
            levels: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['debug', 'info', 'warn', 'error'],
              },
              description: 'Log levels to include',
              default: ['info', 'warn', 'error'],
            },
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords to filter for',
            },
            excludeKeywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords to exclude',
            },
            regex: {
              type: 'array',
              items: { type: 'string' },
              description: 'Regex patterns to include',
            },
            excludeRegex: {
              type: 'array',
              items: { type: 'string' },
              description: 'Regex patterns to exclude',
            },
            timeRange: {
              type: 'object',
              properties: {
                start: {
                  type: 'string',
                  format: 'date-time',
                  description: 'Start time for filtering',
                },
                end: {
                  type: 'string',
                  format: 'date-time',
                  description: 'End time for filtering',
                },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        caching: {
          type: 'object',
          description: 'Result caching configuration',
          properties: {
            maxEntries: {
              type: 'integer',
              minimum: 10,
              default: 1000,
              description: 'Maximum cache entries',
            },
            maxMemoryBytes: {
              type: 'integer',
              minimum: 1024,
              default: 104857600,
              description: 'Maximum cache memory usage (100MB default)',
            },
            ttlMs: {
              type: 'integer',
              minimum: 1000,
              default: 604800000,
              description: 'Cache TTL in milliseconds (7 days default)',
            },
            compression: {
              type: 'boolean',
              default: true,
              description: 'Enable result compression',
            },
            persistToDisk: {
              type: 'boolean',
              default: true,
              description: 'Persist cache to disk',
            },
          },
          additionalProperties: false,
        },
        export: {
          type: 'object',
          description: 'Export configuration',
          properties: {
            format: {
              type: 'string',
              enum: ['json', 'csv', 'html', 'markdown', 'text'],
              default: 'json',
              description: 'Export format',
            },
            includeMetadata: {
              type: 'boolean',
              default: true,
              description: 'Include execution metadata in export',
            },
            compress: {
              type: 'boolean',
              default: false,
              description: 'Compress exported output',
            },
            template: {
              type: 'string',
              description: 'Custom export template name',
            },
            streaming: {
              type: 'boolean',
              default: false,
              description: 'Enable streaming export for large outputs',
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
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
    outputOptions: {
      type: 'object',
      description: 'Advanced output management configuration (same as runScript)',
      properties: {
        streaming: {
          type: 'object',
          description: 'Stream buffer configuration',
          properties: {
            stdout: {
              type: 'object',
              properties: {
                maxLines: { type: 'integer', minimum: 100, default: 10000 },
                retentionMs: { type: 'integer', minimum: 1000, default: 86400000 },
                maxMemoryBytes: { type: 'integer', minimum: 1024, default: 52428800 },
              },
              additionalProperties: false,
            },
            stderr: {
              type: 'object',
              properties: {
                maxLines: { type: 'integer', minimum: 100, default: 5000 },
                retentionMs: { type: 'integer', minimum: 1000, default: 86400000 },
                maxMemoryBytes: { type: 'integer', minimum: 1024, default: 26214400 },
              },
              additionalProperties: false,
            },
            errorPatterns: {
              type: 'array',
              items: { type: 'string' },
              default: ['error:', 'exception:', 'fatal:', 'failed:'],
            },
            warningPatterns: {
              type: 'array',
              items: { type: 'string' },
              default: ['warning:', 'warn:', 'deprecated'],
            },
          },
          additionalProperties: false,
        },
        progress: {
          type: 'object',
          properties: {
            enabled: { type: 'boolean', default: true },
            style: { type: 'string', enum: ['spinner', 'bar', 'dots', 'silent'], default: 'spinner' },
            updateIntervalMs: { type: 'integer', minimum: 50, default: 100 },
            showETA: { type: 'boolean', default: true },
            showPhase: { type: 'boolean', default: true },
          },
          additionalProperties: false,
        },
        formatting: {
          type: 'object',
          properties: {
            colorScheme: { type: 'string', enum: ['dark', 'light', 'none'], default: 'dark' },
            syntaxHighlighting: { type: 'boolean', default: true },
            timestampFormat: { type: 'string', enum: ['iso', 'relative', 'elapsed', 'none'], default: 'iso' },
            includeMetadata: { type: 'boolean', default: true },
          },
          additionalProperties: false,
        },
        filtering: {
          type: 'object',
          properties: {
            levels: {
              type: 'array',
              items: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
              default: ['info', 'warn', 'error'],
            },
            keywords: { type: 'array', items: { type: 'string' } },
            excludeKeywords: { type: 'array', items: { type: 'string' } },
            regex: { type: 'array', items: { type: 'string' } },
            excludeRegex: { type: 'array', items: { type: 'string' } },
            timeRange: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' },
              },
              additionalProperties: false,
            },
          },
          additionalProperties: false,
        },
        caching: {
          type: 'object',
          properties: {
            maxEntries: { type: 'integer', minimum: 10, default: 1000 },
            maxMemoryBytes: { type: 'integer', minimum: 1024, default: 104857600 },
            ttlMs: { type: 'integer', minimum: 1000, default: 604800000 },
            compression: { type: 'boolean', default: true },
            persistToDisk: { type: 'boolean', default: true },
          },
          additionalProperties: false,
        },
        export: {
          type: 'object',
          properties: {
            format: { type: 'string', enum: ['json', 'csv', 'html', 'markdown', 'text'], default: 'json' },
            includeMetadata: { type: 'boolean', default: true },
            compress: { type: 'boolean', default: false },
            template: { type: 'string' },
            streaming: { type: 'boolean', default: false },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

// Output Management Tools (T130-T143)

export const filterRunOutput = {
  type: 'object',
  required: ['runId'],
  properties: {
    runId: {
      type: 'string',
      description: 'Run ID to filter output for',
    },
    levels: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error'],
      },
      description: 'Log levels to include',
    },
    keywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Keywords to search for',
    },
    excludeKeywords: {
      type: 'array',
      items: { type: 'string' },
      description: 'Keywords to exclude',
    },
    regex: {
      type: 'array',
      items: { type: 'string' },
      description: 'Regex patterns to include',
    },
    excludeRegex: {
      type: 'array',
      items: { type: 'string' },
      description: 'Regex patterns to exclude',
    },
    timeRange: {
      type: 'object',
      properties: {
        start: {
          type: 'string',
          format: 'date-time',
          description: 'Start time for filtering',
        },
        end: {
          type: 'string',
          format: 'date-time',
          description: 'End time for filtering',
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

export const exportRunOutput = {
  type: 'object',
  required: ['runId', 'format'],
  properties: {
    runId: {
      type: 'string',
      description: 'Run ID to export output for',
    },
    format: {
      type: 'string',
      enum: ['json', 'csv', 'html', 'markdown', 'text'],
      description: 'Export format',
    },
    filePath: {
      type: 'string',
      description: 'Optional custom export file path',
    },
    includeMetadata: {
      type: 'boolean',
      default: true,
      description: 'Include execution metadata',
    },
    compress: {
      type: 'boolean',
      default: false,
      description: 'Compress exported file',
    },
    template: {
      type: 'string',
      description: 'Custom template name',
    },
    filtering: {
      type: 'object',
      description: 'Filter output before export',
      properties: {
        levels: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['debug', 'info', 'warn', 'error'],
          },
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
        },
        excludeKeywords: {
          type: 'array',
          items: { type: 'string' },
        },
        regex: {
          type: 'array',
          items: { type: 'string' },
        },
        excludeRegex: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
};

export const searchRunOutput = {
  type: 'object',
  required: ['runId', 'query'],
  properties: {
    runId: {
      type: 'string',
      description: 'Run ID to search output in',
    },
    query: {
      type: 'string',
      description: 'Search query (keyword or regex)',
      minLength: 1,
    },
    regex: {
      type: 'boolean',
      default: false,
      description: 'Treat query as regex pattern',
    },
    caseSensitive: {
      type: 'boolean',
      default: false,
      description: 'Case-sensitive search',
    },
    contextLines: {
      type: 'integer',
      minimum: 0,
      maximum: 10,
      default: 2,
      description: 'Lines of context around matches',
    },
    maxResults: {
      type: 'integer',
      minimum: 1,
      maximum: 1000,
      default: 100,
      description: 'Maximum number of results',
    },
  },
  additionalProperties: false,
};

export const getRunProgress = {
  type: 'object',
  required: ['runId'],
  properties: {
    runId: {
      type: 'string',
      description: 'Run ID to get progress for',
    },
    includePhases: {
      type: 'boolean',
      default: true,
      description: 'Include execution phase information',
    },
    includeETA: {
      type: 'boolean',
      default: true,
      description: 'Include estimated time to completion',
    },
  },
  additionalProperties: false,
};

export const clearResultCache = {
  type: 'object',
  properties: {
    scriptName: {
      type: 'string',
      description: 'Clear cache for specific script only',
    },
    olderThan: {
      type: 'string',
      format: 'date-time',
      description: 'Clear cache entries older than this timestamp',
    },
    sizeThreshold: {
      type: 'integer',
      minimum: 1024,
      description: 'Clear cache if total size exceeds this (bytes)',
    },
  },
  additionalProperties: false,
};

export const getCacheStats = {
  type: 'object',
  properties: {
    detailed: {
      type: 'boolean',
      default: false,
      description: 'Include detailed per-entry statistics',
    },
  },
  additionalProperties: false,
};