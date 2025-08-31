import { describe, it, expect, beforeEach } from 'vitest';
import { ParameterValidator } from '../src/lib/parameter-validator.js';
import { ArgumentMaterializer } from '../src/lib/argument-materializer.js';

describe('Typed Parameters Core Functionality (T126-T129)', () => {
  let paramValidator: ParameterValidator;
  let argMaterializer: ArgumentMaterializer;

  beforeEach(() => {
    paramValidator = new ParameterValidator();
    argMaterializer = new ArgumentMaterializer();
  });

  describe('ParameterValidator (T126)', () => {
    it('should validate simple string arguments', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' }
        },
        required: ['name']
      };

      const result = paramValidator.validateArguments(schema, ['test-name', 42]);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.processedValues).toEqual({ name: 'test-name', count: 42 });
    });

    it('should reject invalid arguments with descriptive errors', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number', minimum: 1, maximum: 10 }
        },
        required: ['count']
      };

      const result = paramValidator.validateArguments(schema, [15]);
      
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('must be <= 10');
    });

    it('should validate array type schemas', () => {
      const schema = {
        type: 'array',
        items: { type: 'string' },
        minItems: 2
      };

      const result = paramValidator.validateArguments(schema, ['item1', 'item2', 'item3']);
      
      expect(result.valid).toBe(true);
      expect(result.processedValues).toEqual(['item1', 'item2', 'item3']);
    });

    it('should validate schema definitions themselves', () => {
      const validSchema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      };

      const invalidSchema = {
        type: 'invalid-type'
      };

      expect(paramValidator.validateSchema(validSchema).valid).toBe(true);
      expect(paramValidator.validateSchema(invalidSchema).valid).toBe(false);
    });

    it('should support format validation', () => {
      const schema = {
        type: 'object',
        properties: {
          email: { 
            type: 'string',
            format: 'email'
          },
          date: {
            type: 'string',
            format: 'date'
          }
        }
      };

      const validResult = paramValidator.validateArguments(schema, ['test@example.com', '2025-01-01']);
      expect(validResult.valid).toBe(true);

      const invalidResult = paramValidator.validateArguments(schema, ['not-an-email', 'not-a-date']);
      expect(invalidResult.valid).toBe(false);
    });

    it('should handle type coercion', () => {
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number' },
          enabled: { type: 'boolean' }
        }
      };

      // Pass string numbers and booleans
      const result = paramValidator.validateArguments(schema, ['42', 'true']);
      expect(result.valid).toBe(true);
      expect(result.processedValues.count).toBe(42);
      expect(result.processedValues.enabled).toBe(true);
    });
  });

  describe('ArgumentMaterializer (T127-T128)', () => {
    it('should materialize PowerShell arguments correctly', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          count: { type: 'number' },
          enabled: { type: 'boolean' }
        }
      };

      const validation = paramValidator.validateArguments(schema, ['test', 5, true]);
      const result = await argMaterializer.materializeArguments(
        { shell: 'pwsh', argsSchema: schema, providedArgs: ['test', 5, true] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs).toContain('-name');
      expect(result.materializedArgs).toContain("'test'");
      expect(result.materializedArgs).toContain('-count');
      expect(result.materializedArgs).toContain("'5'");
      expect(result.materializedArgs).toContain('-enabled');
    });

    it('should materialize Bash arguments with proper escaping', async () => {
      const schema = {
        type: 'object',
        properties: {
          message: { type: 'string' },
          count: { type: 'number' }
        }
      };

      const validation = paramValidator.validateArguments(schema, ["hello world", 10]);
      const result = await argMaterializer.materializeArguments(
        { shell: 'bash', argsSchema: schema, providedArgs: ["hello world", 10] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs.some(arg => arg.includes("--message='hello world'"))).toBe(true);
      expect(result.materializedArgs.some(arg => arg.includes('--count=\'10\''))).toBe(true);
    });

    it('should handle array type arguments', async () => {
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };

      const validation = paramValidator.validateArguments(schema, ['arg1', 'arg2', 'arg3']);
      const result = await argMaterializer.materializeArguments(
        { shell: 'bash', argsSchema: schema, providedArgs: ['arg1', 'arg2', 'arg3'] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs).toEqual(["'arg1'", "'arg2'", "'arg3'"]);
    });

    it('should escape special characters properly for CMD', async () => {
      const schema = {
        type: 'object',
        properties: {
          path: { type: 'string' }
        }
      };

      const validation = paramValidator.validateArguments(schema, ["C:\\\\Program Files\\\\Test"]);
      const result = await argMaterializer.materializeArguments(
        { shell: 'cmd', argsSchema: schema, providedArgs: ["C:\\\\Program Files\\\\Test"] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs.some(arg => arg.startsWith('/path:'))).toBe(true);
    });

    it('should handle PowerShell boolean switches correctly', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          verbose: { type: 'boolean' },
          force: { type: 'boolean' }
        }
      };

      const validation = paramValidator.validateArguments(schema, ['test', true, false]);
      const result = await argMaterializer.materializeArguments(
        { shell: 'pwsh', argsSchema: schema, providedArgs: ['test', true, false] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs).toContain('-verbose'); // true boolean appears
      expect(result.materializedArgs).not.toContain('-force'); // false boolean doesn't appear
    });

    it('should handle PowerShell arrays correctly', async () => {
      const schema = {
        type: 'object',
        properties: {
          files: { type: 'string' } // Use string for comma-separated values
        }
      };

      const validation = paramValidator.validateArguments(schema, ['file1.txt,file2.txt']);
      const result = await argMaterializer.materializeArguments(
        { shell: 'pwsh', argsSchema: schema, providedArgs: ['file1.txt,file2.txt'] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs).toContain('-files');
    });

    it('should materialize complex objects as JSON', async () => {
      const schema = {
        type: 'object',
        properties: {
          config: { type: 'string' } // Accept JSON string
        }
      };

      const complexObj = JSON.stringify({ host: 'localhost', port: 8080 });
      const validation = paramValidator.validateArguments(schema, [complexObj]);
      const result = await argMaterializer.materializeArguments(
        { shell: 'pwsh', argsSchema: schema, providedArgs: [complexObj] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs).toContain('-config');
      expect(result.materializedArgs.some(arg => arg.includes('localhost'))).toBe(true);
    });
  });

  describe('Cross-shell Compatibility', () => {
    it('should handle same schema across different shells', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          debug: { type: 'boolean' }
        }
      };

      const args = ['test-app', true];
      const validation = paramValidator.validateArguments(schema, args);

      // Test PowerShell materialization
      const pwshResult = await argMaterializer.materializeArguments(
        { shell: 'pwsh', argsSchema: schema, providedArgs: args },
        validation
      );

      // Test Bash materialization  
      const bashResult = await argMaterializer.materializeArguments(
        { shell: 'bash', argsSchema: schema, providedArgs: args },
        validation
      );

      // Test CMD materialization
      const cmdResult = await argMaterializer.materializeArguments(
        { shell: 'cmd', argsSchema: schema, providedArgs: args },
        validation
      );

      expect(pwshResult.valid).toBe(true);
      expect(bashResult.valid).toBe(true);
      expect(cmdResult.valid).toBe(true);

      // Each should have different formats but same logical content
      expect(pwshResult.materializedArgs).toContain('-name');
      expect(bashResult.materializedArgs.some(arg => arg.includes('--name='))).toBe(true);
      expect(cmdResult.materializedArgs.some(arg => arg.includes('/name:'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid schemas gracefully', () => {
      const result = paramValidator.validateSchema({ 
        type: 'invalid_type', // AJV will reject this
        properties: {
          invalidProperty: { type: 'not_a_real_type' }
        }
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle materialization errors', async () => {
      const invalidValidation = {
        valid: false,
        errors: ['Test error'],
        materializedArgs: [],
        processedValues: {}
      };

      const result = await argMaterializer.materializeArguments(
        { shell: 'pwsh', argsSchema: {}, providedArgs: [] },
        invalidValidation
      );

      expect(result.valid).toBe(false);
      expect(result.errors).toEqual(['Test error']);
    });

    it('should handle unsupported shell types', async () => {
      const validation = { valid: true, errors: [], materializedArgs: [], processedValues: {} };
      
      const result = await argMaterializer.materializeArguments(
        { shell: 'unsupported' as any, argsSchema: {}, providedArgs: [] },
        validation
      );

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unsupported shell');
    });
  });
});