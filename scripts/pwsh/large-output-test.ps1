# Generate substantial output
for ($i = 1; $i -le 50; $i++) {
  $data = 'A' * 1000
  Write-Host "Line $i: $data"
}