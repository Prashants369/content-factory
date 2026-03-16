@echo off
REM ============================================================
REM  Factory Dashboard — Startup Script
REM  Launches ComfyUI, Agent Engine, and Next.js Dashboard
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo  ========================================
echo   AI Influencer Factory — Startup
echo  ========================================
echo.

REM Check if PowerShell is available
where powershell >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: PowerShell not found.
    pause
    exit /b 1
)

REM Forward all arguments to PowerShell script
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start_factory.ps1" %*

pause
