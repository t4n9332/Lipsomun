@echo off
chcp 65001 >nul
title ipsomun admin tool
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ipsomun-tool.ps1"
echo.
pause
