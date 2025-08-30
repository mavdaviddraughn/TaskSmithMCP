# PowerShell test runner script for Windows
param(
    [Parameter(Position=0)]
    [ValidateSet("crud", "git", "all", "watch", "shell")]
    [string]$Command = "all"
)

Write-Host "🧪 Running TaskSmith MCP Tests in Clean Environment" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

function Run-Test {
    param($TestName, $TestFile)
    
    Write-Host "🔄 Running $TestName..." -ForegroundColor Yellow
    
    # Create completely fresh container for each test
    $result = docker-compose -f docker-compose.test.yml run --rm test-runner npx vitest run $TestFile --reporter=verbose
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host "✅ $TestName passed" -ForegroundColor Green
    } else {
        Write-Host "❌ $TestName failed (exit code: $exitCode)" -ForegroundColor Red
        return $exitCode
    }
}

switch ($Command) {
    "crud" {
        Write-Host "Running CRUD operations tests..." -ForegroundColor Blue
        Run-Test "CRUD Operations" "test/script-crud.test.ts"
    }
    "git" {
        Write-Host "Running Git integration tests..." -ForegroundColor Blue  
        Run-Test "Git Integration" "test/git-integration.test.ts"
    }
    "all" {
        Write-Host "Running all tests..." -ForegroundColor Blue
        docker-compose -f docker-compose.test.yml run --rm test-runner npm test
    }
    "watch" {
        Write-Host "Starting test watcher..." -ForegroundColor Blue
        docker-compose -f docker-compose.test.yml up test-watch
    }
    "shell" {
        Write-Host "Opening test shell..." -ForegroundColor Blue
        docker-compose -f docker-compose.test.yml run --rm test-shell
    }
}

Write-Host ""
Write-Host "Usage Examples:" -ForegroundColor Cyan
Write-Host "  .\scripts\test.ps1 crud      # Test CRUD operations" -ForegroundColor White
Write-Host "  .\scripts\test.ps1 all       # Run full test suite" -ForegroundColor White  
Write-Host "  .\scripts\test.ps1 shell     # Debug test environment" -ForegroundColor White