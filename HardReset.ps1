Write-Host "--- WVAULT HARD RESET ---" -ForegroundColor Cyan

# 1. Kill Processes
Write-Host "Killing processes..."
Stop-Process -Name "WVault" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "electron" -Force -ErrorAction SilentlyContinue
Stop-Process -Name "node" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# 2. Define Paths
$paths = @(
    "$env:APPDATA\glassvault",
    "$env:APPDATA\WVault",
    "$env:APPDATA\Electron"
)

# 3. Delete Data
foreach ($p in $paths) {
    if (Test-Path $p) {
        Write-Host "Removing: $p" -ForegroundColor Yellow
        Remove-Item -Path $p -Recurse -Force -ErrorAction Continue
    }
    else {
        Write-Host "Not found: $p" -ForegroundColor Gray
    }
}

# 4. Verify
Write-Host "Verifying deletion..."
foreach ($p in $paths) {
    if (Test-Path "$p\glassvault.vault") {
        Write-Host "ERROR: Vault file still exists in $p" -ForegroundColor Red
        exit 1
    }
}

Write-Host "--- RESET COMPLETE ---" -ForegroundColor Green
Write-Host "Starting App..."

# 5. Start App
$exePath = "dist_electron\win-unpacked\WVault.exe"
if (Test-Path $exePath) {
    Start-Process $exePath
}
else {
    npm run dev
}
