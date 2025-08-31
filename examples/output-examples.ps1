#!/usr/bin/env pwsh
<#
.SYNOPSIS
    CLI integration examples for TaskSmith Output Management
    
.DESCRIPTION
    Demonstrates various output management configurations for different use cases
    
.PARAMETER Example
    Which example to run: basic, monitoring, debugging, export, performance
    
.EXAMPLE
    .\output-examples.ps1 -Example basic
    .\output-examples.ps1 -Example monitoring
#>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('basic', 'monitoring', 'debugging', 'export', 'performance')]
    [string]$Example
)

# Configuration for different scenarios
$OutputConfigs = @{
    
    # Basic streaming with minimal configuration
    'basic' = @{
        streaming = @{
            stdout = @{
                maxLines = 500
                retentionMs = 60000
                maxMemoryBytes = 512 * 1024
            }
            stderr = @{
                maxLines = 250
                retentionMs = 30000
                maxMemoryBytes = 256 * 1024
            }
            errorPatterns = @('error:', 'fail')
            warningPatterns = @('warn:', 'warning')
        }
        progress = @{
            enabled = $true
            style = 'spinner'
            updateIntervalMs = 100
            showETA = $false
            showPhase = $true
        }
    }
    
    # Performance monitoring with detailed metrics
    'monitoring' = @{
        streaming = @{
            stdout = @{
                maxLines = 2000
                retentionMs = 300000  # 5 minutes
                maxMemoryBytes = 2 * 1024 * 1024
            }
            stderr = @{
                maxLines = 1000
                retentionMs = 180000  # 3 minutes
                maxMemoryBytes = 1024 * 1024
            }
            errorPatterns = @('error', 'timeout', 'memory', 'cpu')
            warningPatterns = @('slow', 'performance', 'warn')
        }
        progress = @{
            enabled = $true
            style = 'bar'
            updateIntervalMs = 200
            showETA = $true
            showPhase = $true
        }
        formatting = @{
            colorScheme = 'dark'
            syntaxHighlighting = $true
            timestampFormat = 'elapsed'
            includeMetadata = $true
        }
        filtering = @{
            levels = @('info', 'warn', 'error')
            keywords = @('performance', 'memory', 'time')
        }
        caching = @{
            maxEntries = 20
            maxMemoryBytes = 5 * 1024 * 1024
            ttlMs = 300000
            compression = $true
            persistToDisk = $false
        }
    }
    
    # Debugging with comprehensive capture
    'debugging' = @{
        streaming = @{
            stdout = @{
                maxLines = 5000
                retentionMs = 600000  # 10 minutes
                maxMemoryBytes = 10 * 1024 * 1024
            }
            stderr = @{
                maxLines = 2000
                retentionMs = 600000
                maxMemoryBytes = 5 * 1024 * 1024
            }
            errorPatterns = @('error', 'exception', 'fail', 'fatal', 'assertion')
            warningPatterns = @('warn', 'warning', 'deprecated', 'caution')
        }
        progress = @{
            enabled = $true
            style = 'dots'
            updateIntervalMs = 500
            showETA = $true
            showPhase = $true
        }
        formatting = @{
            colorScheme = 'dark'
            syntaxHighlighting = $true
            timestampFormat = 'iso'
            includeMetadata = $true
        }
        filtering = @{
            levels = @('debug', 'info', 'warn', 'error')
            excludeKeywords = @('trace')
        }
        caching = @{
            maxEntries = 50
            maxMemoryBytes = 20 * 1024 * 1024
            ttlMs = 600000
            compression = $true
            persistToDisk = $true
        }
    }
    
    # Export-focused configuration
    'export' = @{
        streaming = @{
            stdout = @{
                maxLines = 1000
                retentionMs = 120000
                maxMemoryBytes = 1024 * 1024
            }
            stderr = @{
                maxLines = 500
                retentionMs = 60000
                maxMemoryBytes = 512 * 1024
            }
            errorPatterns = @('error:', 'fail')
            warningPatterns = @('warn:', 'warning')
        }
        formatting = @{
            colorScheme = 'none'
            syntaxHighlighting = $false
            timestampFormat = 'iso'
            includeMetadata = $true
        }
        export = @{
            format = 'html'
            includeMetadata = $true
            compress = $false
            streaming = $false
        }
        caching = @{
            maxEntries = 30
            maxMemoryBytes = 10 * 1024 * 1024
            ttlMs = 300000
            compression = $false
            persistToDisk = $true
        }
    }
    
    # High-performance configuration for large outputs
    'performance' = @{
        streaming = @{
            stdout = @{
                maxLines = 10000
                retentionMs = 180000
                maxMemoryBytes = 20 * 1024 * 1024
            }
            stderr = @{
                maxLines = 2000
                retentionMs = 90000
                maxMemoryBytes = 5 * 1024 * 1024
            }
            errorPatterns = @('error', 'fail', 'exception')
            warningPatterns = @('warn', 'slow')
        }
        progress = @{
            enabled = $true
            style = 'bar'
            updateIntervalMs = 1000  # Less frequent updates
            showETA = $true
            showPhase = $false
        }
        formatting = @{
            colorScheme = 'none'
            syntaxHighlighting = $false
            timestampFormat = 'none'
            includeMetadata = $false
        }
        caching = @{
            maxEntries = 100
            maxMemoryBytes = 100 * 1024 * 1024
            ttlMs = 600000
            compression = $true
            persistToDisk = $true
        }
    }
}

function Show-ConfigExample {
    param($ConfigName, $Config)
    
    Write-Host "`n=== $ConfigName Configuration Example ===" -ForegroundColor Cyan
    Write-Host "Use case: $(Get-UseCase $ConfigName)" -ForegroundColor Green
    Write-Host "`nConfiguration JSON:" -ForegroundColor Yellow
    
    $JsonConfig = $Config | ConvertTo-Json -Depth 5
    Write-Host $JsonConfig
    
    Write-Host "`nNode.js/TypeScript Usage:" -ForegroundColor Yellow
    Write-Host @"
const result = await taskManager.runScript({
  name: 'my-script',
  args: ['arg1', 'arg2']
}, $JsonConfig);
"@

    Write-Host "`nPowerShell MCP Call:" -ForegroundColor Yellow
    Write-Host @"
`$outputOptions = '$($JsonConfig -replace "'", "''")' 
`$result = Invoke-McpTool -Tool "runScript" -Parameters @{
    name = "my-script"
    args = @("arg1", "arg2")
    outputOptions = `$outputOptions
}
"@

    Write-Host "`nCURL Example:" -ForegroundColor Yellow
    $curlJson = $JsonConfig -replace '"', '\"'
    Write-Host @"
curl -X POST http://localhost:3000/mcp/runScript \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-script",
    "args": ["arg1", "arg2"],
    "outputOptions": $curlJson
  }'
"@
}

function Get-UseCase {
    param($ConfigName)
    
    switch ($ConfigName) {
        'basic' { 'Simple script execution with basic streaming and progress' }
        'monitoring' { 'Performance monitoring and resource tracking' }
        'debugging' { 'Comprehensive error analysis and troubleshooting' }
        'export' { 'Output capture for reporting and documentation' }
        'performance' { 'High-volume output processing with optimization' }
    }
}

function Show-ComparisonTable {
    Write-Host "`n=== Configuration Comparison ===" -ForegroundColor Cyan
    
    $table = @()
    foreach ($configName in $OutputConfigs.Keys) {
        $config = $OutputConfigs[$configName]
        $row = [PSCustomObject]@{
            Configuration = $configName
            'Max Stdout Lines' = $config.streaming.stdout.maxLines
            'Retention (min)' = [math]::Round($config.streaming.stdout.retentionMs / 60000, 1)
            'Memory Limit (MB)' = [math]::Round($config.streaming.stdout.maxMemoryBytes / (1024*1024), 1)
            'Progress Style' = $config.progress.style
            'Caching' = if ($config.caching) { "Yes" } else { "No" }
            'Export' = if ($config.export) { $config.export.format } else { "No" }
        }
        $table += $row
    }
    
    $table | Format-Table -AutoSize
}

function Show-ScenarioExamples {
    Write-Host "`n=== Real-World Scenario Examples ===" -ForegroundColor Cyan
    
    @{
        'CI/CD Pipeline' = @{
            description = 'Continuous integration with test reporting'
            config = 'monitoring'
            script_examples = @(
                'npm run test',
                'docker build .',
                'kubectl apply -f deployment.yaml'
            )
        }
        'Data Processing' = @{
            description = 'Large dataset processing with progress tracking'
            config = 'performance'
            script_examples = @(
                'python process_data.py --input large_dataset.csv',
                'spark-submit --class MainApp data_processor.jar',
                'hadoop jar mapreduce.jar input/ output/'
            )
        }
        'Debugging & Troubleshooting' = @{
            description = 'Problem diagnosis with comprehensive logging'
            config = 'debugging'
            script_examples = @(
                'systemctl status myservice',
                'docker logs container_name',
                'tail -f /var/log/application.log'
            )
        }
        'Report Generation' = @{
            description = 'Creating formatted reports for documentation'
            config = 'export'
            script_examples = @(
                'pytest --html=report.html',
                'npm audit --json > security_report.json',
                'terraform plan -out=plan.tfplan'
            )
        }
    } | ForEach-Object {
        $scenarioName = $_.Key
        $scenario = $_.Value
        
        Write-Host "`n--- $scenarioName ---" -ForegroundColor Green
        Write-Host "Description: $($scenario.description)"
        Write-Host "Recommended Config: $($scenario.config)"
        Write-Host "Example Scripts:"
        $scenario.script_examples | ForEach-Object { Write-Host "  • $_" }
    }
}

function Show-PerformanceTips {
    Write-Host "`n=== Performance Optimization Tips ===" -ForegroundColor Cyan
    
    $tips = @(
        @{
            Category = 'Memory Management'
            Tips = @(
                'Set maxLines based on expected output volume',
                'Use shorter retentionMs for high-frequency scripts',
                'Enable compression for long-running processes',
                'Monitor memory usage through metrics APIs'
            )
        },
        @{
            Category = 'Processing Speed'
            Tips = @(
                'Increase updateIntervalMs for less frequent updates',
                'Use "silent" progress style for batch jobs',
                'Disable syntax highlighting for large outputs',
                'Use "none" color scheme to reduce processing'
            )
        },
        @{
            Category = 'Filtering Efficiency'
            Tips = @(
                'Use specific error patterns to reduce false positives',
                'Configure appropriate log levels to filter noise',
                'Use excludeKeywords to remove unwanted content',
                'Limit regex patterns to essential matches only'
            )
        },
        @{
            Category = 'Caching Strategy'
            Tips = @(
                'Enable compression for frequently accessed results',
                'Set appropriate TTL based on data freshness needs',
                'Use persistToDisk for long-term result storage',
                'Monitor cache hit rates and adjust maxEntries'
            )
        }
    )
    
    foreach ($category in $tips) {
        Write-Host "`n$($category.Category):" -ForegroundColor Yellow
        $category.Tips | ForEach-Object { Write-Host "  • $_" }
    }
}

# Main execution logic
Write-Host "TaskSmith Output Management CLI Examples" -ForegroundColor Magenta
Write-Host "=======================================" -ForegroundColor Magenta

switch ($Example) {
    'basic' { 
        Show-ConfigExample 'Basic' $OutputConfigs['basic']
    }
    'monitoring' { 
        Show-ConfigExample 'Monitoring' $OutputConfigs['monitoring']
    }
    'debugging' { 
        Show-ConfigExample 'Debugging' $OutputConfigs['debugging']
    }
    'export' { 
        Show-ConfigExample 'Export' $OutputConfigs['export']
    }
    'performance' { 
        Show-ConfigExample 'Performance' $OutputConfigs['performance']
    }
}

# Always show additional helpful information
Show-ComparisonTable
Show-ScenarioExamples  
Show-PerformanceTips

Write-Host "`n=== Quick Start Commands ===" -ForegroundColor Cyan
Write-Host "Run different examples:" -ForegroundColor Yellow
@('basic', 'monitoring', 'debugging', 'export', 'performance') | ForEach-Object {
    Write-Host "  .\output-examples.ps1 -Example $_"
}

Write-Host "`nFor more information, see:" -ForegroundColor Green
Write-Host "  • docs/OUTPUT-MANAGEMENT.md - Complete documentation"
Write-Host "  • src/types/index.ts - TypeScript interface definitions"
Write-Host "  • test/integration.test.ts - Integration test examples"