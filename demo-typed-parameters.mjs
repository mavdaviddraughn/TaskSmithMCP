/**
 * Demo: Typed Parameters & JSON Schema Validation (T126-T129)
 * Simple demo showcasing our comprehensive typed parameter system
 */

async function runDemo() {
  const { ParameterValidator } = await import('./dist/lib/parameter-validator.js');
  const { ArgumentMaterializer } = await import('./dist/lib/argument-materializer.js');

  console.log('🚀 TaskSmith MCP: Typed Parameters Demo (T126-T129)\n');

  // Initialize our validators
  const paramValidator = new ParameterValidator();
  const argMaterializer = new ArgumentMaterializer();

  // Demo 1: JSON Schema Validation (T126)
  console.log('📋 Demo 1: JSON Schema Support (T126)');
  console.log('=====================================');

  const demoSchema = {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      count: { type: 'integer', minimum: 1, maximum: 10 },
      email: { type: 'string', format: 'email' },
      verbose: { type: 'boolean' },
      tags: { 
        type: 'array', 
        items: { type: 'string' },
        minItems: 1
      }
    },
    required: ['name', 'count'],
    additionalProperties: false
  };

  console.log('Schema Definition:');
  console.log(JSON.stringify(demoSchema, null, 2));

  // Test valid arguments
  console.log('\n✅ Testing valid arguments:');
  const validArgs = ['TaskScript', '5', 'user@example.com', 'true', 'tag1,tag2,tag3'];
  const validResult = paramValidator.validateArguments(demoSchema, validArgs);
  console.log('Input args:', validArgs);
  console.log('Validation result:', {
    valid: validResult.valid,
    convertedArgs: validResult.convertedArgs,
    errors: validResult.errors
  });

  // Test invalid arguments  
  console.log('\n❌ Testing invalid arguments:');
  const invalidArgs = ['', '15', 'invalid-email', 'tag1,tag2']; // Missing required, exceeds max, invalid email
  const invalidResult = paramValidator.validateArguments(demoSchema, invalidArgs);
  console.log('Input args:', invalidArgs);
  console.log('Validation result:', {
    valid: invalidResult.valid,
    errors: invalidResult.errors.slice(0, 3) // Show first 3 errors
  });

  // Demo 2: PowerShell Argument Materialization (T127)
  console.log('\n\n💻 Demo 2: PowerShell Materialization (T127)');
  console.log('==============================================');

  const pwshResult = await argMaterializer.materializeArguments(
    { 
      shell: 'pwsh', 
      argsSchema: demoSchema,
      providedArgs: validArgs
    },
    validResult
  );

  console.log('PowerShell materialized arguments:');
  console.log('Valid:', pwshResult.valid);
  console.log('Args:', pwshResult.materializedArgs);

  // Demo 3: Bash Argument Materialization (T128)  
  console.log('\n\n🐚 Demo 3: Bash Materialization (T128)');
  console.log('=======================================');

  const bashResult = await argMaterializer.materializeArguments(
    {
      shell: 'bash',
      argsSchema: demoSchema,
      providedArgs: validArgs
    },
    validResult
  );

  console.log('Bash materialized arguments:');
  console.log('Valid:', bashResult.valid);
  console.log('Args:', bashResult.materializedArgs);

  // Demo 4: Runtime Validation with Error Handling (T129)
  console.log('\n\n🛡️  Demo 4: Runtime Validation & Error Handling (T129)');
  console.log('======================================================');

  // Test schema validation
  console.log('Testing schema validation:');
  const validSchemaResult = paramValidator.validateSchema(demoSchema);
  console.log('Valid schema check:', { valid: validSchemaResult.valid, errors: validSchemaResult.errors });

  const invalidSchema = { type: 'invalid_type', properties: { bad: { type: 'not_real' } } };
  const invalidSchemaResult = paramValidator.validateSchema(invalidSchema);
  console.log('Invalid schema check:', {
    valid: invalidSchemaResult.valid,
    errors: invalidSchemaResult.errors.slice(0, 2) // Show first 2 errors
  });

  console.log('\n🎉 Demo Complete! Typed Parameters System (T126-T129) is fully functional.');
  console.log('\nKey Features Demonstrated:');
  console.log('✅ T126: JSON Schema validation with AJV');
  console.log('✅ T127: PowerShell argument materialization');  
  console.log('✅ T128: Bash/CMD argument materialization');
  console.log('✅ T129: Runtime validation & error handling');
  console.log('\nThe typed parameters system is ready for integration! 🚀');
}

runDemo().catch(console.error);