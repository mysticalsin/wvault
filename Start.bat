@echo off
cd /d "%~dp0"
echo Killing old processes...
taskkill /F /IM "WVault.exe" /T >nul 2>&1
taskkill /F /IM "electron.exe" /T >nul 2>&1
taskkill /F /IM "node.exe" /T >nul 2>&1

echo Starting WVault in DEV MODE (Live Code)...
echo This will open a console window - please leave it open!
npm run dev
pause
