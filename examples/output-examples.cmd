@echo off
REM TaskSmith Output Management CLI Examples for Windows CMD
REM Usage: output-examples.cmd <example_type>
REM Examples: basic, monitoring, debugging, export, performance

setlocal enabledelayedexpansion

set EXAMPLE_TYPE=%1
if "%EXAMPLE_TYPE%"=="" set EXAMPLE_TYPE=basic

echo TaskSmith Output Management CLI Examples
echo =======================================

if "%EXAMPLE_TYPE%"=="basic" goto basic
if "%EXAMPLE_TYPE%"=="monitoring" goto monitoring
if "%EXAMPLE_TYPE%"=="debugging" goto debugging
if "%EXAMPLE_TYPE%"=="export" goto export
if "%EXAMPLE_TYPE%"=="performance" goto performance

echo Invalid example type: %EXAMPLE_TYPE%
echo Valid options: basic, monitoring, debugging, export, performance
exit /b 1

:basic
echo.
echo === Basic Configuration Example ===
echo Use case: Simple script execution with basic streaming and progress
echo.
echo Configuration JSON:
echo {
echo   "streaming": {
echo     "stdout": {
echo       "maxLines": 500,
echo       "retentionMs": 60000,
echo       "maxMemoryBytes": 524288
echo     },
echo     "stderr": {
echo       "maxLines": 250,
echo       "retentionMs": 30000,
echo       "maxMemoryBytes": 262144
echo     },
echo     "errorPatterns": ["error:", "fail"],
echo     "warningPatterns": ["warn:", "warning"]
echo   },
echo   "progress": {
echo     "enabled": true,
echo     "style": "spinner",
echo     "updateIntervalMs": 100,
echo     "showETA": false,
echo     "showPhase": true
echo   }
echo }
goto usage_examples

:monitoring
echo.
echo === Performance Monitoring Configuration ===
echo Use case: Performance monitoring and resource tracking
echo.
echo Configuration JSON:
echo {
echo   "streaming": {
echo     "stdout": {
echo       "maxLines": 2000,
echo       "retentionMs": 300000,
echo       "maxMemoryBytes": 2097152
echo     },
echo     "stderr": {
echo       "maxLines": 1000,
echo       "retentionMs": 180000,
echo       "maxMemoryBytes": 1048576
echo     },
echo     "errorPatterns": ["error", "timeout", "memory", "cpu"],
echo     "warningPatterns": ["slow", "performance", "warn"]
echo   },
echo   "progress": {
echo     "enabled": true,
echo     "style": "bar",
echo     "updateIntervalMs": 200,
echo     "showETA": true,
echo     "showPhase": true
echo   },
echo   "formatting": {
echo     "colorScheme": "dark",
echo     "syntaxHighlighting": true,
echo     "timestampFormat": "elapsed",
echo     "includeMetadata": true
echo   },
echo   "filtering": {
echo     "levels": ["info", "warn", "error"],
echo     "keywords": ["performance", "memory", "time"]
echo   },
echo   "caching": {
echo     "maxEntries": 20,
echo     "maxMemoryBytes": 5242880,
echo     "ttlMs": 300000,
echo     "compression": true,
echo     "persistToDisk": false
echo   }
echo }
goto usage_examples

:debugging
echo.
echo === Debugging Configuration ===
echo Use case: Comprehensive error analysis and troubleshooting
echo.
echo Configuration JSON:
echo {
echo   "streaming": {
echo     "stdout": {
echo       "maxLines": 5000,
echo       "retentionMs": 600000,
echo       "maxMemoryBytes": 10485760
echo     },
echo     "stderr": {
echo       "maxLines": 2000,
echo       "retentionMs": 600000,
echo       "maxMemoryBytes": 5242880
echo     },
echo     "errorPatterns": ["error", "exception", "fail", "fatal", "assertion"],
echo     "warningPatterns": ["warn", "warning", "deprecated", "caution"]
echo   },
echo   "progress": {
echo     "enabled": true,
echo     "style": "dots",
echo     "updateIntervalMs": 500,
echo     "showETA": true,
echo     "showPhase": true
echo   },
echo   "formatting": {
echo     "colorScheme": "dark",
echo     "syntaxHighlighting": true,
echo     "timestampFormat": "iso",
echo     "includeMetadata": true
echo   },
echo   "filtering": {
echo     "levels": ["debug", "info", "warn", "error"],
echo     "excludeKeywords": ["trace"]
echo   },
echo   "caching": {
echo     "maxEntries": 50,
echo     "maxMemoryBytes": 20971520,
echo     "ttlMs": 600000,
echo     "compression": true,
echo     "persistToDisk": true
echo   }
echo }
goto usage_examples

:export
echo.
echo === Export Configuration ===
echo Use case: Output capture for reporting and documentation
echo.
echo Configuration JSON:
echo {
echo   "streaming": {
echo     "stdout": {
echo       "maxLines": 1000,
echo       "retentionMs": 120000,
echo       "maxMemoryBytes": 1048576
echo     },
echo     "stderr": {
echo       "maxLines": 500,
echo       "retentionMs": 60000,
echo       "maxMemoryBytes": 524288
echo     },
echo     "errorPatterns": ["error:", "fail"],
echo     "warningPatterns": ["warn:", "warning"]
echo   },
echo   "formatting": {
echo     "colorScheme": "none",
echo     "syntaxHighlighting": false,
echo     "timestampFormat": "iso",
echo     "includeMetadata": true
echo   },
echo   "export": {
echo     "format": "html",
echo     "includeMetadata": true,
echo     "compress": false,
echo     "streaming": false
echo   },
echo   "caching": {
echo     "maxEntries": 30,
echo     "maxMemoryBytes": 10485760,
echo     "ttlMs": 300000,
echo     "compression": false,
echo     "persistToDisk": true
echo   }
echo }
goto usage_examples

:performance
echo.
echo === High-Performance Configuration ===
echo Use case: High-volume output processing with optimization
echo.
echo Configuration JSON:
echo {
echo   "streaming": {
echo     "stdout": {
echo       "maxLines": 10000,
echo       "retentionMs": 180000,
echo       "maxMemoryBytes": 20971520
echo     },
echo     "stderr": {
echo       "maxLines": 2000,
echo       "retentionMs": 90000,
echo       "maxMemoryBytes": 5242880
echo     },
echo     "errorPatterns": ["error", "fail", "exception"],
echo     "warningPatterns": ["warn", "slow"]
echo   },
echo   "progress": {
echo     "enabled": true,
echo     "style": "bar",
echo     "updateIntervalMs": 1000,
echo     "showETA": true,
echo     "showPhase": false
echo   },
echo   "formatting": {
echo     "colorScheme": "none",
echo     "syntaxHighlighting": false,
echo     "timestampFormat": "none",
echo     "includeMetadata": false
echo   },
echo   "caching": {
echo     "maxEntries": 100,
echo     "maxMemoryBytes": 104857600,
echo     "ttlMs": 600000,
echo     "compression": true,
echo     "persistToDisk": true
echo   }
echo }
goto usage_examples

:usage_examples
echo.
echo PowerShell Usage:
echo $outputOptions = 'CONFIG_JSON_HERE'
echo $result = Invoke-McpTool -Tool "runScript" -Parameters @{
echo     name = "my-script"
echo     args = @("arg1", "arg2")
echo     outputOptions = $outputOptions
echo }
echo.
echo cURL Example:
echo curl -X POST http://localhost:3000/mcp/runScript ^
echo   -H "Content-Type: application/json" ^
echo   -d "{ \"name\": \"my-script\", \"args\": [\"arg1\", \"arg2\"], \"outputOptions\": CONFIG_JSON_HERE }"

:show_additional_info
echo.
echo === Configuration Comparison ===
echo Config       Max Lines  Retention   Memory     Progress  Cache   Export
echo ----------   ---------  ----------  ---------  --------  ------  ------
echo basic        500        1.0 min     0.5 MB     spinner   No      No
echo monitoring   2000       5.0 min     2.0 MB     bar       Yes     No
echo debugging    5000       10.0 min    10.0 MB    dots      Yes     No
echo export       1000       2.0 min     1.0 MB     spinner   Yes     html
echo performance  10000      3.0 min     20.0 MB    bar       Yes     No

echo.
echo === Real-World Scenario Examples ===
echo.
echo CI/CD Pipeline:
echo   Description: Continuous integration with test reporting
echo   Recommended Config: monitoring
echo   Example Scripts: npm run test, docker build ., kubectl apply
echo.
echo Data Processing:
echo   Description: Large dataset processing with progress tracking
echo   Recommended Config: performance
echo   Example Scripts: python process_data.py, spark-submit, hadoop jar
echo.
echo Debugging ^& Troubleshooting:
echo   Description: Problem diagnosis with comprehensive logging
echo   Recommended Config: debugging
echo   Example Scripts: systemctl status, docker logs, tail -f
echo.
echo Report Generation:
echo   Description: Creating formatted reports for documentation
echo   Recommended Config: export
echo   Example Scripts: pytest --html, npm audit --json, terraform plan

echo.
echo === Performance Optimization Tips ===
echo.
echo Memory Management:
echo   • Set maxLines based on expected output volume
echo   • Use shorter retentionMs for high-frequency scripts
echo   • Enable compression for long-running processes
echo   • Monitor memory usage through metrics APIs
echo.
echo Processing Speed:
echo   • Increase updateIntervalMs for less frequent updates
echo   • Use 'silent' progress style for batch jobs
echo   • Disable syntax highlighting for large outputs
echo   • Use 'none' color scheme to reduce processing
echo.
echo Filtering Efficiency:
echo   • Use specific error patterns to reduce false positives
echo   • Configure appropriate log levels to filter noise
echo   • Use excludeKeywords to remove unwanted content
echo   • Limit regex patterns to essential matches only

echo.
echo === Quick Start Commands ===
echo Run different examples:
echo   output-examples.cmd basic
echo   output-examples.cmd monitoring  
echo   output-examples.cmd debugging
echo   output-examples.cmd export
echo   output-examples.cmd performance
echo.
echo For more information, see:
echo   • docs\OUTPUT-MANAGEMENT.md - Complete documentation
echo   • src\types\index.ts - TypeScript interface definitions
echo   • test\integration.test.ts - Integration test examples

endlocal