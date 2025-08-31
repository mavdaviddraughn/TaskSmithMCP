# Production Deployment Guide for TaskSmith MCP

This comprehensive guide covers deploying TaskSmith MCP with the Run Output Management System in production environments.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Installation and Setup](#installation-and-setup)
4. [Configuration Management](#configuration-management)
5. [Security Configuration](#security-configuration)
6. [Performance Optimization](#performance-optimization)
7. [Monitoring and Observability](#monitoring-and-observability)
8. [High Availability Setup](#high-availability-setup)
9. [Scaling Considerations](#scaling-considerations)
10. [Backup and Recovery](#backup-and-recovery)
11. [Troubleshooting](#troubleshooting)
12. [Maintenance Procedures](#maintenance-procedures)

## System Requirements

### Minimum Requirements

- **CPU**: 2 vCPUs (4 vCPUs recommended)
- **Memory**: 4GB RAM (8GB recommended)
- **Storage**: 20GB available space (SSD recommended)
- **Network**: 1 Gbps network interface
- **OS**: Windows Server 2019+, Ubuntu 20.04+, CentOS 8+, or macOS 12+

### Recommended Production Requirements

- **CPU**: 4-8 vCPUs with high clock speed
- **Memory**: 16-32GB RAM for high-volume operations
- **Storage**: 100GB+ SSD with high IOPS (>3000 IOPS)
- **Network**: 10 Gbps for high-throughput scenarios
- **Load Balancer**: For multi-instance deployments

### Software Dependencies

```json
{
  "node": ">=18.0.0",
  "npm": ">=8.0.0",
  "git": ">=2.30.0",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zlib": "built-in",
    "fs": "built-in"
  }
}
```

## Pre-Deployment Checklist

### Infrastructure Readiness

- [ ] Server provisioned with adequate resources
- [ ] Network connectivity configured
- [ ] Firewall rules configured (ports 3000, 443, 80)
- [ ] SSL certificates obtained and installed
- [ ] DNS records configured
- [ ] Load balancer configured (if applicable)

### Security Readiness

- [ ] Service account created with minimal privileges
- [ ] Git repository access configured
- [ ] File system permissions set
- [ ] Security scanning completed
- [ ] Secrets management configured

### Monitoring Readiness

- [ ] Log aggregation system configured
- [ ] Metrics collection system set up
- [ ] Alert rules configured
- [ ] Health check endpoints tested
- [ ] Performance baseline established

## Installation and Setup

### Method 1: Production Docker Deployment

Create a production-ready Dockerfile:

```dockerfile
# Production Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS runtime

RUN addgroup -g 1001 -S tasksmith && \
    adduser -S tasksmith -u 1001 -G tasksmith

WORKDIR /app

# Install production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --chown=tasksmith:tasksmith . .

# Set up data directories
RUN mkdir -p /data/scripts /data/cache /data/logs && \
    chown -R tasksmith:tasksmith /data

USER tasksmith

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node --eval "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

CMD ["npm", "start"]
```

Docker Compose for production:

```yaml
version: '3.8'

services:
  tasksmith:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - CACHE_SIZE_MB=1024
      - MAX_BUFFER_SIZE_MB=512
      - GIT_REPO_PATH=/data/scripts
    volumes:
      - ./data/scripts:/data/scripts
      - ./data/cache:/data/cache
      - ./data/logs:/data/logs
      - ./config/production.json:/app/config/production.json:ro
    restart: unless-stopped
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    healthcheck:
      test: ["CMD", "npm", "run", "health-check"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  redis_data:
```

### Method 2: Direct Installation

```bash
# Create service user
sudo useradd -r -s /bin/false tasksmith

# Create directory structure
sudo mkdir -p /opt/tasksmith/{app,data,logs,config}
sudo chown -R tasksmith:tasksmith /opt/tasksmith

# Install application
cd /opt/tasksmith/app
sudo -u tasksmith git clone https://github.com/mavdaviddraughn/TaskSmithMCP.git .
sudo -u tasksmith npm ci --only=production

# Set up systemd service
sudo tee /etc/systemd/system/tasksmith.service > /dev/null << 'EOF'
[Unit]
Description=TaskSmith MCP Server
After=network.target
Wants=network.target

[Service]
Type=simple
User=tasksmith
Group=tasksmith
WorkingDirectory=/opt/tasksmith/app
Environment=NODE_ENV=production
Environment=CONFIG_PATH=/opt/tasksmith/config/production.json
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tasksmith

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/tasksmith/data /opt/tasksmith/logs
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tasksmith
```

## Configuration Management

### Production Configuration File

Create `/opt/tasksmith/config/production.json`:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 3000,
    "maxConnections": 100,
    "keepAliveTimeout": 30000,
    "headersTimeout": 40000
  },
  "outputManagement": {
    "bufferConfiguration": {
      "maxChunks": 50000,
      "maxBytes": 536870912,
      "maxLines": 100000,
      "retentionMode": "time",
      "retentionValue": 86400,
      "enableMetrics": true,
      "chunkIdPrefix": "prod"
    },
    "streamConfiguration": {
      "stdout": {
        "maxChunks": 25000,
        "maxBytes": 268435456
      },
      "stderr": {
        "maxChunks": 25000,
        "maxBytes": 268435456
      },
      "enableInterleaving": true,
      "errorDetectionPatterns": ["ERROR", "FATAL", "CRITICAL", "EXCEPTION"],
      "warningDetectionPatterns": ["WARN", "WARNING", "CAUTION", "DEPRECATED"]
    },
    "exportConfiguration": {
      "defaultFormat": "json",
      "compressionThreshold": 1048576,
      "maxExportSize": 1073741824,
      "tempDirectory": "/tmp/tasksmith-exports",
      "cleanupInterval": 3600000
    },
    "cacheConfiguration": {
      "maxItems": 10000,
      "maxMemoryMB": 512,
      "defaultTTL": 3600,
      "enableCompression": true,
      "compressionThreshold": 1024,
      "persistent": true,
      "persistentPath": "/opt/tasksmith/data/cache"
    }
  },
  "errorHandling": {
    "maxRetries": 3,
    "retryDelayMs": 1000,
    "exponentialBackoff": true,
    "fallbackStrategy": "degrade",
    "circuitBreakerThreshold": 10,
    "healthCheckInterval": 30000
  },
  "security": {
    "enableApiKeyAuth": true,
    "apiKeyHeader": "X-API-Key",
    "rateLimiting": {
      "windowMs": 900000,
      "maxRequests": 1000
    },
    "cors": {
      "origin": ["https://yourdomain.com"],
      "credentials": true
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "transports": [
      {
        "type": "file",
        "filename": "/opt/tasksmith/logs/application.log",
        "maxSize": "100m",
        "maxFiles": 10
      },
      {
        "type": "file",
        "filename": "/opt/tasksmith/logs/error.log",
        "level": "error",
        "maxSize": "100m",
        "maxFiles": 5
      }
    ]
  },
  "git": {
    "repositoryPath": "/opt/tasksmith/data/scripts",
    "autoCommit": true,
    "commitMessageTemplate": "feat: {action} script {scriptName}",
    "tagVersions": true,
    "pruneOldTags": false
  }
}
```

### Environment Variables

```bash
# Production environment variables
export NODE_ENV=production
export CONFIG_PATH=/opt/tasksmith/config/production.json
export LOG_LEVEL=info
export CACHE_SIZE_MB=512
export MAX_BUFFER_SIZE_MB=256
export API_KEY_SECRET=your-secure-api-key-secret
export DATABASE_URL=redis://localhost:6379
export GIT_REPO_PATH=/opt/tasksmith/data/scripts
export TEMP_DIR=/tmp/tasksmith
export MAX_CONCURRENT_OPERATIONS=10
```

### Configuration Validation

Create a configuration validation script:

```javascript
// scripts/validate-config.js
const fs = require('fs');
const path = require('path');

function validateConfiguration(configPath) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const errors = [];

    // Validate server configuration
    if (!config.server || !config.server.port) {
      errors.push('server.port is required');
    }

    // Validate output management
    if (!config.outputManagement?.bufferConfiguration?.maxBytes) {
      errors.push('outputManagement.bufferConfiguration.maxBytes is required');
    }

    // Validate security
    if (config.security?.enableApiKeyAuth && !process.env.API_KEY_SECRET) {
      errors.push('API_KEY_SECRET environment variable required when API key auth is enabled');
    }

    // Validate paths
    const requiredPaths = [
      config.git?.repositoryPath,
      config.outputManagement?.cacheConfiguration?.persistentPath,
      path.dirname(config.logging?.transports?.[0]?.filename || '')
    ].filter(Boolean);

    requiredPaths.forEach(dirPath => {
      if (!fs.existsSync(dirPath)) {
        errors.push(`Required directory does not exist: ${dirPath}`);
      }
    });

    if (errors.length > 0) {
      console.error('Configuration validation failed:');
      errors.forEach(error => console.error(`- ${error}`));
      process.exit(1);
    }

    console.log('Configuration validation passed ✓');
    return true;
  } catch (error) {
    console.error('Configuration validation error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  const configPath = process.argv[2] || '/opt/tasksmith/config/production.json';
  validateConfiguration(configPath);
}

module.exports = { validateConfiguration };
```

## Security Configuration

### API Authentication

```typescript
// Security middleware setup
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// API Key authentication
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || !validateApiKey(apiKey)) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};
```

### File System Security

```bash
# Set proper file permissions
sudo chown -R tasksmith:tasksmith /opt/tasksmith
sudo chmod -R 750 /opt/tasksmith
sudo chmod -R 640 /opt/tasksmith/config/*.json
sudo chmod -R 750 /opt/tasksmith/data
sudo chmod -R 640 /opt/tasksmith/logs

# SELinux context (if applicable)
sudo setsebool -P httpd_can_network_connect 1
sudo semanage fcontext -a -t httpd_exec_t "/opt/tasksmith/app/src/index.js"
sudo restorecon -R /opt/tasksmith
```

## Performance Optimization

### Memory Management

```javascript
// Memory optimization configuration
const outputBuffer = new OutputBuffer({
  maxChunks: 50000,
  maxBytes: 512 * 1024 * 1024, // 512MB
  retentionMode: 'time',
  retentionValue: 86400, // 24 hours
  enableMetrics: true
}, {
  realTime: true,
  batchSize: 1000,
  flushInterval: 5000,
  enableLineBuffering: true
});

// Cache configuration for production
const resultCache = new ResultCache({
  maxItems: 10000,
  maxMemoryMB: 1024,
  defaultTTL: 3600,
  enableCompression: true,
  compressionThreshold: 1024,
  persistent: true,
  persistentPath: '/opt/tasksmith/data/cache',
  cleanupInterval: 300000 // 5 minutes
});
```

### Node.js Optimization

```bash
# Node.js production flags
NODE_OPTIONS="--max-old-space-size=2048 --optimize-for-size"

# PM2 ecosystem file
module.exports = {
  apps: [{
    name: 'tasksmith',
    script: 'src/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      NODE_OPTIONS: '--max-old-space-size=2048'
    },
    max_memory_restart: '1G',
    min_uptime: '10s',
    max_restarts: 5,
    autorestart: true,
    watch: false,
    log_file: '/opt/tasksmith/logs/combined.log',
    out_file: '/opt/tasksmith/logs/out.log',
    error_file: '/opt/tasksmith/logs/error.log',
    merge_logs: true,
    time: true
  }]
};
```

### Database Optimization

```bash
# Redis configuration for production
# /etc/redis/redis.conf
maxmemory 1gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes
```

## Monitoring and Observability

### Health Check Endpoints

```typescript
// Health check implementation
import { Router } from 'express';
import { HealthChecker } from '../lib/error-handler';

const healthRouter = Router();
const healthChecker = new HealthChecker();

// Register health checks
healthChecker.registerCheck('database', async () => {
  // Check Redis connection
  return redis.ping() === 'PONG';
});

healthChecker.registerCheck('disk_space', async () => {
  const stats = await fs.statfs('/opt/tasksmith/data');
  const freeSpaceGB = (stats.free * stats.size) / (1024 * 1024 * 1024);
  return freeSpaceGB > 5; // At least 5GB free
});

healthChecker.registerCheck('memory_usage', async () => {
  const usage = process.memoryUsage();
  const usagePercent = usage.heapUsed / usage.heapTotal;
  return usagePercent < 0.9; // Less than 90% memory usage
});

// Health endpoints
healthRouter.get('/health', async (req, res) => {
  const status = await healthChecker.runAllChecks();
  res.status(status.healthy ? 200 : 503).json(status);
});

healthRouter.get('/health/live', (req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date() });
});

healthRouter.get('/health/ready', async (req, res) => {
  // Check if application is ready to serve requests
  const checks = await Promise.all([
    healthChecker.runAllChecks(),
    // Add startup checks
  ]);
  
  const ready = checks.every(check => check.healthy);
  res.status(ready ? 200 : 503).json({ ready, timestamp: new Date() });
});
```

### Prometheus Metrics

```typescript
// Metrics collection
import { register, Counter, Histogram, Gauge } from 'prom-client';

const metrics = {
  httpRequests: new Counter({
    name: 'tasksmith_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  scriptExecutions: new Counter({
    name: 'tasksmith_script_executions_total',
    help: 'Total number of script executions',
    labelNames: ['status', 'shell']
  }),
  
  bufferOperations: new Histogram({
    name: 'tasksmith_buffer_operation_duration_seconds',
    help: 'Duration of buffer operations',
    labelNames: ['operation'],
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  }),
  
  memoryUsage: new Gauge({
    name: 'tasksmith_memory_usage_bytes',
    help: 'Current memory usage',
    labelNames: ['type']
  }),
  
  cacheHitRate: new Gauge({
    name: 'tasksmith_cache_hit_rate',
    help: 'Cache hit rate percentage'
  })
};

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

## High Availability Setup

### Load Balancer Configuration (Nginx)

```nginx
upstream tasksmith_backend {
    least_conn;
    server 10.0.1.10:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:3000 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:3000 max_fails=3 fail_timeout=30s backup;
}

server {
    listen 443 ssl http2;
    server_name tasksmith.yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/tasksmith.crt;
    ssl_certificate_key /etc/ssl/private/tasksmith.key;
    
    location / {
        proxy_pass http://tasksmith_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    location /health {
        access_log off;
        proxy_pass http://tasksmith_backend/health;
        proxy_connect_timeout 5s;
        proxy_send_timeout 5s;
        proxy_read_timeout 5s;
    }
}
```

### Database High Availability

```yaml
# Redis Sentinel configuration
version: '3.8'

services:
  redis-master:
    image: redis:7-alpine
    command: redis-server --port 6379
    volumes:
      - redis_master_data:/data

  redis-replica-1:
    image: redis:7-alpine
    command: redis-server --port 6379 --replicaof redis-master 6379
    depends_on:
      - redis-master
    volumes:
      - redis_replica_1_data:/data

  redis-sentinel-1:
    image: redis:7-alpine
    command: redis-sentinel /etc/redis/sentinel.conf
    volumes:
      - ./sentinel.conf:/etc/redis/sentinel.conf
    depends_on:
      - redis-master
      - redis-replica-1

volumes:
  redis_master_data:
  redis_replica_1_data:
```

## Scaling Considerations

### Horizontal Scaling Strategy

1. **Stateless Design**: Ensure all application state is externalized
2. **Shared Storage**: Use distributed storage for git repositories
3. **Cache Distribution**: Implement Redis Cluster for cache scaling
4. **Load Balancing**: Deploy multiple instances behind load balancer

### Vertical Scaling Guidelines

| Load Level | CPU | Memory | Storage | Network |
|------------|-----|--------|---------|---------|
| Light      | 2 vCPU | 4GB | 50GB | 1 Gbps |
| Medium     | 4 vCPU | 8GB | 100GB | 1 Gbps |
| Heavy      | 8 vCPU | 16GB | 200GB | 10 Gbps |
| Enterprise | 16 vCPU | 32GB | 500GB | 10 Gbps |

### Auto-scaling Configuration

```yaml
# Kubernetes HPA
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: tasksmith-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: tasksmith
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Backup and Recovery

### Automated Backup Strategy

```bash
#!/bin/bash
# backup-tasksmith.sh

BACKUP_DIR="/backups/tasksmith"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="tasksmith_backup_${DATE}.tar.gz"

# Create backup directory
mkdir -p "${BACKUP_DIR}"

# Backup application data
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" \
    /opt/tasksmith/data \
    /opt/tasksmith/config \
    /opt/tasksmith/logs

# Backup database
redis-cli --rdb "${BACKUP_DIR}/redis_${DATE}.rdb"

# Clean old backups (keep 30 days)
find "${BACKUP_DIR}" -type f -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp "${BACKUP_DIR}/${BACKUP_FILE}" s3://your-backup-bucket/tasksmith/
```

### Recovery Procedures

```bash
#!/bin/bash
# restore-tasksmith.sh

BACKUP_FILE="$1"
RESTORE_DIR="/opt/tasksmith"

if [[ -z "$BACKUP_FILE" ]]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop service
systemctl stop tasksmith

# Create restore point
cp -r "${RESTORE_DIR}" "${RESTORE_DIR}_backup_$(date +%Y%m%d_%H%M%S)"

# Restore from backup
tar -xzf "${BACKUP_FILE}" -C /

# Fix permissions
chown -R tasksmith:tasksmith "${RESTORE_DIR}"

# Restart service
systemctl start tasksmith

echo "Restore completed. Check service status with: systemctl status tasksmith"
```

## Troubleshooting

### Common Issues and Solutions

#### High Memory Usage

```bash
# Check memory usage by component
ps aux --sort=-%mem | head -10
cat /proc/meminfo

# Check Node.js heap usage
curl http://localhost:3000/metrics | grep memory_usage

# Solutions:
# 1. Increase max heap size
export NODE_OPTIONS="--max-old-space-size=4096"

# 2. Reduce buffer sizes in configuration
# 3. Enable compression for cache
# 4. Implement aggressive cleanup policies
```

#### Performance Degradation

```bash
# Monitor performance metrics
curl http://localhost:3000/metrics | grep -E "(duration|rate)"

# Check disk I/O
iostat -x 1 5

# Check network performance
netstat -i

# Solutions:
# 1. Scale horizontally
# 2. Optimize buffer retention policies
# 3. Enable caching
# 4. Use SSD storage
```

#### Connection Issues

```bash
# Check listening ports
netstat -tlnp | grep :3000

# Check firewall
iptables -L -n

# Check load balancer health
curl -I http://localhost:3000/health

# Solutions:
# 1. Verify firewall rules
# 2. Check SSL certificate validity
# 3. Review load balancer configuration
# 4. Verify DNS resolution
```

### Debugging Commands

```bash
# Application logs
journalctl -u tasksmith -f
tail -f /opt/tasksmith/logs/application.log

# System resources
htop
iotop
iftop

# Network debugging
tcpdump -i any port 3000
ss -tulpn | grep :3000

# Database debugging
redis-cli monitor
redis-cli --latency-history -h localhost -p 6379
```

## Maintenance Procedures

### Regular Maintenance Tasks

#### Daily

```bash
# Check service status
systemctl status tasksmith

# Monitor disk space
df -h /opt/tasksmith

# Check error rates
grep -c "ERROR" /opt/tasksmith/logs/error.log
```

#### Weekly

```bash
# Rotate logs
logrotate /etc/logrotate.d/tasksmith

# Clean temporary files
find /tmp/tasksmith-* -type f -mtime +7 -delete

# Update dependencies (test environment first)
npm audit
```

#### Monthly

```bash
# Full system backup
/opt/tasksmith/scripts/backup-tasksmith.sh

# Performance review
# - Analyze metrics trends
# - Review error rates
# - Check capacity utilization

# Security updates
# - Update OS packages
# - Review security logs
# - Update SSL certificates
```

### Emergency Procedures

#### Service Recovery

```bash
# Quick restart
systemctl restart tasksmith

# Emergency rollback
systemctl stop tasksmith
mv /opt/tasksmith/app /opt/tasksmith/app_failed
mv /opt/tasksmith/app_backup /opt/tasksmith/app
systemctl start tasksmith
```

#### Database Recovery

```bash
# Redis recovery
systemctl stop redis
redis-server --dbfilename backup.rdb --dir /backups/redis
systemctl start redis
```

This deployment guide provides comprehensive coverage of production deployment considerations for TaskSmith MCP with the Run Output Management System. Regular updates should be made based on operational experience and changing requirements.