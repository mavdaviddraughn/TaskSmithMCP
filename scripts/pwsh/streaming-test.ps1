# Test script with various outputs
Write-Host "Starting test..."
Write-Output "Standard output line 1"
Write-Output "Standard output line 2"
Write-Error "Test error message" -ErrorAction Continue
Write-Warning "Test warning message"
Write-Host "Test completed"