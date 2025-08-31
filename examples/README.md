# Output Management Examples

This directory contains CLI integration examples for TaskSmith's Output Management System.

## Available Examples

### PowerShell (Windows)
```powershell
.\output-examples.ps1 -Example basic
.\output-examples.ps1 -Example monitoring
.\output-examples.ps1 -Example debugging
.\output-examples.ps1 -Example export
.\output-examples.ps1 -Example performance
```

### Bash (Linux/macOS)
```bash
./output-examples.sh basic
./output-examples.sh monitoring
./output-examples.sh debugging
./output-examples.sh export
./output-examples.sh performance
```

### CMD (Windows)
```cmd
output-examples.cmd basic
output-examples.cmd monitoring
output-examples.cmd debugging
output-examples.cmd export
output-examples.cmd performance
```

## Configuration Types

| Configuration | Use Case | Max Lines | Memory | Progress | Caching | Export |
|--------------|----------|-----------|---------|----------|---------|---------|
| **basic** | Simple script execution | 500 | 0.5 MB | spinner | No | No |
| **monitoring** | Performance tracking | 2000 | 2.0 MB | bar | Yes | No |
| **debugging** | Error analysis | 5000 | 10.0 MB | dots | Yes | No |
| **export** | Report generation | 1000 | 1.0 MB | spinner | Yes | html |
| **performance** | High-volume processing | 10000 | 20.0 MB | bar | Yes | No |

## Real-World Scenarios

### CI/CD Pipeline
- **Configuration**: monitoring
- **Scripts**: `npm run test`, `docker build .`, `kubectl apply -f deployment.yaml`
- **Features**: Progress tracking, performance metrics, error detection

### Data Processing
- **Configuration**: performance
- **Scripts**: `python process_data.py`, `spark-submit`, `hadoop jar`
- **Features**: High memory limits, compression, minimal formatting overhead

### Debugging & Troubleshooting
- **Configuration**: debugging
- **Scripts**: `systemctl status myservice`, `docker logs container`, `tail -f /var/log/app.log`
- **Features**: Comprehensive error patterns, long retention, persistent caching

### Report Generation
- **Configuration**: export
- **Scripts**: `pytest --html=report.html`, `npm audit --json`, `terraform plan`
- **Features**: HTML export, metadata inclusion, clean formatting

## Quick Integration

### Node.js/TypeScript
```typescript
import { TaskManager } from './lib/task-manager';

const taskManager = new TaskManager();
const result = await taskManager.runScript({
  name: 'my-script',
  args: ['arg1', 'arg2']
}, {
  streaming: {
    stdout: { maxLines: 1000, retentionMs: 60000, maxMemoryBytes: 1024 * 1024 },
    stderr: { maxLines: 500, retentionMs: 30000, maxMemoryBytes: 512 * 1024 },
    errorPatterns: ['error:', 'fail'],
    warningPatterns: ['warn:', 'warning']
  },
  progress: {
    enabled: true,
    style: 'bar',
    updateIntervalMs: 100,
    showETA: true,
    showPhase: true
  }
});
```

### PowerShell MCP Call
```powershell
$config = @{
  streaming = @{
    stdout = @{ maxLines = 1000; retentionMs = 60000; maxMemoryBytes = 1048576 }
    stderr = @{ maxLines = 500; retentionMs = 30000; maxMemoryBytes = 524288 }
    errorPatterns = @('error:', 'fail')
    warningPatterns = @('warn:', 'warning')
  }
} | ConvertTo-Json -Depth 5

$result = Invoke-McpTool -Tool "runScript" -Parameters @{
    name = "my-script"
    outputOptions = $config
}
```

### cURL REST API
```bash
curl -X POST http://localhost:3000/mcp/runScript \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-script",
    "outputOptions": {
      "streaming": {
        "stdout": {"maxLines": 1000, "retentionMs": 60000, "maxMemoryBytes": 1048576},
        "stderr": {"maxLines": 500, "retentionMs": 30000, "maxMemoryBytes": 524288},
        "errorPatterns": ["error:", "fail"],
        "warningPatterns": ["warn:", "warning"]
      },
      "progress": {"enabled": true, "style": "bar", "updateIntervalMs": 100, "showETA": true, "showPhase": true}
    }
  }'
```

## Performance Tips

### Memory Optimization
- Set `maxLines` based on expected output volume
- Use shorter `retentionMs` for high-frequency scripts
- Enable `compression` for long-running processes
- Monitor memory usage through metrics APIs

### Processing Speed
- Increase `updateIntervalMs` for less frequent updates
- Use `silent` progress style for batch jobs
- Disable `syntaxHighlighting` for large outputs
- Use `none` color scheme to reduce processing overhead

### Filtering Efficiency
- Use specific error patterns to reduce false positives
- Configure appropriate log levels to filter noise
- Use `excludeKeywords` to remove unwanted content
- Limit regex patterns to essential matches only

## Documentation

- [OUTPUT-MANAGEMENT.md](../docs/OUTPUT-MANAGEMENT.md) - Complete documentation
- [TypeScript Interfaces](../src/types/index.ts) - Interface definitions  
- [Integration Tests](../test/integration.test.ts) - Test examples
- [Task Manager](../src/lib/task-manager.ts) - Core implementation