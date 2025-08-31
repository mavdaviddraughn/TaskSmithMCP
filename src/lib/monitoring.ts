/**
 * Comprehensive monitoring and observability system for TaskSmith MCP
 * Provides logging, metrics collection, health checks, and alerting capabilities
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';

// Types and interfaces
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  component: string;
  context?: Record<string, any>;
  correlationId?: string;
  requestId?: string;
  userId?: string;
}

export interface MetricValue {
  timestamp: Date;
  value: number;
  labels?: Record<string, string>;
}

export interface HealthCheckResult {
  name: string;
  healthy: boolean;
  duration: number;
  error?: string;
  details?: Record<string, any>;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  channels: string[];
}

export interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: number;
  cpuUsage: number;
}

export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary'
}

// Logging system
export class Logger extends EventEmitter {
  private logLevel: LogLevel;
  private component: string;
  private transports: LogTransport[];
  private context: Record<string, any>;

  constructor(component: string, options: {
    level?: LogLevel;
    transports?: LogTransport[];
    context?: Record<string, any>;
  } = {}) {
    super();
    this.component = component;
    this.logLevel = options.level ?? LogLevel.INFO;
    this.transports = options.transports ?? [new ConsoleTransport()];
    this.context = options.context ?? {};
  }

  public trace(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.TRACE, message, context);
  }

  public debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  public fatal(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, message, context);
  }

  public setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  public setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  private log(level: LogLevel, message: string, context?: Record<string, any>): void {
    if (level < this.logLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      component: this.component,
      context: { ...this.context, ...context },
      correlationId: this.generateCorrelationId(),
    };

    this.emit('log', entry);

    for (const transport of this.transports) {
      transport.write(entry).catch(error => {
        console.error('Log transport error:', error);
      });
    }
  }

  private generateCorrelationId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Log transports
export abstract class LogTransport {
  protected formatter: LogFormatter;

  constructor(formatter?: LogFormatter) {
    this.formatter = formatter ?? new JSONFormatter();
  }

  abstract write(entry: LogEntry): Promise<void>;

  protected format(entry: LogEntry): string {
    return this.formatter.format(entry);
  }
}

export class ConsoleTransport extends LogTransport {
  async write(entry: LogEntry): Promise<void> {
    const formatted = this.format(entry);
    if (entry.level >= LogLevel.ERROR) {
      console.error(formatted);
    } else {
      console.log(formatted);
    }
  }
}

export class FileTransport extends LogTransport {
  private filePath: string;
  private maxSize: number;
  private maxFiles: number;

  constructor(filePath: string, options: {
    formatter?: LogFormatter;
    maxSize?: number; // bytes
    maxFiles?: number;
  } = {}) {
    super(options.formatter);
    this.filePath = filePath;
    this.maxSize = options.maxSize ?? 100 * 1024 * 1024; // 100MB
    this.maxFiles = options.maxFiles ?? 5;
  }

  async write(entry: LogEntry): Promise<void> {
    try {
      await this.rotateIfNeeded();
      const formatted = this.format(entry) + '\n';
      await fs.appendFile(this.filePath, formatted);
    } catch (error) {
      console.error('FileTransport write error:', error);
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    try {
      const stats = await fs.stat(this.filePath);
      if (stats.size >= this.maxSize) {
        await this.rotate();
      }
    } catch (error) {
      // File doesn't exist, create directory
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async rotate(): Promise<void> {
    const dir = path.dirname(this.filePath);
    const filename = path.basename(this.filePath);
    const ext = path.extname(filename);
    const name = path.basename(filename, ext);

    // Rotate existing files
    for (let i = this.maxFiles - 1; i > 0; i--) {
      const oldPath = path.join(dir, `${name}.${i}${ext}`);
      const newPath = path.join(dir, `${name}.${i + 1}${ext}`);
      
      try {
        await fs.rename(oldPath, newPath);
      } catch {
        // File doesn't exist, continue
      }
    }

    // Move current file to .1
    const rotatedPath = path.join(dir, `${name}.1${ext}`);
    try {
      await fs.rename(this.filePath, rotatedPath);
    } catch {
      // File doesn't exist, continue
    }

    // Clean up old files beyond maxFiles
    try {
      const oldFile = path.join(dir, `${name}.${this.maxFiles + 1}${ext}`);
      await fs.unlink(oldFile);
    } catch {
      // File doesn't exist, continue
    }
  }
}

// Log formatters
export abstract class LogFormatter {
  abstract format(entry: LogEntry): string;
}

export class JSONFormatter extends LogFormatter {
  format(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: LogLevel[entry.level],
      component: entry.component,
      message: entry.message,
      ...entry.context,
      correlationId: entry.correlationId,
      requestId: entry.requestId,
      userId: entry.userId,
    });
  }
}

export class TextFormatter extends LogFormatter {
  format(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = LogLevel[entry.level].padEnd(5);
    const component = entry.component.padEnd(15);
    const contextStr = entry.context && Object.keys(entry.context).length > 0 
      ? ` [${JSON.stringify(entry.context)}]` 
      : '';
    
    return `${timestamp} ${level} [${component}] ${entry.message}${contextStr}`;
  }
}

// Metrics collection system
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, MetricValue[]> = new Map();
  private collectors: Map<string, MetricCollector> = new Map();
  private collectInterval: NodeJS.Timeout | null = null;
  private retentionPeriod: number;

  constructor(options: {
    retentionPeriod?: number; // milliseconds
    collectInterval?: number; // milliseconds
  } = {}) {
    super();
    this.retentionPeriod = options.retentionPeriod ?? 24 * 60 * 60 * 1000; // 24 hours
    
    if (options.collectInterval) {
      this.startCollection(options.collectInterval);
    }
  }

  public counter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  public gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  public histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.recordMetric(name, value, labels);
  }

  public registerCollector(name: string, collector: MetricCollector): void {
    this.collectors.set(name, collector);
  }

  public getMetrics(name: string, since?: Date): MetricValue[] {
    const values = this.metrics.get(name) ?? [];
    if (since) {
      return values.filter(v => v.timestamp >= since);
    }
    return [...values];
  }

  public getAllMetrics(): Record<string, MetricValue[]> {
    const result: Record<string, MetricValue[]> = {};
    for (const [name, values] of this.metrics) {
      result[name] = [...values];
    }
    return result;
  }

  public getAggregatedMetrics(name: string, window: number): {
    count: number;
    sum: number;
    avg: number;
    min: number;
    max: number;
  } | null {
    const since = new Date(Date.now() - window);
    const values = this.getMetrics(name, since);
    
    if (values.length === 0) {
      return null;
    }

    const numbers = values.map(v => v.value);
    return {
      count: numbers.length,
      sum: numbers.reduce((a, b) => a + b, 0),
      avg: numbers.reduce((a, b) => a + b, 0) / numbers.length,
      min: Math.min(...numbers),
      max: Math.max(...numbers),
    };
  }

  public startCollection(interval: number): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }

    this.collectInterval = setInterval(async () => {
      await this.collectMetrics();
      this.cleanupOldMetrics();
    }, interval);
  }

  public stopCollection(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = null;
    }
  }

  private recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metric: MetricValue = {
      timestamp: new Date(),
      value,
      labels,
    };

    this.metrics.get(name)!.push(metric);
    this.emit('metric', name, metric);
  }

  private async collectMetrics(): Promise<void> {
    for (const [name, collector] of this.collectors) {
      try {
        const value = await collector.collect();
        this.recordMetric(name, value);
      } catch (error) {
        this.emit('error', new Error(`Metric collection failed for ${name}: ${error}`));
      }
    }
  }

  private cleanupOldMetrics(): void {
    const cutoff = new Date(Date.now() - this.retentionPeriod);
    
    for (const [name, values] of this.metrics) {
      const filtered = values.filter(v => v.timestamp > cutoff);
      this.metrics.set(name, filtered);
    }
  }
}

export abstract class MetricCollector {
  abstract collect(): Promise<number>;
}

export class MemoryMetricCollector extends MetricCollector {
  async collect(): Promise<number> {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }
}

export class CPUMetricCollector extends MetricCollector {
  private lastCpuUsage = process.cpuUsage();
  private lastTime = performance.now();

  async collect(): Promise<number> {
    const currentCpuUsage = process.cpuUsage(this.lastCpuUsage);
    const currentTime = performance.now();
    const timeDiff = currentTime - this.lastTime;

    const cpuPercent = (currentCpuUsage.user + currentCpuUsage.system) / (timeDiff * 1000);

    this.lastCpuUsage = process.cpuUsage();
    this.lastTime = currentTime;

    return cpuPercent * 100;
  }
}

// Health monitoring system
export class HealthMonitor extends EventEmitter {
  private checks: Map<string, HealthCheck> = new Map();
  private results: Map<string, HealthCheckResult> = new Map();
  private monitorInterval: NodeJS.Timeout | null = null;

  public registerCheck(name: string, check: HealthCheck): void {
    this.checks.set(name, check);
  }

  public async runCheck(name: string): Promise<HealthCheckResult> {
    const check = this.checks.get(name);
    if (!check) {
      throw new Error(`Health check '${name}' not found`);
    }

    const start = performance.now();
    try {
      const details = await check.check();
      const result: HealthCheckResult = {
        name,
        healthy: true,
        duration: performance.now() - start,
        details: details || undefined,
      };
      
      this.results.set(name, result);
      this.emit('healthCheck', result);
      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        name,
        healthy: false,
        duration: performance.now() - start,
        error: error instanceof Error ? error.message : String(error),
      };
      
      this.results.set(name, result);
      this.emit('healthCheck', result);
      return result;
    }
  }

  public async runAllChecks(): Promise<{
    healthy: boolean;
    checks: HealthCheckResult[];
    timestamp: Date;
  }> {
    const results = await Promise.all(
      Array.from(this.checks.keys()).map(name => this.runCheck(name))
    );

    return {
      healthy: results.every(r => r.healthy),
      checks: results,
      timestamp: new Date(),
    };
  }

  public getLastResult(name: string): HealthCheckResult | undefined {
    return this.results.get(name);
  }

  public startMonitoring(interval: number): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }

    this.monitorInterval = setInterval(async () => {
      try {
        await this.runAllChecks();
      } catch (error) {
        this.emit('error', error);
      }
    }, interval);
  }

  public stopMonitoring(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }
}

export abstract class HealthCheck {
  abstract check(): Promise<Record<string, any> | void>;
}

export class DatabaseHealthCheck extends HealthCheck {
  constructor(private connectionTest: () => Promise<boolean>) {
    super();
  }

  async check(): Promise<Record<string, any>> {
    const connected = await this.connectionTest();
    if (!connected) {
      throw new Error('Database connection failed');
    }
    return { connected: true };
  }
}

export class DiskSpaceHealthCheck extends HealthCheck {
  constructor(private path: string, private minFreeGB: number = 5) {
    super();
  }

  async check(): Promise<Record<string, any>> {
    try {
      const stats = await fs.statfs(this.path);
      const freeGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
      const totalGB = (stats.blocks * stats.bsize) / (1024 * 1024 * 1024);
      
      if (freeGB < this.minFreeGB) {
        throw new Error(`Insufficient disk space: ${freeGB.toFixed(2)}GB free, minimum ${this.minFreeGB}GB required`);
      }

      return {
        freeGB: parseFloat(freeGB.toFixed(2)),
        totalGB: parseFloat(totalGB.toFixed(2)),
        usagePercent: parseFloat((((totalGB - freeGB) / totalGB) * 100).toFixed(2)),
      };
    } catch (error) {
      throw new Error(`Disk space check failed: ${error}`);
    }
  }
}

// Alert system
export class AlertManager extends EventEmitter {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Date> = new Map();
  private channels: Map<string, AlertChannel> = new Map();
  private metricsCollector: MetricsCollector;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(metricsCollector: MetricsCollector) {
    super();
    this.metricsCollector = metricsCollector;
  }

  public addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  public removeRule(id: string): void {
    this.rules.delete(id);
    this.activeAlerts.delete(id);
  }

  public addChannel(name: string, channel: AlertChannel): void {
    this.channels.set(name, channel);
  }

  public startMonitoring(interval: number): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      await this.checkRules();
    }, interval);
  }

  public stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  private async checkRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        const shouldAlert = await this.evaluateRule(rule);
        
        if (shouldAlert && !this.activeAlerts.has(rule.id)) {
          await this.triggerAlert(rule);
          this.activeAlerts.set(rule.id, new Date());
        } else if (!shouldAlert && this.activeAlerts.has(rule.id)) {
          await this.resolveAlert(rule);
          this.activeAlerts.delete(rule.id);
        }
      } catch (error) {
        this.emit('error', new Error(`Alert rule evaluation failed for ${rule.id}: ${error}`));
      }
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<boolean> {
    const windowStart = Date.now() - rule.duration;
    const metrics = this.metricsCollector.getMetrics(rule.metric, new Date(windowStart));
    
    if (metrics.length === 0) {
      return false;
    }

    const latestValue = metrics[metrics.length - 1].value;
    
    switch (rule.operator) {
      case 'gt': return latestValue > rule.threshold;
      case 'gte': return latestValue >= rule.threshold;
      case 'lt': return latestValue < rule.threshold;
      case 'lte': return latestValue <= rule.threshold;
      case 'eq': return latestValue === rule.threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: AlertRule): Promise<void> {
    const alert = {
      id: rule.id,
      name: rule.name,
      severity: rule.severity,
      metric: rule.metric,
      threshold: rule.threshold,
      operator: rule.operator,
      timestamp: new Date(),
    };

    this.emit('alert', alert);

    for (const channelName of rule.channels) {
      const channel = this.channels.get(channelName);
      if (channel) {
        try {
          await channel.send(alert);
        } catch (error) {
          this.emit('error', new Error(`Alert channel ${channelName} failed: ${error}`));
        }
      }
    }
  }

  private async resolveAlert(rule: AlertRule): Promise<void> {
    const resolution = {
      id: rule.id,
      name: rule.name,
      timestamp: new Date(),
    };

    this.emit('alertResolved', resolution);

    for (const channelName of rule.channels) {
      const channel = this.channels.get(channelName);
      if (channel) {
        try {
          await channel.sendResolution(resolution);
        } catch (error) {
          this.emit('error', new Error(`Alert resolution channel ${channelName} failed: ${error}`));
        }
      }
    }
  }
}

export abstract class AlertChannel {
  abstract send(alert: any): Promise<void>;
  abstract sendResolution(resolution: any): Promise<void>;
}

export class ConsoleAlertChannel extends AlertChannel {
  async send(alert: any): Promise<void> {
    console.warn(`🚨 ALERT: ${alert.name} (${alert.severity}) - ${alert.metric} ${alert.operator} ${alert.threshold}`);
  }

  async sendResolution(resolution: any): Promise<void> {
    console.info(`✅ RESOLVED: ${resolution.name}`);
  }
}

// Comprehensive monitoring system
export class MonitoringSystem {
  public logger: Logger;
  public metrics: MetricsCollector;
  public health: HealthMonitor;
  public alerts: AlertManager;

  constructor(options: {
    logLevel?: LogLevel;
    component?: string;
    metricsRetention?: number;
    logTransports?: LogTransport[];
  } = {}) {
    // Initialize logger
    this.logger = new Logger(options.component ?? 'TaskSmith', {
      level: options.logLevel ?? LogLevel.INFO,
      transports: options.logTransports,
    });

    // Initialize metrics collector
    this.metrics = new MetricsCollector({
      retentionPeriod: options.metricsRetention ?? 24 * 60 * 60 * 1000,
      collectInterval: 60000, // 1 minute
    });

    // Initialize health monitor
    this.health = new HealthMonitor();

    // Initialize alert manager
    this.alerts = new AlertManager(this.metrics);

    // Set up default metrics collectors
    this.setupDefaultMetrics();

    // Set up default health checks
    this.setupDefaultHealthChecks();

    // Set up default alert rules
    this.setupDefaultAlerts();
  }

  public start(): void {
    this.metrics.startCollection(60000); // 1 minute
    this.health.startMonitoring(30000); // 30 seconds
    this.alerts.startMonitoring(10000); // 10 seconds
    
    this.logger.info('Monitoring system started');
  }

  public stop(): void {
    this.metrics.stopCollection();
    this.health.stopMonitoring();
    this.alerts.stopMonitoring();
    
    this.logger.info('Monitoring system stopped');
  }

  public getSystemStatus(): {
    healthy: boolean;
    uptime: number;
    performance: PerformanceMetrics;
    alerts: number;
    lastCheck: Date;
  } {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    return {
      healthy: true, // Calculate based on health checks
      uptime,
      performance: {
        requestCount: 0, // Get from metrics
        averageResponseTime: 0, // Get from metrics
        errorRate: 0, // Get from metrics
        throughput: 0, // Get from metrics
        memoryUsage: memUsage.heapUsed,
        cpuUsage: 0, // Get from metrics
      },
      alerts: this.alerts['activeAlerts'].size,
      lastCheck: new Date(),
    };
  }

  private setupDefaultMetrics(): void {
    this.metrics.registerCollector('memory_usage', new MemoryMetricCollector());
    this.metrics.registerCollector('cpu_usage', new CPUMetricCollector());
  }

  private setupDefaultHealthChecks(): void {
    this.health.registerCheck('memory_usage', new class extends HealthCheck {
      async check(): Promise<Record<string, any>> {
        const usage = process.memoryUsage();
        const heapPercent = (usage.heapUsed / usage.heapTotal) * 100;
        
        if (heapPercent > 90) {
          throw new Error(`High memory usage: ${heapPercent.toFixed(2)}%`);
        }
        
        return {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          heapPercent: parseFloat(heapPercent.toFixed(2)),
        };
      }
    });
  }

  private setupDefaultAlerts(): void {
    // High memory usage alert
    this.alerts.addRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      metric: 'memory_usage',
      operator: 'gt',
      threshold: 1024 * 1024 * 1024, // 1GB
      duration: 300000, // 5 minutes
      enabled: true,
      severity: 'high',
      channels: ['console'],
    });

    // High CPU usage alert
    this.alerts.addRule({
      id: 'high_cpu_usage',
      name: 'High CPU Usage',
      metric: 'cpu_usage',
      operator: 'gt',
      threshold: 80, // 80%
      duration: 300000, // 5 minutes
      enabled: true,
      severity: 'medium',
      channels: ['console'],
    });

    // Add console alert channel
    this.alerts.addChannel('console', new ConsoleAlertChannel());
  }
}

// Export the monitoring system for use in the application
export default MonitoringSystem;