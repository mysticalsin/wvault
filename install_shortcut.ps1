$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = $WshShell.SpecialFolders.Item("Desktop")
$ShortcutPath = "$DesktopPath\WVault.lnk"

# Clean up existing shortcuts
if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath -Force }

# Create new silent shortcut
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "wscript.exe"
$Shortcut.Arguments = """$PSScriptRoot\WVault.vbs"""
$Shortcut.WorkingDirectory = "$PSScriptRoot"
$Shortcut.IconLocation = "$PSScriptRoot\resources\icon.ico"
$Shortcut.Save()

Write-Host "Cleaned old shortcuts."
Write-Host "Created new silent shortcut: WVault.lnk"
