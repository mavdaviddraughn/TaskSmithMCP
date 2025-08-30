import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { TaskManager } from '../src/lib/task-manager.js';

describe('Script CRUD Operations', () => {
  let taskManager: TaskManager;
  let repoInfo: any;

  beforeAll(async () => {
    taskManager = new TaskManager();
    await taskManager.initialize();
    repoInfo = await taskManager.getRepositoryInfo();
  });

  beforeEach(async () => {
    // Clean up any test scripts before each test
    const testNames = ['test-script', 'test-script-2', 'test-update-script', 'test-delete-script', 'test-file-structure'];
    for (const name of testNames) {
      try {
        const result = await taskManager.deleteScript({ name, reason: 'test cleanup' });
        // Don't log if it succeeds - that's expected
      } catch (error) {
        // Ignore if script doesn't exist or other errors - expected during cleanup
      }
    }
  });

  it('should save a new PowerShell script successfully', async () => {
    const result = await taskManager.saveScript({
      name: 'test-script',
      shell: 'pwsh',
      content: 'Write-Host "Hello, World!"\nGet-Date',
      description: 'Test PowerShell script',
      tags: ['test', 'demo'],
      cwdStrategy: 'repoRoot'
    });

    console.log('Save result:', result);
    expect(result.success).toBe(true);
    if (!result.success) {
      console.log('Save failed with message:', result.message);
    }
  });

  it('should retrieve a saved script with content', async () => {
    // First save a script
    await taskManager.saveScript({
      name: 'test-script-2',
      shell: 'bash',
      content: '#!/bin/bash\necho "Test script"\ndate',
      description: 'Test bash script',
      tags: ['test'],
      cwdStrategy: 'scriptDir'
    });

    // Retrieve it
    const script = await taskManager.getScript({ name: 'test-script-2' });
    expect(script.name).toBe('test-script-2');
    expect(script.shell).toBe('bash');
    expect(script.description).toBe('Test bash script');
    expect(script.content).toBe('#!/bin/bash\necho "Test script"\ndate');
  });

  it('should update an existing script', async () => {
    // Create initial script with unique name
    const scriptName = `test-update-script-${Date.now()}`;
    const initialResult = await taskManager.saveScript({
      name: scriptName,
      shell: 'pwsh',
      content: 'Write-Host "Version 1"',
      description: 'Initial version'
    });
    console.log('Initial save result:', initialResult);
    expect(initialResult.success).toBe(true);

    // Update the script
    const updateResult = await taskManager.saveScript({
      name: scriptName,
      shell: 'pwsh',
      content: 'Write-Host "Version 2"',
      description: 'Updated version'
    });

    expect(updateResult.success).toBe(true);

    // Verify the updated script
    const updated = await taskManager.getScript({ name: scriptName });
    expect(updated.content).toBe('Write-Host "Version 2"');
    expect(updated.description).toBe('Updated version');
  });

  it('should delete a script and remove files', async () => {
    // First create a script
    await taskManager.saveScript({
      name: 'test-delete-script',
      shell: 'cmd',
      content: '@echo off\necho "This will be deleted"\npause',
      description: 'Script to be deleted'
    });

    // Verify it exists
    const script = await taskManager.getScript({ name: 'test-delete-script' });
    expect(script.name).toBe('test-delete-script');

    // Delete the script
    const deleteResult = await taskManager.deleteScript({
      name: 'test-delete-script',
      reason: 'Testing deletion'
    });

    expect(deleteResult.success).toBe(true);

    // Verify it's gone
    await expect(
      taskManager.getScript({ name: 'test-delete-script' })
    ).rejects.toThrow("Script 'test-delete-script' not found");
  });

  it('should validate script names', async () => {
    // Test invalid names
    const emptyNameResult = await taskManager.saveScript({
      name: '',
      shell: 'pwsh',
      content: 'Write-Host "test"',
      description: 'Test'
    });
    expect(emptyNameResult.success).toBe(false);
    expect(emptyNameResult.message).toContain('Name, shell, and content are required');

    const invalidNameResult = await taskManager.saveScript({
      name: 'invalid/name',
      shell: 'pwsh',
      content: 'Write-Host "test"',
      description: 'Test'
    });
    expect(invalidNameResult.success).toBe(false);
    expect(invalidNameResult.message).toContain('Script name can only contain');
  });

  it('should validate allowed shells', async () => {
    const result = await taskManager.saveScript({
      name: 'test-invalid-shell',
      shell: 'invalid' as any,
      content: 'echo "test"',
      description: 'Test'
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('Shell must be one of: pwsh, bash, cmd');
  });

  it('should create proper file structure', async () => {
    const result = await taskManager.saveScript({
      name: 'test-file-structure',
      shell: 'pwsh',
      content: 'Write-Host "File structure test"',
      description: 'Testing file structure creation',
      tags: ['structure', 'test']
    });

    expect(result.success).toBe(true);

    // Verify the script can be retrieved
    const script = await taskManager.getScript({ name: 'test-file-structure' });
    expect(script.name).toBe('test-file-structure');
    expect(script.tags).toEqual(['structure', 'test']);
  });
});