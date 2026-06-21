@echo off
:: ============================================================
:: build_all.bat — Full production build for Annapurna POS
::
:: This script:
::   1. Builds the FastAPI backend → backend\dist\backend.exe
::   2. Builds the React frontend → frontend\build\
::   3. Packages everything into dist\Annapurna POS Setup.exe
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

:: ──── Step 1: Build Python backend ────────────────────────
echo [1/3] Building backend.exe...
call backend\build_backend.bat
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend build failed. Aborting.
    exit /b 1
)
echo [1/3] Done.
echo.

:: ──── Step 2: Build React frontend ────────────────────────
echo [2/3] Building React frontend...
cd frontend
call npm run build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] React build failed. Aborting.
    exit /b 1
)
cd ..
echo [2/3] Done.
echo.

:: ──── Step 3: Package with electron-builder ───────────────
echo [3/3] Packaging Electron app...
cd frontend
call npm run electron:build
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Electron packaging failed. Aborting.
    exit /b 1
)
cd ..
echo [3/3] Done.
echo.

echo =============================================
echo  Build complete!
echo  Installer: dist\Annapurna POS Setup.exe
echo =============================================
echo.

endlocal
