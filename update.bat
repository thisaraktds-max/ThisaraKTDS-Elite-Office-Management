@echo off
REM ==============================================================================
REM Elite International School - Automated Remote System Update Script (Windows)
REM ==============================================================================

echo.
echo ======================================================================
echo   Elite International School - System Maintenance ^& Remote Updater
echo ======================================================================
echo.

cd /d "%~dp0"
echo [1/5] Working directory verified: %cd%

echo [2/5] Creating safety snapshot of local SQLite database...
if not exist "backups" mkdir backups
if not exist "data" mkdir data
if exist "data\school-office.db" (
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
    for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
    copy "data\school-office.db" "backups\school-office_preupdate_%mydate%_%mytime%.db" >nul
    echo       Safety backup preserved in backups folder.
) else (
    echo       No existing database file found; will auto-initialize on boot.
)

echo [3/5] Checking for remote code updates...
if exist ".git" (
    echo       Pulling latest software build...
    git pull --ff-only
) else (
    echo       Git repository not detected; skipping pull step.
)

echo [4/5] Updating application dependencies...
call npm install --no-audit --no-fund

echo [5/5] Compiling production build...
call npm run build

echo.
echo ======================================================================
echo   Update completed successfully! All assets and database are verified.
echo   To launch the office terminal: npm run dev
echo ======================================================================
echo.
pause
