# Diagnostic script for Windows npm installation issues

Write-Host "=== NPM Global Installation Diagnostic ===" -ForegroundColor Cyan

# Check npm prefix
Write-Host "`nChecking npm global prefix..." -ForegroundColor Yellow
$npmPrefix = npm config get prefix
Write-Host "NPM Prefix: $npmPrefix" -ForegroundColor Green

# Check if npm global bin is in PATH
Write-Host "`nChecking if npm global bin is in PATH..." -ForegroundColor Yellow
$npmBin = Join-Path $npmPrefix "node_modules\.bin"
$envPath = $env:PATH -split ";"

if ($envPath -contains $npmBin -or $envPath -contains $npmPrefix) {
    Write-Host "✓ NPM global bin directory is in PATH" -ForegroundColor Green
} else {
    Write-Host "✗ NPM global bin directory is NOT in PATH" -ForegroundColor Red
    Write-Host "  You need to add the following to your PATH:" -ForegroundColor Yellow
    Write-Host "  $npmPrefix" -ForegroundColor Cyan
}

# Check if clanker is installed
Write-Host "`nChecking for clanker installation..." -ForegroundColor Yellow
$clankerCmd = Join-Path $npmPrefix "clanker.cmd"
$clankerPs1 = Join-Path $npmPrefix "clanker.ps1"
$clankerExe = Join-Path $npmPrefix "clanker"

if (Test-Path $clankerCmd) {
    Write-Host "✓ Found clanker.cmd at: $clankerCmd" -ForegroundColor Green
} else {
    Write-Host "✗ clanker.cmd not found" -ForegroundColor Red
}

if (Test-Path $clankerPs1) {
    Write-Host "✓ Found clanker.ps1 at: $clankerPs1" -ForegroundColor Green
} else {
    Write-Host "✗ clanker.ps1 not found" -ForegroundColor Red
}

# List all files in npm prefix
Write-Host "`nFiles in npm global directory:" -ForegroundColor Yellow
Get-ChildItem $npmPrefix -File | Select-Object -First 10 | ForEach-Object {
    Write-Host "  $_" -ForegroundColor Gray
}

# Check installed global packages
Write-Host "`nInstalled global npm packages:" -ForegroundColor Yellow
npm list -g --depth=0

# Instructions
Write-Host "`n=== Instructions ===" -ForegroundColor Cyan
Write-Host "If clanker command is not found, try these steps:" -ForegroundColor Yellow
Write-Host "1. Add npm global directory to PATH:"
Write-Host "   - Open System Properties > Environment Variables"
Write-Host "   - Add '$npmPrefix' to your PATH"
Write-Host "   - Restart PowerShell"
Write-Host ""
Write-Host "2. Or use the full path to run clanker:"
Write-Host "   $npmPrefix\clanker"
Write-Host ""
Write-Host "3. Or reinstall with --force flag:"
Write-Host "   npm install -g @ziggler/clanker --force"