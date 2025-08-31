Write-Host "Starting operation..."
Write-Error "Critical error occurred" -ErrorAction Continue
Write-Warning "Performance warning"
throw "Fatal exception occurred"