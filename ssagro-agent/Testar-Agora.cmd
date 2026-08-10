@echo off
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Radasa-SSAgro-Agent.ps1" -RunOnce
pause
