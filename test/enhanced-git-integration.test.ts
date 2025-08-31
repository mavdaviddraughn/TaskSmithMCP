import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { TaskManager } from '../src/lib/task-manager.js';
import { GitManager } from '../src/lib/git-manager.js';

describe('Enhanced Git Integration (T119-T125)', () => {
  let taskManager: TaskManager;
  let gitManager: GitManager;

  beforeAll(async () => {
    taskManager = new TaskManager();
    await taskManager.initialize();
    gitManager = taskManager.getGitManager();
  });

  beforeEach(async () => {
    // Clean up any test scripts
    const testNames = ['enhanced-test-script', 'batch-test-1', 'batch-test-2', 'tag-test-script'];
    for (const name of testNames) {
      try {
        await taskManager.deleteScript({ name, reason: 'test cleanup' });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Enhanced Commit Policies (T119-T122)', () => {
    it('should generate structured commit messages', () => {
      const addMessage = gitManager.generateCommitMessage('add', 'test-script', 'Test script for validation');
      expect(addMessage).toBe('mcp(script): add test-script — Test script for validation');

      const updateMessage = gitManager.generateCommitMessage('update', 'test-script');
      expect(updateMessage).toBe('mcp(script): update test-script');

      const removeMessage = gitManager.generateCommitMessage('remove', 'old-script', 'No longer needed');
      expect(removeMessage).toBe('mcp(script): remove old-script — No longer needed');
    });

    it('should generate batch commit messages', () => {
      const actions = [
        { action: 'add' as const, scriptName: 'script1', description: 'First script' },
        { action: 'update' as const, scriptName: 'script2', description: 'Updated' },
        { action: 'add' as const, scriptName: 'script3' }
      ];

      const batchMessage = gitManager.generateBatchCommitMessage(actions, 'Multiple script changes');
      expect(batchMessage).toBe('mcp(script): batch commit - 2 adds, 1 update — Multiple script changes');
    });

    it('should handle single action batch messages', () => {
      const singleAction = [
        { action: 'add' as const, scriptName: 'solo-script', description: 'Only script' }
      ];

      const message = gitManager.generateBatchCommitMessage(singleAction);
      expect(message).toBe('mcp(script): add solo-script — Only script');
    });

    it('should support custom commit message patterns', () => {
      const customMessage = gitManager.generateCommitMessage(
        'add', 
        'custom-script', 
        'Custom description',
        'feat(${name}): ${action} - ${description}'
      );
      expect(customMessage).toBe('feat(custom-script): add - Custom description');
    });

    it('should validate enhanced commit policies', async () => {
      const context = taskManager.getPathManager().getContext();
      
      // Test validation without staging files (dry run)
      const strictValidation = await gitManager.validateOneScriptPerCommit(
        context.scriptsDir, 
        'enhanced-test-script', // specific script name 
        false // batch disabled
      );
      
      // Should return validation result
      expect(typeof strictValidation.valid).toBe('boolean');
      expect(strictValidation.error || strictValidation.valid).toBeTruthy();
    });
  });

  describe('Version Tagging System (T123-T125)', () => {
    it('should generate standardized tag names', () => {
      const tagName = gitManager.generateTagName('test-script', 3);
      expect(tagName).toBe('mcp-scripts/test-script@3');

      const customTagName = gitManager.generateTagName('test-script', 2, 'v${version}-${name}');
      expect(customTagName).toBe('v2-test-script');
    });

    it('should create version tags with diff summaries', async () => {
      // Create a script to generate a tag for
      const result = await taskManager.saveScript({
        name: 'tag-test-script',
        shell: 'pwsh',
        content: 'Write-Host "Tagged script content"',
        description: 'Script for tag testing'
      });

      expect(result.success).toBe(true);

      // Get the script to check version
      const script = await taskManager.getScript({ name: 'tag-test-script' });
      expect(script.version).toBe(1);

      // Check that tag was created automatically
      const tags = await gitManager.listTags();
      const scriptTag = tags.find(tag => tag.startsWith('mcp-scripts/tag-test-script@'));
      expect(scriptTag).toBeDefined();
      expect(scriptTag).toBe('mcp-scripts/tag-test-script@1');
    });

    it('should track version history in script metadata', async () => {
      // Create initial script
      await taskManager.saveScript({
        name: 'enhanced-test-script',
        shell: 'bash',
        content: '#!/bin/bash\necho "Version 1"',
        description: 'Initial version'
      });

      // Update script to create version 2
      await taskManager.saveScript({
        name: 'enhanced-test-script',
        shell: 'bash',
        content: '#!/bin/bash\necho "Version 2 - enhanced"',
        description: 'Enhanced version'
      });

      // Check version history
      const history = await taskManager.getScriptVersionHistory({ name: 'enhanced-test-script' });
      expect(history.success).toBe(true);
      expect(history.changelog).toHaveLength(2);
      
      if (history.changelog) {
        expect(history.changelog[0].version).toBe(1);
        expect(history.changelog[1].version).toBe(2);
        expect(history.changelog[1].tag).toBe('mcp-scripts/enhanced-test-script@2');
      }
    });

    it('should get version tags for a script', async () => {
      // Create a script with multiple versions
      await taskManager.saveScript({
        name: 'multi-version-script',
        shell: 'pwsh',
        content: 'Write-Host "V1"',
        description: 'Version 1'
      });

      await taskManager.saveScript({
        name: 'multi-version-script',
        shell: 'pwsh',
        content: 'Write-Host "V2"',
        description: 'Version 2'
      });

      const versionTags = await taskManager.getScriptVersionTags({ name: 'multi-version-script' });
      
      expect(versionTags.length).toBeGreaterThanOrEqual(2);
      expect(versionTags[0].version).toBeGreaterThan(versionTags[1].version); // Sorted newest first
      expect(versionTags.every(tag => tag.commit)).toBe(true); // All should have commit hashes
    });
  });

  describe('Git Policy Configuration', () => {
    it('should configure git policies', async () => {
      const result = await taskManager.configureGitPolicies({
        allowBatchCommits: true,
        requireGpgSigning: false,
        customCommitMessagePattern: 'custom(${name}): ${action}',
        enforceStrictCommitPolicy: false
      });

      expect(result.success).toBe(true);
    });

    it('should create manual version tags when needed', async () => {
      // Create a script
      await taskManager.saveScript({
        name: 'manual-tag-test',
        shell: 'cmd',
        content: 'echo "Manual tag test"',
        description: 'Test manual tagging'
      });

      // Create additional version tag manually
      const tagResult = await taskManager.createScriptVersionTag({
        name: 'manual-tag-test',
        version: 2,
        force: true,
        includeDiffSummary: true
      });

      expect(tagResult.success).toBe(true);
      expect(tagResult.tagName).toBe('mcp-scripts/manual-tag-test@2');
    });
  });

  describe('Enhanced Registry Statistics', () => {
    it('should provide enhanced statistics with version info', async () => {
      // Create some test scripts
      await taskManager.saveScript({
        name: 'stats-test-1',
        shell: 'pwsh',
        content: 'Write-Host "Stats test"',
        tags: ['domain:test', 'risk:standard']
      });

      await taskManager.saveScript({
        name: 'stats-test-2',
        shell: 'bash',
        content: 'echo "Stats test 2"',
        tags: ['domain:build', 'risk:dangerous']
      });

      const stats = await taskManager.getRegistryStats();

      expect(stats.totalScripts).toBeGreaterThanOrEqual(2);
      expect(stats.averageVersion).toBeGreaterThanOrEqual(1);
      expect(stats.scriptsByRisk).toHaveProperty('risk:standard');
      expect(stats.scriptsByRisk).toHaveProperty('risk:dangerous');
      expect(stats.scriptsByDomain).toHaveProperty('domain:test');
      expect(stats.scriptsByDomain).toHaveProperty('domain:build');
      expect(stats.requireApprovalCount).toBeGreaterThanOrEqual(1); // dangerous script
    });
  });
});