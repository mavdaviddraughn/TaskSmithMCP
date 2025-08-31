/**
 * Comprehensive error handling system for output management
 * Provides structured error types, recovery mechanisms, and monitoring integration
 */

import { EventEmitter } from 'events';

/**
 * Base error class for all output management errors
 */
export class OutputManagementError extends Error {
  public readonly code: string;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly context: ErrorContext;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: string,
    category: ErrorCategory,
    severity: ErrorSeverity = 'medium',
    context: Partial<ErrorContext> = {},
    recoverable: boolean = true
  ) {
    super(message);
    this.name = 'OutputManagementError';
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.context = {
      component: 'unknown',
      operation: 'unknown',
      ...context
    };
    this.timestamp = new Date();
    this.recoverable = recoverable;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to JSON for logging/monitoring
   */
  toJSON(): ErrorRecord {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      recoverable: this.recoverable,
      stack: this.stack
    };
  }

  /**
   * Create user-friendly error message
   */
  getUserMessage(): string {
    const categoryMessages: Record<ErrorCategory, string> = {
      'memory': 'Memory limit exceeded - try reducing buffer size or enabling compression',
      'disk': 'Disk space or file access issue - check permissions and available space',
      'network': 'Network connectivity problem - check connection and retry',
      'validation': 'Invalid configuration or data - check input parameters',
      'performance': 'Operation took too long - consider optimizing parameters',
      'resource': 'System resource unavailable - check system limits'
    };

    return categoryMessages[this.category] || 'An unexpected error occurred';
  }
}

/**
 * Specific error types for different scenarios
 */
export class MemoryLimitError extends OutputManagementError {
  constructor(context: Partial<ErrorContext> = {}, currentUsage?: number, limit?: number) {
    const message = `Memory limit exceeded${currentUsage && limit ? ` (${currentUsage}MB / ${limit}MB)` : ''}`;
    super(message, 'MEMORY_LIMIT_EXCEEDED', 'memory', 'high', context, true);
  }
}

export class DiskSpaceError extends OutputManagementError {
  constructor(context: Partial<ErrorContext> = {}, requiredSpace?: number, availableSpace?: number) {
    const message = `Insufficient disk space${requiredSpace && availableSpace ? ` (need ${requiredSpace}MB, have ${availableSpace}MB)` : ''}`;
    super(message, 'DISK_SPACE_INSUFFICIENT', 'disk', 'high', context, true);
  }
}

export class FileAccessError extends OutputManagementError {
  constructor(filePath: string, operation: string, context: Partial<ErrorContext> = {}) {
    super(
      `Cannot ${operation} file: ${filePath}`,
      'FILE_ACCESS_DENIED',
      'disk',
      'medium',
      { ...context, filePath, operation },
      true
    );
  }
}

export class ConfigurationError extends OutputManagementError {
  constructor(parameter: string, value: any, expected: string, context: Partial<ErrorContext> = {}) {
    super(
      `Invalid configuration: ${parameter} = ${value} (expected: ${expected})`,
      'INVALID_CONFIGURATION',
      'validation',
      'medium',
      { ...context, metadata: { parameter, value, expected } },
      false
    );
  }
}

export class TimeoutError extends OutputManagementError {
  constructor(operation: string, timeoutMs: number, context: Partial<ErrorContext> = {}) {
    super(
      `Operation timeout: ${operation} exceeded ${timeoutMs}ms`,
      'OPERATION_TIMEOUT',
      'performance',
      'medium',
      { ...context, operation, metadata: { timeoutMs } },
      true
    );
  }
}

export class NetworkError extends OutputManagementError {
  constructor(operation: string, endpoint?: string, context: Partial<ErrorContext> = {}) {
    super(
      `Network error during ${operation}${endpoint ? ` to ${endpoint}` : ''}`,
      'NETWORK_ERROR',
      'network',
      'medium',
      { ...context, operation, metadata: { endpoint } },
      true
    );
  }
}

/**
 * Error categories for classification
 */
export type ErrorCategory = 'memory' | 'disk' | 'network' | 'validation' | 'performance' | 'resource';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Error context information
 */
export interface ErrorContext {
  component: string;
  operation: string;
  filePath?: string;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Structured error record for logging
 */
export interface ErrorRecord {
  name: string;
  message: string;
  code: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context: ErrorContext;
  timestamp: Date;
  recoverable: boolean;
  stack?: string;
}

/**
 * Error recovery configuration
 */
export interface RecoveryConfig {
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;
  fallbackStrategy?: 'degrade' | 'cache' | 'skip' | 'fail';
  circuitBreakerThreshold?: number;
}

/**
 * Central error handler with recovery and monitoring capabilities
 */
export class ErrorHandler extends EventEmitter {
  private errorCounts: Map<string, number> = new Map();
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private recoveryConfig: RecoveryConfig;

  constructor(config: Partial<RecoveryConfig> = {}) {
    super();
    this.recoveryConfig = {
      maxRetries: 3,
      retryDelayMs: 1000,
      exponentialBackoff: true,
      fallbackStrategy: 'degrade',
      circuitBreakerThreshold: 5,
      ...config
    };
  }

  /**
   * Handle an error with automatic recovery attempts
   */
  async handleError<T>(
    error: OutputManagementError,
    operation: () => Promise<T>,
    context?: Partial<ErrorContext>
  ): Promise<T> {
    const errorKey = `${error.context.component}.${error.context.operation}`;
    
    // Update error tracking
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);

    // Check circuit breaker
    if (this.isCircuitOpen(errorKey)) {
      throw new OutputManagementError(
        'Circuit breaker open - too many recent failures',
        'CIRCUIT_BREAKER_OPEN',
        'resource',
        'high',
        context,
        false
      );
    }

    // Emit error event for monitoring
    this.emit('error', error);

    // Attempt recovery if error is recoverable
    if (error.recoverable && count < this.recoveryConfig.maxRetries) {
      await this.delay(this.calculateRetryDelay(count));
      
      try {
        const result = await operation();
        this.recordSuccess(errorKey);
        return result;
      } catch (retryError) {
        if (retryError instanceof OutputManagementError) {
          return this.handleError(retryError, operation, context);
        }
        throw retryError;
      }
    }

    // Apply fallback strategy
    if (this.recoveryConfig.fallbackStrategy) {
      const fallbackResult = await this.applyFallback(error, context);
      if (fallbackResult !== null) {
        return fallbackResult as T;
      }
    }

    // Update circuit breaker
    this.updateCircuitBreaker(errorKey);

    throw error;
  }

  /**
   * Wrap a function with error handling
   */
  withErrorHandling<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: Partial<ErrorContext>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const managedError = this.wrapError(error, context);
        return this.handleError(managedError, () => fn(...args), context);
      }
    };
  }

  /**
   * Convert any error to OutputManagementError
   */
  private wrapError(error: any, context: Partial<ErrorContext>): OutputManagementError {
    if (error instanceof OutputManagementError) {
      return error;
    }

    // Classify error based on message/type
    let category: ErrorCategory = 'resource';
    let code = 'UNKNOWN_ERROR';

    if (error.code === 'ENOENT' || error.code === 'EACCES') {
      category = 'disk';
      code = 'FILE_SYSTEM_ERROR';
    } else if (error.code === 'ENOSPC') {
      category = 'disk';
      code = 'DISK_SPACE_ERROR';
    } else if (error.code === 'ENOMEM') {
      category = 'memory';
      code = 'MEMORY_ERROR';
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      category = 'network';
      code = 'NETWORK_ERROR';
    }

    return new OutputManagementError(
      error.message || 'Unknown error occurred',
      code,
      category,
      'medium',
      context,
      true
    );
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number): number {
    if (!this.recoveryConfig.exponentialBackoff) {
      return this.recoveryConfig.retryDelayMs;
    }
    return this.recoveryConfig.retryDelayMs * Math.pow(2, attempt);
  }

  /**
   * Apply fallback strategy
   */
  private async applyFallback(error: OutputManagementError, context?: Partial<ErrorContext>): Promise<any> {
    switch (this.recoveryConfig.fallbackStrategy) {
      case 'degrade':
        this.emit('fallback', { type: 'degrade', error, context });
        return this.getDegradedResult(error);
      
      case 'cache':
        this.emit('fallback', { type: 'cache', error, context });
        return this.getCachedResult(error);
      
      case 'skip':
        this.emit('fallback', { type: 'skip', error, context });
        return null;
      
      default:
        return null;
    }
  }

  /**
   * Get degraded result (simplified/minimal functionality)
   */
  private getDegradedResult(error: OutputManagementError): any {
    switch (error.category) {
      case 'memory':
        return { chunks: [], metadata: { degraded: true, reason: 'memory_limit' } };
      
      case 'disk':
        return { success: false, degraded: true, reason: 'disk_error' };
      
      default:
        return { degraded: true, reason: error.code };
    }
  }

  /**
   * Get cached result if available
   */
  private getCachedResult(error: OutputManagementError): any {
    // This would integrate with ResultCache in a real implementation
    return null;
  }

  /**
   * Check if circuit breaker is open
   */
  private isCircuitOpen(errorKey: string): boolean {
    const state = this.circuitBreakers.get(errorKey);
    if (!state) return false;

    if (state.state === 'open') {
      // Check if half-open period has elapsed
      if (Date.now() - state.lastFailure > 30000) { // 30 second timeout
        this.circuitBreakers.set(errorKey, { ...state, state: 'half-open' });
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Update circuit breaker state
   */
  private updateCircuitBreaker(errorKey: string): void {
    const threshold = this.recoveryConfig.circuitBreakerThreshold || 5;
    const errorCount = this.errorCounts.get(errorKey) || 0;

    if (errorCount >= threshold) {
      this.circuitBreakers.set(errorKey, {
        state: 'open',
        failureCount: errorCount,
        lastFailure: Date.now()
      });
      this.emit('circuitBreakerOpen', { key: errorKey, count: errorCount });
    }
  }

  /**
   * Record successful operation
   */
  private recordSuccess(errorKey: string): void {
    this.errorCounts.set(errorKey, 0);
    const state = this.circuitBreakers.get(errorKey);
    if (state && state.state !== 'closed') {
      this.circuitBreakers.set(errorKey, { ...state, state: 'closed' });
      this.emit('circuitBreakerClosed', { key: errorKey });
    }
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get error statistics
   */
  getErrorStats(): ErrorStats {
    const stats: ErrorStats = {
      totalErrors: 0,
      errorsByCategory: {
        memory: 0,
        disk: 0,
        network: 0,
        validation: 0,
        performance: 0,
        resource: 0
      },
      errorsBySeverity: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0
      },
      circuitBreakers: {}
    };

    this.errorCounts.forEach((count, key) => {
      stats.totalErrors += count;
    });

    this.circuitBreakers.forEach((state, key) => {
      stats.circuitBreakers[key] = state;
    });

    return stats;
  }

  /**
   * Reset error tracking
   */
  reset(): void {
    this.errorCounts.clear();
    this.circuitBreakers.clear();
    this.emit('reset');
  }
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailure: number;
}

/**
 * Error statistics
 */
export interface ErrorStats {
  totalErrors: number;
  errorsByCategory: Record<ErrorCategory, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  circuitBreakers: Record<string, CircuitBreakerState>;
}

/**
 * Global error handler instance
 */
export const globalErrorHandler = new ErrorHandler();

/**
 * Decorator for automatic error handling
 */
export function withErrorHandling(context: Partial<ErrorContext>) {
  return function <T extends any[], R>(
    target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (...args: T): Promise<R> {
      const wrappedMethod = globalErrorHandler.withErrorHandling(
        originalMethod.bind(this),
        { ...context, component: target.constructor.name, operation: propertyKey }
      );
      return wrappedMethod(...args);
    };
  };
}

/**
 * Health check utilities
 */
export class HealthChecker {
  private checks: Map<string, HealthCheck> = new Map();
  private readonly errorHandler: ErrorHandler;

  constructor(errorHandler: ErrorHandler = globalErrorHandler) {
    this.errorHandler = errorHandler;
  }

  /**
   * Register a health check
   */
  registerCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  /**
   * Run all health checks
   */
  async runAllChecks(): Promise<HealthStatus> {
    const results: Record<string, boolean> = {};
    const errors: string[] = [];
    let healthy = true;

    for (const [name, check] of this.checks) {
      try {
        const result = await check();
        results[name] = result;
        if (!result) healthy = false;
      } catch (error) {
        results[name] = false;
        healthy = false;
        errors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return {
      healthy,
      timestamp: new Date(),
      checks: results,
      errors: errors.length > 0 ? errors : undefined,
      stats: this.errorHandler.getErrorStats()
    };
  }
}

/**
 * Health check function type
 */
export type HealthCheck = () => Promise<boolean>;

/**
 * Health status result
 */
export interface HealthStatus {
  healthy: boolean;
  timestamp: Date;
  checks: Record<string, boolean>;
  errors?: string[];
  stats: ErrorStats;
}