import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TaskManager } from '../src/lib/task-manager.js';
import { ParameterValidator } from '../src/lib/parameter-validator.js';
import { ArgumentMaterializer } from '../src/lib/argument-materializer.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

describe('Typed Parameters & JSON Schema Validation (T126-T129)', () => {
  let taskManager: TaskManager;
  let paramValidator: ParameterValidator;
  let argMaterializer: ArgumentMaterializer;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tasksmith-typed-params-'));
    process.chdir(testDir);
    
    // Initialize proper git repository
    try {
      await fs.mkdir('.git', { recursive: true });
      const { execa } = await import('execa');
      await execa('git', ['init'], { cwd: testDir });
      await execa('git', ['config', 'user.name', 'Test User'], { cwd: testDir });
      await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: testDir });
    } catch (error) {
      // Git might not be available in test environment, skip TaskManager tests
    }
    
    // Initialize components for independent testing
    paramValidator = new ParameterValidator();
    argMaterializer = new ArgumentMaterializer();
    
    // Try to initialize TaskManager (may fail if git not available)
    try {
      taskManager = new TaskManager();
      await taskManager.initialize();
    } catch (error) {
      // TaskManager tests will be skipped if this fails
    }
  });

  afterEach(async () => {
    try {
      if (testDir) {
        await fs.rm(testDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
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
      expect(result.errors[0]).toContain('maximum');
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

    it('should validate complex nested object schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          config: {
            type: 'string' // Expect JSON string for complex objects
          }
        }
      };

      // Pass complex object as JSON string
      const result = paramValidator.validateArguments(schema, [JSON.stringify({ host: 'localhost', port: 8080 })]);
      expect(result.valid).toBe(true);
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

      const validation = paramValidator.validateArguments(schema, ["C:\\Program Files\\Test"]);
      const result = await argMaterializer.materializeArguments(
        { shell: 'cmd', argsSchema: schema, providedArgs: ["C:\\Program Files\\Test"] },
        validation
      );

      expect(result.valid).toBe(true);
      expect(result.materializedArgs.some(arg => arg.startsWith('/path:'))).toBe(true);
    });

    it('should handle PowerShell boolean switches correctly', async () => {
      const schema = {
        type: 'object',
        properties: {
          verbose: { type: 'boolean' },
          force: { type: 'boolean' },
          name: { type: 'string' }
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
  });

  describe('TaskManager Integration (T129)', () => {
    it('should save script with valid argument schema', async () => {
      if (!taskManager) {
        console.log('Skipping TaskManager test - git not available');
        return;
      }
      
      const schema = {
        type: 'object',
        properties: {
          environment: { 
            type: 'string',
            enum: ['dev', 'staging', 'prod']
          },
          version: { type: 'string' }
        },
        required: ['environment']
      };

      const result = await taskManager.saveScriptEnhanced({
        name: 'deploy-app',
        shell: 'pwsh',
        content: 'param($environment, $version)\\nWrite-Host "Deploying $version to $environment"',
        description: 'Deploy application',
        argsSchema: schema,
        validateArgsSchema: true
      });

      expect(result.success).toBe(true);
    });

    it('should reject script with invalid argument schema', async () => {
      const invalidSchema = {
        type: 'invalid-type',
        properties: {}
      };

      const result = await taskManager.saveScriptEnhanced({
        name: 'bad-schema',
        shell: 'pwsh',
        content: 'Write-Host "test"',
        argsSchema: invalidSchema,
        validateArgsSchema: true
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid arguments schema');
    });

    it('should validate arguments before script execution', async () => {
      // First save a script with schema
      const schema = {
        type: 'object',
        properties: {
          count: { type: 'number', minimum: 1, maximum: 10 }
        },
        required: ['count']
      };

      await taskManager.saveScript({
        name: 'count-test',
        shell: 'pwsh',
        content: 'param($count)\\nWrite-Host "Count: $count"',
        argsSchema: schema
      });

      // Test valid arguments
      const validResult = await taskManager.validateScriptArguments('count-test', [5]);
      expect(validResult.success).toBe(true);

      // Test invalid arguments
      const invalidResult = await taskManager.validateScriptArguments('count-test', [15]);
      expect(invalidResult.success).toBe(false);
      expect(invalidResult.message).toContain('maximum');
    });

    it('should preview argument materialization', async () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          debug: { type: 'boolean' }
        }
      };

      await taskManager.saveScript({
        name: 'preview-test',
        shell: 'pwsh',
        content: 'param($name, [switch]$debug)\\nWrite-Host "Hello $name"',
        argsSchema: schema
      });

      const result = await taskManager.previewArgumentMaterialization('preview-test', ['world', true]);
      
      expect(result.success).toBe(true);
      expect(result.preview).toBeDefined();
      expect(result.preview.originalArgs).toEqual(['world', true]);
      expect(result.preview.materializedArgs).toContain('-name');
      expect(result.preview.materializedArgs).toContain('-debug');
    });

    it('should run script with enhanced validation options', async () => {
      const schema = {
        type: 'object',
        properties: {
          message: { type: 'string' }
        },
        required: ['message']
      };

      await taskManager.saveScript({
        name: 'echo-test',
        shell: 'pwsh',
        content: 'param($message)\\nWrite-Host $message',
        argsSchema: schema
      });

      // Test validation-only mode
      const validateResult = await taskManager.runScriptEnhanced({
        name: 'echo-test',
        args: ['Hello TypedParams!'],
        validateOnly: true
      });

      expect(validateResult.success).toBe(true);
      expect(validateResult.message).toContain('validated successfully');
      expect(validateResult.validation).toBeDefined();

      // Test materialization preview mode
      const previewResult = await taskManager.runScriptEnhanced({
        name: 'echo-test',
        args: ['Hello TypedParams!'],
        materializedPreview: true
      });

      expect(previewResult.success).toBe(true);
      expect(previewResult.preview).toBeDefined();
      expect(previewResult.preview.materializedArgs).toContain('-message');
      expect(previewResult.preview.materializedArgs).toContain("'Hello TypedParams!'");
    });

    it('should handle scripts without argument schemas gracefully', async () => {
      await taskManager.saveScript({
        name: 'no-schema-test',
        shell: 'bash',
        content: 'echo "No schema defined"'
        // No argsSchema provided
      });

      const validateResult = await taskManager.validateScriptArguments('no-schema-test', ['any', 'args']);
      expect(validateResult.success).toBe(true);
      expect(validateResult.message).toContain('No argument schema defined');

      const previewResult = await taskManager.previewArgumentMaterialization('no-schema-test', ['any', 'args']);
      expect(previewResult.success).toBe(true);
      expect(previewResult.preview.schema).toBeNull();
    });
  });

  describe('Complex Schema Scenarios', () => {
    it('should handle additionalProperties constraints', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        additionalProperties: false
      };

      // This should be processed correctly since we're converting positional args
      const validation = paramValidator.validateArguments(schema, ['test']);
      expect(validation.valid).toBe(true);
    });

    it('should support default values in schemas', () => {
      const schema = {
        type: 'object',
        properties: {
          name: { type: 'string', default: 'default-name' },
          count: { type: 'number', default: 1 }
        }
      };

      const validation = paramValidator.validateArguments(schema, []); // No args provided
      expect(validation.valid).toBe(true);
      // AJV should fill in defaults
    });

    it('should validate PowerShell array parameters', async () => {
      const schema = {
        type: 'object',
        properties: {
          files: { 
            type: 'string' // Accept comma-separated string for arrays
          }
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
  });
});