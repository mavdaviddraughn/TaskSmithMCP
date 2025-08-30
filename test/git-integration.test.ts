import { beforeAll, describe, expect, it } from 'vitest';
import { TaskManager } from '../src/lib/task-manager.js';

describe('Git Integration', () => {
  let taskManager: TaskManager;

  beforeAll(async () => {
    taskManager = new TaskManager();
    await taskManager.initialize();
  });

  it('should detect git repository', async () => {
    const repoInfo = await taskManager.getRepositoryInfo();
    
    expect(repoInfo.isGitRepo).toBe(true);
    expect(repoInfo.repoRoot).toBeTruthy();
    expect(repoInfo.currentBranch).toBeTruthy();
    expect(repoInfo.currentCommit).toBeTruthy();
    expect(typeof repoInfo.isClean).toBe('boolean');
  });

  it('should get git manager instance', () => {
    const gitManager = taskManager.getGitManager();
    expect(gitManager).toBeDefined();
  });

  it('should validate git operations are available', async () => {
    const gitManager = taskManager.getGitManager();
    
    // Test basic git operations
    const isRepo = await gitManager.isGitRepository();
    expect(isRepo).toBe(true);
    
    const branch = await gitManager.getCurrentBranch();
    expect(branch).toBeTruthy();
    
    const commit = await gitManager.getCurrentCommitHash();
    expect(commit).toBeTruthy();
    expect(commit).toMatch(/^[a-f0-9]{40}$/); // Full SHA-1 hash
  });

  it('should handle git tag operations', async () => {
    const gitManager = taskManager.getGitManager();
    
    // List existing tags
    const tags = await gitManager.listTags();
    expect(Array.isArray(tags)).toBe(true);
    
    // Check if a non-existent tag doesn't exist
    const fakeTagExists = await gitManager.tagExists('non-existent-tag-12345');
    expect(fakeTagExists).toBe(false);
  });

  it('should generate proper tag names', () => {
    const gitManager = taskManager.getGitManager();
    
    const tagName = gitManager.generateTagName('test-script', 1);
    expect(tagName).toBe('mcp-scripts/test-script@1');
    
    const customTagName = gitManager.generateTagName('test-script', 2, 'v${version}-${name}');
    expect(customTagName).toBe('v2-test-script');
  });

  it('should generate proper commit messages', () => {
    const gitManager = taskManager.getGitManager();
    
    const addMessage = gitManager.generateCommitMessage('add', 'test-script', 'Test script');
    expect(addMessage).toBe('mcp(script): add test-script — Test script');
    
    const updateMessage = gitManager.generateCommitMessage('update', 'test-script');
    expect(updateMessage).toBe('mcp(script): update test-script');
  });
});