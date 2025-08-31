import { describe, expect, it } from 'vitest';
import { TagManager } from '../src/lib/tag-manager.js';

describe('TagManager', () => {
  describe('Tag Validation', () => {
    it('should validate domain tags', () => {
      const validDomainTags = [
        'domain:build',
        'domain:db',
        'domain:deploy',
        'domain:test',
        'domain:tooling',
        'domain:analytics',
        'domain:infra',
        'domain:release'
      ];

      validDomainTags.forEach(tag => {
        expect(TagManager.isStructuredTag(tag)).toBe(true);
      });
    });

    it('should validate risk tags', () => {
      expect(TagManager.isStructuredTag('risk:standard')).toBe(true);
      expect(TagManager.isStructuredTag('risk:dangerous')).toBe(true);
      expect(TagManager.isStructuredTag('risk:invalid')).toBe(false);
    });

    it('should validate lifecycle tags', () => {
      expect(TagManager.isStructuredTag('lifecycle:exempt')).toBe(true);
      expect(TagManager.isStructuredTag('lifecycle:stale-candidate')).toBe(true);
      expect(TagManager.isStructuredTag('lifecycle:ttl:7d')).toBe(true);
      expect(TagManager.isStructuredTag('lifecycle:ttl:24h')).toBe(true);
      expect(TagManager.isStructuredTag('lifecycle:ttl:invalid')).toBe(false);
    });

    it('should validate maintenance tags', () => {
      expect(TagManager.isStructuredTag('maintenance:updated')).toBe(true);
      expect(TagManager.isStructuredTag('maintenance:renamed:old-name')).toBe(true);
      expect(TagManager.isStructuredTag('maintenance:renamed:')).toBe(false);
    });

    it('should validate unstructured tags', () => {
      expect(TagManager.isValidUnstructuredTag('custom-tag')).toBe(true);
      expect(TagManager.isValidUnstructuredTag('my_tag_123')).toBe(true);
      expect(TagManager.isValidUnstructuredTag('domain:custom')).toBe(false); // Reserved prefix
      expect(TagManager.isValidUnstructuredTag('risk:custom')).toBe(false); // Reserved prefix
      expect(TagManager.isValidUnstructuredTag('tag with spaces')).toBe(false); // Invalid characters
    });

    it('should provide comprehensive tag validation', () => {
      const tags = [
        'domain:build',
        'risk:dangerous',
        'lifecycle:ttl:7d',
        'custom-tag',
        'invalid:prefix:tag',
        'another-custom'
      ];

      const result = TagManager.validateTags(tags);

      expect(result.valid).toBe(false);
      expect(result.structured).toEqual(['domain:build', 'risk:dangerous', 'lifecycle:ttl:7d']);
      expect(result.unstructured).toEqual(['custom-tag', 'another-custom']);
      expect(result.invalid).toEqual(['invalid:prefix:tag']);
    });
  });

  describe('Tag-based Logic', () => {
    it('should determine approval requirement from tags', () => {
      expect(TagManager.shouldRequireApproval(['domain:build', 'risk:standard'])).toBe(false);
      expect(TagManager.shouldRequireApproval(['domain:deploy', 'risk:dangerous'])).toBe(true);
      expect(TagManager.shouldRequireApproval(['custom-tag'])).toBe(false);
    });

    it('should extract TTL from lifecycle tags', () => {
      expect(TagManager.extractTtlFromTags(['lifecycle:ttl:7d'])).toBe(7 * 24 * 60 * 60);
      expect(TagManager.extractTtlFromTags(['lifecycle:ttl:24h'])).toBe(24 * 60 * 60);
      expect(TagManager.extractTtlFromTags(['domain:build'])).toBe(null);
      expect(TagManager.extractTtlFromTags(['lifecycle:exempt'])).toBe(null);
    });

    it('should check TTL exemption', () => {
      expect(TagManager.isExemptFromTtl(['lifecycle:exempt'])).toBe(true);
      expect(TagManager.isExemptFromTtl(['domain:build'])).toBe(false);
      expect(TagManager.isExemptFromTtl(['lifecycle:ttl:7d'])).toBe(false);
    });
  });

  describe('Tag Suggestions', () => {
    it('should suggest domain tags based on script name and path', () => {
      const buildSuggestions = TagManager.suggestDomainTags('build-app', 'scripts/build/app.ps1');
      expect(buildSuggestions).toContain('domain:build');

      const testSuggestions = TagManager.suggestDomainTags('run-tests', 'scripts/test/unit.sh');
      expect(testSuggestions).toContain('domain:test');

      const deploySuggestions = TagManager.suggestDomainTags('deploy-service', 'scripts/deploy/production.ps1');
      expect(deploySuggestions).toContain('domain:deploy');

      const dbSuggestions = TagManager.suggestDomainTags('migrate-db', 'scripts/database/migration.sql');
      expect(dbSuggestions).toContain('domain:db');
    });

    it('should suggest risk level based on content', () => {
      const dangerousScript = `
        Write-Host "Removing all files"
        rm -rf /some/path/*
        sudo systemctl stop important-service
      `;
      
      expect(TagManager.suggestRiskLevel('delete-all', 'scripts/cleanup.ps1', dangerousScript)).toBe('risk:dangerous');

      const safeScript = `
        Write-Host "Building application"
        dotnet build
        dotnet test
      `;
      
      expect(TagManager.suggestRiskLevel('build-app', 'scripts/build.ps1', safeScript)).toBe('risk:standard');
    });
  });

  describe('Tag Normalization', () => {
    it('should remove duplicates and sort tags', () => {
      const tags = [
        'custom-tag',
        'domain:build',
        'custom-tag', // duplicate
        'risk:standard',
        'another-custom'
      ];

      const normalized = TagManager.normalizeTags(tags);

      expect(normalized).toEqual([
        'domain:build',
        'risk:standard',
        'another-custom',
        'custom-tag'
      ]);
    });

    it('should sort structured tags before unstructured', () => {
      const tags = [
        'z-custom',
        'a-custom',
        'risk:dangerous',
        'domain:build'
      ];

      const normalized = TagManager.normalizeTags(tags);

      expect(normalized).toEqual([
        'domain:build',
        'risk:dangerous',
        'a-custom',
        'z-custom'
      ]);
    });
  });

  describe('Complex Tag Scenarios', () => {
    it('should handle TTL parsing edge cases', () => {
      expect(TagManager.extractTtlFromTags(['lifecycle:ttl:0d'])).toBe(0);
      expect(TagManager.extractTtlFromTags(['lifecycle:ttl:1h'])).toBe(3600);
      expect(TagManager.extractTtlFromTags(['lifecycle:ttl:999d'])).toBe(999 * 24 * 60 * 60);
    });

    it('should validate renamed maintenance tags', () => {
      expect(TagManager.isStructuredTag('maintenance:renamed:old-script-name')).toBe(true);
      expect(TagManager.isStructuredTag('maintenance:renamed:script_with_underscores')).toBe(true);
      expect(TagManager.isStructuredTag('maintenance:renamed:script-with-dashes')).toBe(true);
      expect(TagManager.isStructuredTag('maintenance:renamed:script with spaces')).toBe(false);
    });

    it('should handle mixed validation scenarios', () => {
      const complexTags = [
        'domain:build',
        'risk:dangerous',
        'lifecycle:ttl:30d',
        'maintenance:renamed:old-name',
        'custom-project-tag',
        'another_custom',
        'invalid:bad:prefix',
        'invalid spaces'
      ];

      const result = TagManager.validateTags(complexTags);

      expect(result.structured).toHaveLength(4);
      expect(result.unstructured).toHaveLength(2);
      expect(result.invalid).toHaveLength(2);
      expect(result.valid).toBe(false);
    });
  });
});