import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import { ArgumentValidationResult } from '../types/index.js';

/**
 * Validates script arguments against JSON schemas using AJV
 * Supports type coercion, format validation, and complex object validation
 */
export class ParameterValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ 
      strict: false,
      allErrors: true,
      coerceTypes: 'array', // Allow type coercion for string/number/boolean
      removeAdditional: false,
      useDefaults: true
    });
    addFormats(this.ajv); // Add date, email, etc formats
  }

  /**
   * Validate runtime arguments against a stored JSON schema
   */
  public validateArguments(
    argsSchema: object,
    providedArgs: (string | number | boolean)[]
  ): ArgumentValidationResult {
    try {
      const validate = this.ajv.compile(argsSchema);
      
      // Convert args array to object if schema expects object
      const argsObject = this.convertArgsToObject(argsSchema, providedArgs);
      
      const valid = validate(argsObject);
      
      if (!valid) {
        const errors = validate.errors?.map(err => {
          const path = err.instancePath || 'root';
          const field = path.replace(/^\//, '') || err.schemaPath.split('/').pop() || 'field';
          return `${field}: ${err.message}`;
        }) || ['Unknown validation error'];
        
        return {
          valid: false,
          errors,
          materializedArgs: [],
          processedValues: {}
        };
      }

      return {
        valid: true,
        errors: [],
        materializedArgs: [], // Will be filled by materialization step
        processedValues: argsObject as Record<string, any>
      };
    } catch (error) {
      return {
        valid: false,
        errors: [`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        materializedArgs: [],
        processedValues: {}
      };
    }
  }

  /**
   * Validate a JSON schema itself (for saveScript)
   */
  public validateSchema(schema: object): { valid: boolean; errors: string[] } {
    try {
      this.ajv.compile(schema);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [`Invalid JSON Schema: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Convert arguments array to object based on schema structure
   */
  private convertArgsToObject(
    schema: any,
    args: (string | number | boolean)[]
  ): any {
    // If schema is array type, return args as-is
    if (schema.type === 'array') {
      return args;
    }

    // If schema is object type, map positional args to properties
    if (schema.type === 'object' && schema.properties) {
      const result: Record<string, any> = {};
      const propNames = Object.keys(schema.properties);
      
      args.forEach((arg, index) => {
        if (index < propNames.length) {
          result[propNames[index]] = arg;
        }
      });
      
      return result;
    }

    // For simple types, return first arg or null
    return args.length > 0 ? args[0] : null;
  }

  /**
   * Get schema property names in order for positional argument mapping
   */
  public getParameterOrder(schema: any): string[] {
    if (schema.type === 'object' && schema.properties) {
      return Object.keys(schema.properties);
    }
    return [];
  }

  /**
   * Check if a schema expects named parameters vs positional
   */
  public isNamedParameterSchema(schema: any): boolean {
    return schema.type === 'object' && schema.properties;
  }
}