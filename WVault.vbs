Set WshShell = CreateObject("WScript.Shell")
' Run electron directly from node_modules to avoid npm overhead and console
' quoting path handles spaces
strCmd = chr(34) & "node_modules\electron\dist\electron.exe" & chr(34) & " ."
WshShell.Run strCmd, 0, False
Set WshShell = Nothing
