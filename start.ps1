# Aether Studio PowerShell Launcher
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
node (Join-Path $ScriptDir "start.js")
