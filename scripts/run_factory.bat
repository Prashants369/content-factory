@echo off
echo ============================================
echo MIRA PATEL - PRODUCTION FACTORY
echo ============================================
echo.
echo Options:
echo   1. Daily generation (1 image)
echo   2. Weekly batch (7 images)
echo   3. Continuous mode (every 3 hours)
echo   4. Test mode (1 image, no post)
echo.
set /p choice="Select option (1-4): "

cd /d "Z:\automation\factory-dashboard"

if "%choice%"=="1" (
    echo Running daily generation...
    python production_batch.py --mode daily
) else if "%choice%"=="2" (
    echo Running weekly batch (7 images)...
    python production_batch.py --mode batch --count 7
) else if "%choice%"=="3" (
    echo Starting continuous mode (Ctrl+C to stop)...
    python production_batch.py --mode continuous --interval 180
) else if "%choice%"=="4" (
    echo Running test mode...
    python production_batch.py --mode single --skip-post
) else (
    echo Invalid choice
)

pause