@echo off
:: ============================================================
:: build_all.bat — Full production build for Annapurna POS
::
:: This script:
::   0. Kills all running processes that could lock files
::   1. Cleans old build artifacts
::   2. Builds the FastAPI backend → backend\dist\backend.exe
::   3. Builds the React frontend → frontend\build\
::   4. Packages everything into dist\Annapurna POS Setup.exe
::
:: Prerequisites:
::   - Node.js & npm installed
::   - Python .venv in backend\.venv\
::   - mongod.exe placed in bin\mongod.exe
::   - An icon at electron\icon.ico
:: ============================================================

setlocal
cd /d "%~dp0"

echo.
echo =============================================
echo  Annapurna POS — Production Build
echo =============================================
echo.

:: ──── Step 0: Kill all processes that could lock files ────
echo [0/4] Cleaning up running processes...

:: Kill Annapurna POS instances
taskkill /F /IM "Annapurna POS.exe" 2>nul
if %ERRORLEVEL% equ 0 (echo   - Killed Annapurna POS.exe)

:: Kill Electron processes
taskkill /F /IM electron.exe 2>nul
if %ERRORLEVEL% equ 0 (echo   - Killed electron.exe)

:: Kill backend.exe processes
taskkill /F /IM backend.exe 2>nul
if %ERRORLEVEL% equ 0 (echo   - Killed backend.exe)

:: Kill mongod.exe processes
taskkill /F /IM mongod.exe 2>nul
if %ERRORLEVEL% equ 0 (echo   - Killed mongod.exe)

:: Kill app-builder.exe (electron-builder helper)
taskkill /F /IM app-builder.exe 2>nul
if %ERRORLEVEL% equ 0 (echo   - Killed app-builder.exe)

:: Kill node.exe processes that might be related to this project
:: (Only if they're in this directory tree - be careful)
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| find "PID:"') do (
    wmic process where ProcessId=%%i get CommandLine 2>nul | find /I "%~dp0" >nul
    if not errorlevel 1 (
        taskkill /F /PID %%i 2>nul
        if not errorlevel 1 (echo   - Killed node.exe PID %%i)
    )
)

echo   - Process cleanup complete

:: Wait a moment for file handles to release
timeout /t 2 /nobreak >nul

echo [0/4] Done.
echo.

:: ──── Step 0.5: Clean old build artifacts ────────────────
echo [0.5/4] Removing old build artifacts...

:: Remove dist folder (electron-builder output)
if exist "dist" (
    echo   - Removing dist\
    rmdir /s /q "dist" 2>nul
    if exist "dist" (
        echo   [WARN] Could not fully remove dist\ - some files may be locked
        :: Try again after a brief pause
        timeout /t 1 /nobreak >nul
        rmdir /s /q "dist" 2>nul
    )
)

:: Remove frontend dist folder if it exists
if exist "frontend\dist" (
    echo   - Removing frontend\dist\
    rmdir /s /q "frontend\dist" 2>nul
)

:: Clean node_modules/.cache in frontend
if exist "frontend\node_modules\.cache" (
    echo   - Removing frontend\node_modules\.cache\
    rmdir /s /q "frontend\node_modules\.cache" 2>nul
)

echo   - Cleanup complete
echo [0.5/4] Done.
echo.

:: ──── Step 1: Build Python backend ────────────────────────
echo [1/4] Building backend.exe...
call backend\build_backend.bat
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend build failed. Aborting.
    exit /b 1
)
echo [1/4] Done.
echo.

:: ──── Step 2: Build React frontend ────────────────────────
echo [2/4] Building React frontend...
cd frontend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] React build failed. Aborting.
    exit /b 1
)
cd ..
echo [2/4] Done.
echo.

:: ──── Step 3: Package with electron-builder ───────────────
echo [3/4] Packaging Electron app...
cd frontend
call npm run electron:build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Electron packaging failed. Aborting.
    exit /b 1
)
cd ..
echo [3/4] Done.
echo.

echo =============================================
echo  Build complete!
echo  Installer: dist\Annapurna POS Setup.exe
echo =============================================
echo.

endlocal
