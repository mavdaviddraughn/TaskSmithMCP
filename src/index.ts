#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Ajv from 'ajv';
import { toolSchemas } from './schemas/index.js';
import { TaskManager } from './lib/task-manager.js';
import { ServerConfig } from './types/index.js';

const ajv = new Ajv({ strict: false });

interface TaskSmithServer {
  taskManager: TaskManager;
  config: ServerConfig;
}

class TaskSmithMCPServer {
  private server: Server;
  private taskManager: TaskManager;
  private ajv: Ajv;

  constructor() {
    this.server = new Server(
      {
        name: 'tasksmith-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.ajv = ajv;
    this.taskManager = new TaskManager();
    this.setupTools();
  }

  /**
   * Initialize the server and all managers
   */
  private async initialize(): Promise<void> {
    await this.taskManager.initialize();
  }

  private setupTools(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'task.save_script',
            description: 'Create or update a named script stored in the repo and tracked in Git',
            inputSchema: toolSchemas.saveScript,
          },
          {
            name: 'task.run_script',
            description: 'Run a saved script by name with enforced CWD, optional args, and stdin',
            inputSchema: toolSchemas.runScript,
          },
          {
            name: 'task.list_scripts',
            description: 'List all scripts with metadata (shell, ttl, lastUsed, tags)',
            inputSchema: toolSchemas.listScripts,
          },
          {
            name: 'task.get_script',
            description: 'Return script metadata and contents by name',
            inputSchema: toolSchemas.getScript,
          },
          {
            name: 'task.set_ttl',
            description: 'Set or update a script TTL in seconds (null disables)',
            inputSchema: toolSchemas.setTtl,
          },
          {
            name: 'task.report_stale',
            description: 'Report scripts that have no TTL and have not been used within the provided age window',
            inputSchema: toolSchemas.reportStale,
          },
          {
            name: 'task.delete_script',
            description: 'Delete a script by name (committed deletion)',
            inputSchema: toolSchemas.deleteScript,
          },
          {
            name: 'task.list_runs',
            description: 'List historical runs, filterable by script name/date/status',
            inputSchema: toolSchemas.listRuns,
          },
          {
            name: 'task.get_run_output',
            description: 'Return stored stdout/stderr for a past run',
            inputSchema: toolSchemas.getRunOutput,
          },
          {
            name: 'task.search_runs',
            description: 'Search run outputs (simple substring or regex)',
            inputSchema: toolSchemas.searchRuns,
          },
          {
            name: 'task.configure',
            description: 'Update server policy: allowlists, sandbox, default TTL, tagging policy',
            inputSchema: toolSchemas.configure,
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Validate arguments against schema
        const schema = this.getToolSchema(name);
        if (schema) {
          const validate = this.ajv.compile(schema);
          if (!validate(args)) {
            throw new Error(`Invalid arguments: ${this.ajv.errorsText(validate.errors)}`);
          }
        }

        // Route to appropriate handler
        const result = await this.handleToolCall(name, args);
        
        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text', 
              text: `Error: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  private getToolSchema(toolName: string): object | undefined {
    const schemaMap: Record<string, object> = {
      'task.save_script': toolSchemas.saveScript,
      'task.run_script': toolSchemas.runScript,
      'task.list_scripts': toolSchemas.listScripts,
      'task.get_script': toolSchemas.getScript,
      'task.set_ttl': toolSchemas.setTtl,
      'task.report_stale': toolSchemas.reportStale,
      'task.delete_script': toolSchemas.deleteScript,
      'task.list_runs': toolSchemas.listRuns,
      'task.get_run_output': toolSchemas.getRunOutput,
      'task.search_runs': toolSchemas.searchRuns,
      'task.configure': toolSchemas.configure,
    };
    
    return schemaMap[toolName];
  }

  private async handleToolCall(name: string, args: any): Promise<any> {
    switch (name) {
      case 'task.save_script':
        return await this.taskManager.saveScript(args);
      case 'task.run_script':
        return await this.taskManager.runScript(args);
      case 'task.list_scripts':
        return await this.taskManager.listScripts(args);
      case 'task.get_script':
        return await this.taskManager.getScript(args);
      case 'task.set_ttl':
        return await this.taskManager.setTtl(args);
      case 'task.report_stale':
        return await this.taskManager.reportStale(args);
      case 'task.delete_script':
        return await this.taskManager.deleteScript(args);
      case 'task.list_runs':
        return await this.taskManager.listRuns(args);
      case 'task.get_run_output':
        return await this.taskManager.getRunOutput(args);
      case 'task.search_runs':
        return await this.taskManager.searchRuns(args);
      case 'task.configure':
        return await this.taskManager.configure(args);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  public async run(): Promise<void> {
    // Initialize all managers first
    await this.initialize();
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Handle shutdown gracefully
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      await this.server.close();
      process.exit(0);
    });
  }
}

// Start server if called directly
const isMainModule = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  const server = new TaskSmithMCPServer();
  server.run().catch((error) => {
    console.error('Failed to start TaskSmith MCP server:', error);
    process.exit(1);
  });
}

export { TaskSmithMCPServer };