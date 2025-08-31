import { ParameterMaterializationOptions, ArgumentValidationResult } from '../types/index.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Materializes validated arguments for shell-specific execution
 * Handles PowerShell, Bash, and CMD parameter formatting and escaping
 */
export class ArgumentMaterializer {
  
  /**
   * Materialize validated arguments for shell execution
   */
  public async materializeArguments(
    options: ParameterMaterializationOptions,
    validationResult: ArgumentValidationResult
  ): Promise<ArgumentValidationResult> {
    if (!validationResult.valid) {
      return validationResult;
    }

    try {
      let materializedArgs: string[];

      switch (options.shell) {
        case 'pwsh':
          materializedArgs = await this.materializePowerShellArgs(
            options.argsSchema,
            validationResult.processedValues
          );
          break;
        case 'bash':
          materializedArgs = await this.materializeBashArgs(
            options.argsSchema,
            validationResult.processedValues
          );
          break;
        case 'cmd':
          materializedArgs = this.materializeCmdArgs(
            options.argsSchema,
            validationResult.processedValues
          );
          break;
        default:
          throw new Error(`Unsupported shell: ${options.shell}`);
      }

      return {
        ...validationResult,
        materializedArgs
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Argument materialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        materializedArgs: [],
        processedValues: {}
      };
    }
  }

  /**
   * Generate PowerShell parameter block and materialize arguments
   * Handles named parameters, boolean switches, arrays, and complex objects
   */
  private async materializePowerShellArgs(
    schema: any,
    values: any
  ): Promise<string[]> {
    const args: string[] = [];

    if (schema.type === 'object' && schema.properties) {
      // Generate named parameters
      for (const [propName, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
        const value = values[propName];
        if (value !== undefined && value !== null) {
          const paramName = `-${propName}`;
          
          if (propSchema.type === 'boolean') {
            // Boolean switches - only add if true
            if (value) {
              args.push(paramName);
            }
          } else if (propSchema.type === 'array') {
            // PowerShell arrays
            args.push(paramName);
            if (Array.isArray(value)) {
              const arrayStr = value.map(item => 
                typeof item === 'string' ? `'${item.replace(/'/g, "''")}'` : String(item)
              ).join(',');
              args.push(`@(${arrayStr})`);
            } else {
              args.push(`@('${String(value).replace(/'/g, "''")}')`);
            }
          } else if (typeof value === 'object') {
            // Complex objects as JSON strings
            args.push(paramName);
            args.push(`'${JSON.stringify(value).replace(/'/g, "''")}'`);
          } else {
            // Simple values
            args.push(paramName);
            args.push(`'${String(value).replace(/'/g, "''")}'`);
          }
        }
      }
    } else if (schema.type === 'array') {
      // Positional array arguments
      if (Array.isArray(values)) {
        values.forEach(value => {
          if (typeof value === 'object') {
            args.push(`'${JSON.stringify(value).replace(/'/g, "''")}'`);
          } else {
            args.push(`'${String(value).replace(/'/g, "''")}'`);
          }
        });
      }
    } else {
      // Single value
      if (values !== undefined && values !== null) {
        if (typeof values === 'object') {
          args.push(`'${JSON.stringify(values).replace(/'/g, "''")}'`);
        } else {
          args.push(`'${String(values).replace(/'/g, "''")}'`);
        }
      }
    }

    return args;
  }

  /**
   * Generate Bash arguments with GNU-style long options and proper escaping
   * Creates temporary JSON files for complex objects
   */
  private async materializeBashArgs(
    schema: any,
    values: any
  ): Promise<string[]> {
    const args: string[] = [];

    if (schema.type === 'object' && schema.properties) {
      // For complex objects, create a temporary JSON file
      if (Object.keys(values).length > 0) {
        const tempFile = path.join(os.tmpdir(), `tasksmith-args-${Date.now()}.json`);
        await fs.writeFile(tempFile, JSON.stringify(values, null, 2));
        args.push(`--args-file=${this.escapeBashArg(tempFile)}`);
      }
      
      // Also add individual named arguments for convenience
      for (const [propName, value] of Object.entries(values)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'boolean') {
            if (value) {
              args.push(`--${propName}`);
            }
          } else if (Array.isArray(value)) {
            // Multiple values for same option
            value.forEach(item => {
              args.push(`--${propName}=${this.escapeBashArg(String(item))}`);
            });
          } else if (typeof value === 'object') {
            args.push(`--${propName}=${this.escapeBashArg(JSON.stringify(value))}`);
          } else {
            args.push(`--${propName}=${this.escapeBashArg(String(value))}`);
          }
        }
      }
    } else if (schema.type === 'array') {
      // Positional array arguments
      if (Array.isArray(values)) {
        values.forEach(value => {
          if (typeof value === 'object') {
            args.push(this.escapeBashArg(JSON.stringify(value)));
          } else {
            args.push(this.escapeBashArg(String(value)));
          }
        });
      }
    } else {
      // Single value
      if (values !== undefined && values !== null) {
        if (typeof values === 'object') {
          args.push(this.escapeBashArg(JSON.stringify(values)));
        } else {
          args.push(this.escapeBashArg(String(values)));
        }
      }
    }

    return args;
  }

  /**
   * Generate CMD arguments with proper escaping and Windows-style switches
   */
  private materializeCmdArgs(
    schema: any,
    values: any
  ): string[] {
    const args: string[] = [];

    if (schema.type === 'object' && schema.properties) {
      // Named arguments for CMD using / prefix
      for (const [propName, value] of Object.entries(values)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'boolean') {
            if (value) {
              args.push(`/${propName}`);
            }
          } else if (Array.isArray(value)) {
            // CMD doesn't handle arrays well, join with commas
            args.push(`/${propName}:${this.escapeCmdArg(value.join(','))}`);
          } else if (typeof value === 'object') {
            args.push(`/${propName}:${this.escapeCmdArg(JSON.stringify(value))}`);
          } else {
            args.push(`/${propName}:${this.escapeCmdArg(String(value))}`);
          }
        }
      }
    } else if (schema.type === 'array') {
      // Positional array arguments
      if (Array.isArray(values)) {
        values.forEach(value => {
          if (typeof value === 'object') {
            args.push(this.escapeCmdArg(JSON.stringify(value)));
          } else {
            args.push(this.escapeCmdArg(String(value)));
          }
        });
      }
    } else {
      // Single value
      if (values !== undefined && values !== null) {
        if (typeof values === 'object') {
          args.push(this.escapeCmdArg(JSON.stringify(values)));
        } else {
          args.push(this.escapeCmdArg(String(values)));
        }
      }
    }

    return args;
  }

  /**
   * Escape argument for Bash shell using single quotes
   */
  private escapeBashArg(arg: string): string {
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Escape argument for CMD shell using double quotes
   */
  private escapeCmdArg(arg: string): string {
    // CMD escaping: double quotes and escape embedded quotes
    return `"${arg.replace(/"/g, '""')}"`; 
  }
}