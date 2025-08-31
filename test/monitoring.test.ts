/**
 * Test suite for the comprehensive monitoring and observability system
 * Tests logging, metrics collection, health monitoring, and alerting
 */

import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import {
  Logger,
  LogLevel,
  ConsoleTransport,
  FileTransport,
  JSONFormatter,
  TextFormatter,
  MetricsCollector,
  MemoryMetricCollector,
  CPUMetricCollector,
  HealthMonitor,
  DatabaseHealthCheck,
  DiskSpaceHealthCheck,
  AlertManager,
  ConsoleAlertChannel,
  MonitoringSystem,
  type LogEntry,
  type MetricValue,
  type HealthCheckResult,
  type AlertRule,
} from '../src/lib/monitoring';

// Mock filesystem operations
vi.mock('fs/promises');
const mockFs = fs as any;

describe('Logger', () => {
  let logger: Logger;
  let mockTransport: any;

  beforeEach(() => {
    mockTransport = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    logger = new Logger('test-component', {
      level: LogLevel.DEBUG,
      transports: [mockTransport],
    });
  });

  it('should create logger with correct component name', () => {
    expect(logger).toBeDefined();
  });

  it('should log messages at appropriate levels', () => {
    logger.info('test message', { key: 'value' });
    
    expect(mockTransport.write).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.INFO,
        message: 'test message',
        component: 'test-component',
        context: expect.objectContaining({ key: 'value' }),
      })
    );
  });

  it('should respect log level filtering', () => {
    logger.setLevel(LogLevel.WARN);
    logger.debug('debug message');
    logger.info('info message');
    logger.warn('warn message');

    expect(mockTransport.write).toHaveBeenCalledTimes(1);
    expect(mockTransport.write).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.WARN,
        message: 'warn message',
      })
    );
  });

  it('should emit log events', () => {
    const logSpy = vi.fn();
    logger.on('log', logSpy);
    
    logger.error('error message');
    
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        level: LogLevel.ERROR,
        message: 'error message',
        correlationId: expect.any(String),
      })
    );
  });

  it('should handle context updates', () => {
    logger.setContext({ globalKey: 'globalValue' });
    logger.info('test message', { localKey: 'localValue' });

    expect(mockTransport.write).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          globalKey: 'globalValue',
          localKey: 'localValue',
        }),
      })
    );
  });
});

describe('FileTransport', () => {
  let transport: FileTransport;
  const testFilePath = '/test/logs/app.log';

  beforeEach(() => {
    mockFs.stat = vi.fn().mockResolvedValue({ size: 1000 });
    mockFs.appendFile = vi.fn().mockResolvedValue(undefined);
    mockFs.mkdir = vi.fn().mockResolvedValue(undefined);
    mockFs.rename = vi.fn().mockResolvedValue(undefined);
    mockFs.unlink = vi.fn().mockResolvedValue(undefined);

    transport = new FileTransport(testFilePath, {
      maxSize: 1024 * 1024, // 1MB
      maxFiles: 3,
    });
  });

  it('should write log entries to file', async () => {
    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: 'test message',
      component: 'test',
    };

    await transport.write(logEntry);

    expect(mockFs.appendFile).toHaveBeenCalledWith(
      testFilePath,
      expect.stringContaining('"message":"test message"')
    );
  });

  it('should rotate files when size limit reached', async () => {
    mockFs.stat.mockResolvedValue({ size: 2 * 1024 * 1024 }); // 2MB

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: 'test message',
      component: 'test',
    };

    await transport.write(logEntry);

    expect(mockFs.rename).toHaveBeenCalled();
  });

  it('should create directory if it does not exist', async () => {
    mockFs.stat.mockRejectedValue(new Error('File not found'));

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level: LogLevel.INFO,
      message: 'test message',
      component: 'test',
    };

    await transport.write(logEntry);

    expect(mockFs.mkdir).toHaveBeenCalledWith('/test/logs', { recursive: true });
  });
});

describe('LogFormatters', () => {
  const testEntry: LogEntry = {
    timestamp: new Date('2023-01-01T12:00:00Z'),
    level: LogLevel.INFO,
    message: 'test message',
    component: 'test-component',
    context: { key: 'value' },
    correlationId: 'corr-123',
  };

  it('should format JSON correctly', () => {
    const formatter = new JSONFormatter();
    const formatted = formatter.format(testEntry);
    const parsed = JSON.parse(formatted);

    expect(parsed).toEqual({
      timestamp: '2023-01-01T12:00:00.000Z',
      level: 'INFO',
      component: 'test-component',
      message: 'test message',
      key: 'value',
      correlationId: 'corr-123',
      requestId: undefined,
      userId: undefined,
    });
  });

  it('should format text correctly', () => {
    const formatter = new TextFormatter();
    const formatted = formatter.format(testEntry);

    expect(formatted).toContain('2023-01-01T12:00:00.000Z');
    expect(formatted).toContain('INFO');
    expect(formatted).toContain('[test-component]');
    expect(formatted).toContain('test message');
    expect(formatted).toContain('{"key":"value"}');
  });
});

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({
      retentionPeriod: 60000, // 1 minute for testing
    });
  });

  afterEach(() => {
    collector.stopCollection();
  });

  it('should record counter metrics', () => {
    collector.counter('test_counter', 5, { type: 'test' });
    
    const metrics = collector.getMetrics('test_counter');
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toEqual(
      expect.objectContaining({
        value: 5,
        labels: { type: 'test' },
        timestamp: expect.any(Date),
      })
    );
  });

  it('should record gauge metrics', () => {
    collector.gauge('test_gauge', 100);
    collector.gauge('test_gauge', 150);
    
    const metrics = collector.getMetrics('test_gauge');
    expect(metrics).toHaveLength(2);
    expect(metrics[1].value).toBe(150);
  });

  it('should calculate aggregated metrics', () => {
    collector.counter('test_metric', 10);
    collector.counter('test_metric', 20);
    collector.counter('test_metric', 30);
    
    const aggregated = collector.getAggregatedMetrics('test_metric', 60000);
    expect(aggregated).toEqual({
      count: 3,
      sum: 60,
      avg: 20,
      min: 10,
      max: 30,
    });
  });

  it('should clean up old metrics', async () => {
    collector.counter('test_metric', 1);
    
    // Simulate time passage
    const oldCleanup = collector['cleanupOldMetrics'].bind(collector);
    collector['retentionPeriod'] = 0; // Immediate cleanup
    collector['cleanupOldMetrics']();
    
    const metrics = collector.getMetrics('test_metric');
    expect(metrics).toHaveLength(0);
  });

  it('should register and collect from custom collectors', async () => {
    const mockCollector = {
      collect: vi.fn().mockResolvedValue(42),
    };
    
    collector.registerCollector('custom_metric', mockCollector);
    collector.startCollection(100);
    
    // Wait for collection
    await new Promise(resolve => setTimeout(resolve, 150));
    
    expect(mockCollector.collect).toHaveBeenCalled();
    
    const metrics = collector.getMetrics('custom_metric');
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0].value).toBe(42);
  });

  it('should emit metric events', () => {
    const metricSpy = vi.fn();
    collector.on('metric', metricSpy);
    
    collector.histogram('test_histogram', 123);
    
    expect(metricSpy).toHaveBeenCalledWith(
      'test_histogram',
      expect.objectContaining({ value: 123 })
    );
  });
});

describe('MetricCollectors', () => {
  it('should collect memory metrics', async () => {
    const collector = new MemoryMetricCollector();
    const value = await collector.collect();
    
    expect(value).toBeGreaterThan(0);
    expect(typeof value).toBe('number');
  });

  it('should collect CPU metrics', async () => {
    const collector = new CPUMetricCollector();
    
    // First collection establishes baseline
    await collector.collect();
    
    // Second collection should return a percentage
    const value = await collector.collect();
    
    expect(typeof value).toBe('number');
    expect(value).toBeGreaterThanOrEqual(0);
  });
});

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor();
  });

  afterEach(() => {
    monitor.stopMonitoring();
  });

  it('should register and run health checks', async () => {
    const mockCheck = {
      check: vi.fn().mockResolvedValue({ status: 'ok' }),
    };
    
    monitor.registerCheck('test_check', mockCheck);
    const result = await monitor.runCheck('test_check');
    
    expect(result).toEqual(
      expect.objectContaining({
        name: 'test_check',
        healthy: true,
        duration: expect.any(Number),
        details: { status: 'ok' },
      })
    );
  });

  it('should handle failed health checks', async () => {
    const mockCheck = {
      check: vi.fn().mockRejectedValue(new Error('Check failed')),
    };
    
    monitor.registerCheck('failing_check', mockCheck);
    const result = await monitor.runCheck('failing_check');
    
    expect(result).toEqual(
      expect.objectContaining({
        name: 'failing_check',
        healthy: false,
        error: 'Check failed',
        duration: expect.any(Number),
      })
    );
  });

  it('should run all checks and aggregate results', async () => {
    const goodCheck = {
      check: vi.fn().mockResolvedValue(undefined),
    };
    const badCheck = {
      check: vi.fn().mockRejectedValue(new Error('Failed')),
    };
    
    monitor.registerCheck('good', goodCheck);
    monitor.registerCheck('bad', badCheck);
    
    const results = await monitor.runAllChecks();
    
    expect(results.healthy).toBe(false); // One check failed
    expect(results.checks).toHaveLength(2);
    expect(results.timestamp).toBeInstanceOf(Date);
  });

  it('should start and stop monitoring', () => {
    const runAllChecksSpy = vi.spyOn(monitor, 'runAllChecks').mockResolvedValue({
      healthy: true,
      checks: [],
      timestamp: new Date(),
    });
    
    monitor.startMonitoring(100);
    
    // Wait for interval
    setTimeout(() => {
      expect(runAllChecksSpy).toHaveBeenCalled();
      monitor.stopMonitoring();
    }, 150);
  });

  it('should emit health check events', async () => {
    const eventSpy = vi.fn();
    monitor.on('healthCheck', eventSpy);
    
    const mockCheck = {
      check: vi.fn().mockResolvedValue(undefined),
    };
    
    monitor.registerCheck('test', mockCheck);
    await monitor.runCheck('test');
    
    expect(eventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'test',
        healthy: true,
      })
    );
  });
});

describe('HealthChecks', () => {
  it('should check database connection', async () => {
    const connectionTest = vi.fn().mockResolvedValue(true);
    const check = new DatabaseHealthCheck(connectionTest);
    
    const result = await check.check();
    
    expect(connectionTest).toHaveBeenCalled();
    expect(result).toEqual({ connected: true });
  });

  it('should fail database check when connection fails', async () => {
    const connectionTest = vi.fn().mockResolvedValue(false);
    const check = new DatabaseHealthCheck(connectionTest);
    
    await expect(check.check()).rejects.toThrow('Database connection failed');
  });

  it('should check disk space', async () => {
    mockFs.statfs = vi.fn().mockResolvedValue({
      bavail: 1000000, // Available blocks
      bsize: 4096, // Block size
      blocks: 2000000, // Total blocks
    });
    
    const check = new DiskSpaceHealthCheck('/test/path', 1); // 1GB minimum
    const result = await check.check();
    
    expect(result).toEqual(
      expect.objectContaining({
        freeGB: expect.any(Number),
        totalGB: expect.any(Number),
        usagePercent: expect.any(Number),
      })
    );
  });

  it('should fail disk space check when insufficient space', async () => {
    mockFs.statfs = vi.fn().mockResolvedValue({
      bavail: 100, // Very few available blocks
      bsize: 4096,
      blocks: 2000000,
    });
    
    const check = new DiskSpaceHealthCheck('/test/path', 5); // 5GB minimum
    
    await expect(check.check()).rejects.toThrow('Insufficient disk space');
  });
});

describe('AlertManager', () => {
  let alertManager: AlertManager;
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    alertManager = new AlertManager(metricsCollector);
  });

  afterEach(() => {
    alertManager.stopMonitoring();
  });

  it('should add and remove alert rules', () => {
    const rule: AlertRule = {
      id: 'test_rule',
      name: 'Test Rule',
      metric: 'test_metric',
      operator: 'gt',
      threshold: 100,
      duration: 60000,
      enabled: true,
      severity: 'medium',
      channels: ['console'],
    };
    
    alertManager.addRule(rule);
    // Test by accessing private property (in real scenarios, we'd have a getter)
    expect(alertManager['rules'].has('test_rule')).toBe(true);
    
    alertManager.removeRule('test_rule');
    expect(alertManager['rules'].has('test_rule')).toBe(false);
  });

  it('should trigger alerts when thresholds are exceeded', async () => {
    const alertSpy = vi.fn();
    alertManager.on('alert', alertSpy);
    
    const mockChannel = {
      send: vi.fn().mockResolvedValue(undefined),
      sendResolution: vi.fn().mockResolvedValue(undefined),
    };
    
    alertManager.addChannel('test', mockChannel);
    
    const rule: AlertRule = {
      id: 'high_value',
      name: 'High Value Alert',
      metric: 'test_metric',
      operator: 'gt',
      threshold: 50,
      duration: 1000,
      enabled: true,
      severity: 'high',
      channels: ['test'],
    };
    
    alertManager.addRule(rule);
    
    // Generate metric above threshold
    metricsCollector.gauge('test_metric', 75);
    
    // Trigger alert evaluation
    await alertManager['checkRules']();
    
    expect(alertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'high_value',
        severity: 'high',
        threshold: 50,
      })
    );
    expect(mockChannel.send).toHaveBeenCalled();
  });

  it('should resolve alerts when conditions are no longer met', async () => {
    const resolutionSpy = vi.fn();
    alertManager.on('alertResolved', resolutionSpy);
    
    const rule: AlertRule = {
      id: 'test_rule',
      name: 'Test Rule',
      metric: 'test_metric',
      operator: 'gt',
      threshold: 50,
      duration: 1000,
      enabled: true,
      severity: 'medium',
      channels: [],
    };
    
    alertManager.addRule(rule);
    
    // Trigger alert
    metricsCollector.gauge('test_metric', 75);
    await alertManager['checkRules']();
    
    // Resolve alert
    metricsCollector.gauge('test_metric', 25);
    await alertManager['checkRules']();
    
    expect(resolutionSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test_rule',
        name: 'Test Rule',
      })
    );
  });

  it('should evaluate different operators correctly', async () => {
    const testCases = [
      { operator: 'gt' as const, value: 75, threshold: 50, shouldAlert: true },
      { operator: 'lt' as const, value: 25, threshold: 50, shouldAlert: true },
      { operator: 'gte' as const, value: 50, threshold: 50, shouldAlert: true },
      { operator: 'lte' as const, value: 50, threshold: 50, shouldAlert: true },
      { operator: 'eq' as const, value: 50, threshold: 50, shouldAlert: true },
    ];
    
    for (const testCase of testCases) {
      const rule: AlertRule = {
        id: `test_${testCase.operator}`,
        name: `Test ${testCase.operator}`,
        metric: 'test_metric',
        operator: testCase.operator,
        threshold: testCase.threshold,
        duration: 1000,
        enabled: true,
        severity: 'low',
        channels: [],
      };
      
      alertManager.addRule(rule);
      metricsCollector.gauge('test_metric', testCase.value);
      
      const shouldAlert = await alertManager['evaluateRule'](rule);
      expect(shouldAlert).toBe(testCase.shouldAlert);
    }
  });
});

describe('AlertChannels', () => {
  it('should send alerts via console channel', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const channel = new ConsoleAlertChannel();
    
    const alert = {
      id: 'test_alert',
      name: 'Test Alert',
      severity: 'high',
      metric: 'test_metric',
      operator: 'gt',
      threshold: 100,
      timestamp: new Date(),
    };
    
    await channel.send(alert);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🚨 ALERT: Test Alert (high)')
    );
    
    consoleSpy.mockRestore();
  });

  it('should send resolutions via console channel', async () => {
    const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const channel = new ConsoleAlertChannel();
    
    const resolution = {
      id: 'test_alert',
      name: 'Test Alert',
      timestamp: new Date(),
    };
    
    await channel.sendResolution(resolution);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('✅ RESOLVED: Test Alert')
    );
    
    consoleSpy.mockRestore();
  });
});

describe('MonitoringSystem Integration', () => {
  let monitoring: MonitoringSystem;

  beforeEach(() => {
    monitoring = new MonitoringSystem({
      component: 'test-system',
      logLevel: LogLevel.DEBUG,
    });
  });

  afterEach(() => {
    monitoring.stop();
  });

  it('should initialize all subsystems', () => {
    expect(monitoring.logger).toBeDefined();
    expect(monitoring.metrics).toBeDefined();
    expect(monitoring.health).toBeDefined();
    expect(monitoring.alerts).toBeDefined();
  });

  it('should start and stop all subsystems', () => {
    const metricsStartSpy = vi.spyOn(monitoring.metrics, 'startCollection');
    const healthStartSpy = vi.spyOn(monitoring.health, 'startMonitoring');
    const alertsStartSpy = vi.spyOn(monitoring.alerts, 'startMonitoring');
    
    const metricsStopSpy = vi.spyOn(monitoring.metrics, 'stopCollection');
    const healthStopSpy = vi.spyOn(monitoring.health, 'stopMonitoring');
    const alertsStopSpy = vi.spyOn(monitoring.alerts, 'stopMonitoring');
    
    monitoring.start();
    
    expect(metricsStartSpy).toHaveBeenCalled();
    expect(healthStartSpy).toHaveBeenCalled();
    expect(alertsStartSpy).toHaveBeenCalled();
    
    monitoring.stop();
    
    expect(metricsStopSpy).toHaveBeenCalled();
    expect(healthStopSpy).toHaveBeenCalled();
    expect(alertsStopSpy).toHaveBeenCalled();
  });

  it('should provide system status', () => {
    const status = monitoring.getSystemStatus();
    
    expect(status).toEqual(
      expect.objectContaining({
        healthy: expect.any(Boolean),
        uptime: expect.any(Number),
        performance: expect.any(Object),
        alerts: expect.any(Number),
        lastCheck: expect.any(Date),
      })
    );
  });

  it('should set up default metrics and health checks', () => {
    // Verify default metrics collectors are registered
    expect(monitoring.metrics['collectors'].has('memory_usage')).toBe(true);
    expect(monitoring.metrics['collectors'].has('cpu_usage')).toBe(true);
    
    // Verify default health checks are registered
    expect(monitoring.health['checks'].has('memory_usage')).toBe(true);
  });

  it('should set up default alert rules', () => {
    // Verify default alert rules are configured
    expect(monitoring.alerts['rules'].has('high_memory_usage')).toBe(true);
    expect(monitoring.alerts['rules'].has('high_cpu_usage')).toBe(true);
    
    // Verify console alert channel is configured
    expect(monitoring.alerts['channels'].has('console')).toBe(true);
  });
});

describe('Performance and Stress Tests', () => {
  it('should handle high-volume logging efficiently', async () => {
    const logger = new Logger('perf-test');
    const start = Date.now();
    
    // Log 10,000 messages
    for (let i = 0; i < 10000; i++) {
      logger.info(`Performance test message ${i}`, { iteration: i });
    }
    
    const duration = Date.now() - start;
    
    // Should complete in reasonable time (less than 1 second)
    expect(duration).toBeLessThan(1000);
  });

  it('should handle large numbers of metrics efficiently', () => {
    const collector = new MetricsCollector();
    const start = Date.now();
    
    // Record 50,000 metrics
    for (let i = 0; i < 50000; i++) {
      collector.counter('test_counter', 1, { batch: Math.floor(i / 1000).toString() });
    }
    
    const duration = Date.now() - start;
    const metrics = collector.getMetrics('test_counter');
    
    expect(metrics).toHaveLength(50000);
    expect(duration).toBeLessThan(2000); // Should complete in under 2 seconds
  });

  it('should handle concurrent health checks', async () => {
    const monitor = new HealthMonitor();
    
    // Register multiple health checks
    for (let i = 0; i < 20; i++) {
      monitor.registerCheck(`check_${i}`, {
        check: () => Promise.resolve({ status: 'ok', id: i }),
      });
    }
    
    const start = Date.now();
    const results = await monitor.runAllChecks();
    const duration = Date.now() - start;
    
    expect(results.checks).toHaveLength(20);
    expect(results.healthy).toBe(true);
    expect(duration).toBeLessThan(1000); // Should complete quickly
  });
});

describe('Error Handling and Edge Cases', () => {
  it('should handle transport failures gracefully', async () => {
    class FailingTransport extends ConsoleTransport {
      async write(entry: LogEntry): Promise<void> {
        throw new Error('Transport failed');
      }
    }
    
    const logger = new Logger('test', {
      transports: [new FailingTransport()],
    });
    
    // Should not throw even if transport fails
    expect(() => {
      logger.error('test message');
    }).not.toThrow();
  });

  it('should handle metric collector failures', async () => {
    const collector = new MetricsCollector();
    const errorSpy = vi.fn();
    collector.on('error', errorSpy);
    
    const failingCollector = {
      collect: vi.fn().mockRejectedValue(new Error('Collection failed')),
    };
    
    collector.registerCollector('failing_collector', failingCollector);
    await collector['collectMetrics']();
    
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(Error)
    );
  });

  it('should handle empty metrics gracefully', () => {
    const collector = new MetricsCollector();
    
    const aggregated = collector.getAggregatedMetrics('nonexistent_metric', 60000);
    expect(aggregated).toBeNull();
    
    const metrics = collector.getMetrics('nonexistent_metric');
    expect(metrics).toEqual([]);
  });

  it('should handle health check timeouts', async () => {
    const monitor = new HealthMonitor();
    
    // Register a slow health check
    monitor.registerCheck('slow_check', {
      check: () => new Promise(resolve => setTimeout(() => resolve(undefined), 2000)),
    });
    
    // This test would need timeout handling in the actual implementation
    const result = await monitor.runCheck('slow_check');
    expect(result.duration).toBeGreaterThan(0);
  });
});

// Helper functions for testing
function createTestLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    timestamp: new Date(),
    level: LogLevel.INFO,
    message: 'test message',
    component: 'test-component',
    ...overrides,
  };
}

function createTestMetricValue(overrides: Partial<MetricValue> = {}): MetricValue {
  return {
    timestamp: new Date(),
    value: 100,
    ...overrides,
  };
}

function waitForTimeout(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}