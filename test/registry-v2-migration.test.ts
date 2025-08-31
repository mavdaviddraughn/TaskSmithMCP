import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RegistryManager } from '../src/lib/registry-manager.js';
import { TagManager } from '../src/lib/tag-manager.js';
import { ScriptRegistry, ScriptMetadata } from '../src/types/index.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Registry Schema v2 Migration', () => {
  let registryManager: RegistryManager;
  let testRegistryPath: string;

  beforeEach(async () => {
    // Create temporary registry file for each test
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'tasksmith-test-'));
    testRegistryPath = join(tempDir, 'scripts.json');
    registryManager = new RegistryManager(testRegistryPath);
  });

  describe('Schema Migration', () => {
    it('should migrate v1 registry to v2 automatically', async () => {
      // Create a v1 registry structure
      const v1Registry: ScriptRegistry = {
        $schema: 'https://raw.githubusercontent.com/mavdaviddraughn/TaskSmithMCP/main/schema/scripts.json',
        scripts: {
          'test-script': {
            name: 'test-script',
            shell: 'pwsh',
            path: 'scripts/pwsh/test-script.ps1',
            description: 'Test script',
            tags: ['risk:dangerous', 'domain:build'],
            ttlSeconds: null,
            cwdStrategy: 'repoRoot',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            createdBy: 'test',
            updatedBy: 'test'
          } as ScriptMetadata
        }
      };

      // Write v1 registry
      await fs.writeFile(testRegistryPath, JSON.stringify(v1Registry, null, 2));

      // Read registry (should trigger migration)
      const migratedRegistry = await registryManager.readRegistry();

      // Verify migration occurred
      const script = migratedRegistry.scripts['test-script'];
      expect(script.version).toBe(1);
      expect(script.requireApproval).toBe(true); // Because of risk:dangerous tag
      expect(script.changelog).toEqual([]);
      expect(script.tags).toEqual(['domain:build', 'risk:dangerous']); // Normalized order
    });

    it('should not modify already migrated v2 registry', async () => {
      // Create a v2 registry structure
      const v2Registry: ScriptRegistry = {
        $schema: 'https://raw.githubusercontent.com/mavdaviddraughn/TaskSmithMCP/main/schema/scripts.json',
        scripts: {
          'test-script': {
            name: 'test-script',
            shell: 'pwsh',
            path: 'scripts/pwsh/test-script.ps1',
            description: 'Test script',
            tags: ['domain:build', 'risk:standard'],
            ttlSeconds: null,
            cwdStrategy: 'repoRoot',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
            createdBy: 'test',
            updatedBy: 'test',
            version: 2,
            requireApproval: false,
            changelog: [
              {
                version: 1,
                commit: 'abc123',
                timestamp: '2025-01-01T00:00:00.000Z',
                description: 'Initial creation'
              }
            ]
          } as ScriptMetadata
        }
      };

      // Write v2 registry
      await fs.writeFile(testRegistryPath, JSON.stringify(v2Registry, null, 2));

      // Read registry (should not modify)
      const registry = await registryManager.readRegistry();

      // Verify no changes
      const script = registry.scripts['test-script'];
      expect(script.version).toBe(2);
      expect(script.requireApproval).toBe(false);
      expect(script.changelog).toHaveLength(1);
    });
  });

  describe('Version Management', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    it('should start new scripts at version 1', async () => {
      const mockGitManager = {
        getCurrentCommitHash: () => Promise.resolve('abc123def456')
      };
      registryManager.setGitManager(mockGitManager);

      const metadata: ScriptMetadata = {
        name: 'new-script',
        shell: 'pwsh',
        path: 'scripts/pwsh/new-script.ps1',
        description: 'New test script',
        tags: ['domain:test'],
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      };

      await registryManager.saveScript('new-script', metadata);

      const saved = await registryManager.getScript('new-script');
      expect(saved?.version).toBe(1);
      expect(saved?.changelog).toHaveLength(1);
      expect(saved?.changelog?.[0].version).toBe(1);
      expect(saved?.changelog?.[0].commit).toBe('abc123def456');
      expect(saved?.changelog?.[0].tag).toBe('mcp-scripts/new-script@1');
    });

    it('should increment version on updates', async () => {
      const mockGitManager = {
        getCurrentCommitHash: () => Promise.resolve('def456ghi789')
      };
      registryManager.setGitManager(mockGitManager);

      // Create initial script
      const metadata: ScriptMetadata = {
        name: 'update-script',
        shell: 'pwsh',
        path: 'scripts/pwsh/update-script.ps1',
        description: 'Script to update',
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      };

      await registryManager.saveScript('update-script', metadata);

      // Update the script
      const updatedMetadata: ScriptMetadata = {
        ...metadata,
        description: 'Updated script description'
      };

      await registryManager.saveScript('update-script', updatedMetadata);

      const updated = await registryManager.getScript('update-script');
      expect(updated?.version).toBe(2);
      expect(updated?.changelog).toHaveLength(2);
      expect(updated?.changelog?.[1].version).toBe(2);
      expect(updated?.changelog?.[1].commit).toBe('def456ghi789');
      expect(updated?.changelog?.[1].tag).toBe('mcp-scripts/update-script@2');
    });

    it('should track version history', async () => {
      await registryManager.initialize();
      
      // Create script with multiple versions
      const baseMetadata: ScriptMetadata = {
        name: 'version-test',
        shell: 'bash',
        path: 'scripts/bash/version-test.sh',
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      };

      // Version 1
      await registryManager.saveScript('version-test', { ...baseMetadata, description: 'v1' });
      
      // Version 2
      await registryManager.saveScript('version-test', { ...baseMetadata, description: 'v2' });
      
      // Version 3
      await registryManager.saveScript('version-test', { ...baseMetadata, description: 'v3' });

      const history = await registryManager.getScriptVersionHistory('version-test');
      expect(history).toHaveLength(3);
      expect(history.map(h => h.version)).toEqual([1, 2, 3]);
    });
  });

  describe('Approval Requirements', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    it('should auto-set requireApproval based on risk tags', async () => {
      const dangerousMetadata: ScriptMetadata = {
        name: 'dangerous-script',
        shell: 'pwsh',
        path: 'scripts/pwsh/dangerous-script.ps1',
        tags: ['risk:dangerous', 'domain:infra'],
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      };

      await registryManager.saveScript('dangerous-script', dangerousMetadata);

      const saved = await registryManager.getScript('dangerous-script');
      expect(saved?.requireApproval).toBe(true);
    });

    it('should allow manual override of approval requirement', async () => {
      const metadata: ScriptMetadata = {
        name: 'manual-approval',
        shell: 'pwsh',
        path: 'scripts/pwsh/manual-approval.ps1',
        tags: ['risk:standard'],
        requireApproval: true, // Manual override
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      };

      await registryManager.saveScript('manual-approval', metadata);

      const saved = await registryManager.getScript('manual-approval');
      expect(saved?.requireApproval).toBe(true);
    });

    it('should get scripts requiring approval', async () => {
      // Create dangerous script
      await registryManager.saveScript('dangerous', {
        name: 'dangerous',
        shell: 'pwsh',
        path: 'test.ps1',
        tags: ['risk:dangerous'],
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      });

      // Create standard script
      await registryManager.saveScript('standard', {
        name: 'standard',
        shell: 'pwsh',
        path: 'test2.ps1',
        tags: ['risk:standard'],
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      });

      const approvalRequired = await registryManager.getScriptsRequiringApproval();
      expect(approvalRequired).toHaveLength(1);
      expect(approvalRequired[0].name).toBe('dangerous');
    });
  });

  describe('Enhanced Statistics', () => {
    beforeEach(async () => {
      await registryManager.initialize();
    });

    it('should provide v2 schema statistics', async () => {
      // Create test scripts with various tags
      await registryManager.saveScript('build-script', {
        name: 'build-script',
        shell: 'pwsh',
        path: 'test1.ps1',
        tags: ['domain:build', 'risk:standard'],
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      });

      await registryManager.saveScript('dangerous-deploy', {
        name: 'dangerous-deploy',
        shell: 'bash',
        path: 'test2.sh',
        tags: ['domain:deploy', 'risk:dangerous'],
        cwdStrategy: 'repoRoot',
        createdAt: '',
        updatedAt: '',
        createdBy: 'test',
        updatedBy: 'test'
      });

      const stats = await registryManager.getStats();

      expect(stats.totalScripts).toBe(2);
      expect(stats.scriptsByRisk['risk:standard']).toBe(1);
      expect(stats.scriptsByRisk['risk:dangerous']).toBe(1);
      expect(stats.scriptsByDomain['domain:build']).toBe(1);
      expect(stats.scriptsByDomain['domain:deploy']).toBe(1);
      expect(stats.requireApprovalCount).toBe(1);
      expect(stats.averageVersion).toBe(1);
    });
  });
});