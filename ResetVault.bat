@echo off
echo Resetting WVault...

taskkill /F /IM "WVault.exe" /T >nul 2>&1
taskkill /F /IM "electron.exe" /T >nul 2>&1
timeout /t 2 /nobreak >nul

if exist "%APPDATA%\WVault\wvault.vault" (
    del /f /q "%APPDATA%\WVault\wvault.vault"
    echo Vault file deleted.
)
if exist "%APPDATA%\WVault\wvault.db" (
    del /f /q "%APPDATA%\WVault\wvault.db"
    echo Legacy DB deleted.
)

rem Also clean up old GlassVault paths if they exist (migration support)
if exist "%APPDATA%\glassvault\glassvault.vault" (
    del /f /q "%APPDATA%\glassvault\glassvault.vault"
    echo Old GlassVault vault file deleted.
)
if exist "%APPDATA%\glassvault\glassvault.db" (
    del /f /q "%APPDATA%\glassvault\glassvault.db"
    echo Old GlassVault DB deleted.
)

echo Reset complete. You can now open Start.bat to create a new vault.
pause
