import { TagValidationResult, StructuredTag, DomainTag, RiskTag, LifecycleTag, MaintenanceTag } from '../types/index.js';

/**
 * Tag validation and management utilities for structured tagging system
 */
export class TagManager {
  private static readonly DOMAIN_TAGS = new Set([
    'domain:build',
    'domain:db', 
    'domain:deploy',
    'domain:test',
    'domain:tooling',
    'domain:analytics',
    'domain:infra',
    'domain:release'
  ]);

  private static readonly RISK_TAGS = new Set([
    'risk:standard',
    'risk:dangerous'
  ]);

  private static readonly LIFECYCLE_FIXED_TAGS = new Set([
    'lifecycle:exempt',
    'lifecycle:stale-candidate'
  ]);

  private static readonly MAINTENANCE_FIXED_TAGS = new Set([
    'maintenance:updated'
  ]);

  /**
   * Validate tags according to structured taxonomy
   */
  static validateTags(tags: string[]): TagValidationResult {
    const result: TagValidationResult = {
      valid: true,
      invalid: [],
      structured: [],
      unstructured: []
    };

    for (const tag of tags) {
      if (this.isStructuredTag(tag)) {
        result.structured.push(tag as StructuredTag);
      } else if (this.isValidUnstructuredTag(tag)) {
        result.unstructured.push(tag);
      } else {
        result.invalid.push(tag);
        result.valid = false;
      }
    }

    return result;
  }

  /**
   * Check if a tag follows structured taxonomy
   */
  static isStructuredTag(tag: string): boolean {
    // Check domain tags
    if (this.DOMAIN_TAGS.has(tag)) return true;
    
    // Check risk tags
    if (this.RISK_TAGS.has(tag)) return true;
    
    // Check fixed lifecycle tags
    if (this.LIFECYCLE_FIXED_TAGS.has(tag)) return true;
    
    // Check TTL lifecycle tags (lifecycle:ttl:Nd or lifecycle:ttl:Nh)
    if (tag.startsWith('lifecycle:ttl:')) {
      const ttlPart = tag.slice('lifecycle:ttl:'.length);
      return /^\d+[dh]$/.test(ttlPart);
    }
    
    // Check fixed maintenance tags
    if (this.MAINTENANCE_FIXED_TAGS.has(tag)) return true;
    
    // Check renamed maintenance tags (maintenance:renamed:oldName)
    if (tag.startsWith('maintenance:renamed:')) {
      const oldName = tag.slice('maintenance:renamed:'.length);
      return oldName.length > 0 && /^[a-zA-Z0-9_:-]+$/.test(oldName);
    }
    
    return false;
  }

  /**
   * Check if a tag is valid as unstructured (custom) tag
   */
  static isValidUnstructuredTag(tag: string): boolean {
    // Must not start with reserved prefixes
    const reservedPrefixes = ['domain:', 'risk:', 'lifecycle:', 'maintenance:'];
    if (reservedPrefixes.some(prefix => tag.startsWith(prefix))) {
      return false;
    }
    
    // Must follow general tag naming rules
    return /^[a-zA-Z0-9_-]+$/.test(tag) && tag.length >= 1 && tag.length <= 50;
  }

  /**
   * Determine if script requires approval based on tags
   */
  static shouldRequireApproval(tags: string[]): boolean {
    return tags.includes('risk:dangerous');
  }

  /**
   * Extract TTL from lifecycle tags
   */
  static extractTtlFromTags(tags: string[]): number | null {
    for (const tag of tags) {
      if (tag.startsWith('lifecycle:ttl:')) {
        const ttlPart = tag.slice('lifecycle:ttl:'.length);
        const match = ttlPart.match(/^(\d+)([dh])$/);
        if (match) {
          const value = parseInt(match[1], 10);
          const unit = match[2];
          return unit === 'd' ? value * 24 * 60 * 60 : value * 60 * 60; // Convert to seconds
        }
      }
    }
    return null;
  }

  /**
   * Check if script is exempt from TTL
   */
  static isExemptFromTtl(tags: string[]): boolean {
    return tags.includes('lifecycle:exempt');
  }

  /**
   * Get suggested domain tags based on script name/path
   */
  static suggestDomainTags(name: string, path: string): DomainTag[] {
    const suggestions: DomainTag[] = [];
    const lowerName = name.toLowerCase();
    const lowerPath = path.toLowerCase();
    const combined = `${lowerName} ${lowerPath}`;

    if (/build|compile|package|bundle/.test(combined)) {
      suggestions.push('domain:build');
    }
    if (/test|spec|check/.test(combined)) {
      suggestions.push('domain:test');
    }
    if (/deploy|install|setup/.test(combined)) {
      suggestions.push('domain:deploy');
    }
    if (/db|database|sql|migrate/.test(combined)) {
      suggestions.push('domain:db');
    }
    if (/tool|util|helper/.test(combined)) {
      suggestions.push('domain:tooling');
    }
    if (/analytics|metrics|track/.test(combined)) {
      suggestions.push('domain:analytics');
    }
    if (/infra|infrastructure|provision/.test(combined)) {
      suggestions.push('domain:infra');
    }
    if (/release|publish|tag/.test(combined)) {
      suggestions.push('domain:release');
    }

    return suggestions;
  }

  /**
   * Get suggested risk level based on script content/name
   */
  static suggestRiskLevel(name: string, path: string, content?: string): RiskTag {
    const combined = `${name.toLowerCase()} ${path.toLowerCase()} ${content?.toLowerCase() || ''}`;
    
    // Look for dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf|rmdir\s+\/s/i, // Recursive delete
      /format|fdisk|mkfs/i, // Disk formatting
      /DROP\s+(TABLE|DATABASE)/i, // SQL drops
      /DELETE\s+FROM.*WHERE\s+1\s*=\s*1/i, // Dangerous SQL
      /sudo|runas/i, // Elevated privileges
      /wget|curl.*\|\s*sh/i, // Pipe to shell
      /eval|exec/i, // Dynamic execution
      /registry|regedit/i, // Windows registry
      /systemctl|service.*stop/i, // Service management
    ];

    if (dangerousPatterns.some(pattern => pattern.test(combined))) {
      return 'risk:dangerous';
    }

    return 'risk:standard';
  }

  /**
   * Normalize tags by removing duplicates and sorting
   */
  static normalizeTags(tags: string[]): string[] {
    const uniqueTags = Array.from(new Set(tags));
    return uniqueTags.sort((a, b) => {
      // Sort structured tags first, then unstructured
      const aStructured = this.isStructuredTag(a);
      const bStructured = this.isStructuredTag(b);
      
      if (aStructured && !bStructured) return -1;
      if (!aStructured && bStructured) return 1;
      
      return a.localeCompare(b);
    });
  }
}