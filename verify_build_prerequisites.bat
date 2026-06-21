@echo off
:: ============================================================
:: verify_build_prerequisites.bat — Check build requirements
::
:: This script verifies all prerequisites are met before
:: running the production build.
:: ============================================================

setlocal
cd /d "%~dp0"

echo.
echo =============================================
echo  Annapurna POS — Build Prerequisites Check
echo =============================================
echo.

set "ERRORS=0"

:: Check 1: Node.js
echo [1/7] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
    echo   [OK] Node.js found: !NODE_VER!
) else (
    echo   [ERROR] Node.js not found. Install from https://nodejs.org/
    set /a ERRORS+=1
)

:: Check 2: npm
echo [2/7] Checking npm...
where npm >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('npm --version') do set NPM_VER=%%i
    echo   [OK] npm found: v!NPM_VER!
) else (
    echo   [ERROR] npm not found. Install Node.js from https://nodejs.org/
    set /a ERRORS+=1
)

:: Check 3: Python
echo [3/7] Checking Python...
where python >nul 2>&1
if %ERRORLEVEL% equ 0 (
    for /f "tokens=*" %%i in ('python --version') do set PY_VER=%%i
    echo   [OK] !PY_VER! found
) else (
    echo   [ERROR] Python not found. Install from https://www.python.org/
    set /a ERRORS+=1
)

:: Check 4: Backend virtual environment
echo [4/7] Checking backend virtual environment...
if exist "backend\.venv\Scripts\activate.bat" (
    echo   [OK] Virtual environment found at backend\.venv\
) else (
    echo   [ERROR] Virtual environment not found at backend\.venv\
    echo   [INFO] Create it with: cd backend ^&^& python -m venv .venv
    set /a ERRORS+=1
)

:: Check 5: Frontend node_modules
echo [5/7] Checking frontend dependencies...
if exist "frontend\node_modules\" (
    echo   [OK] node_modules found in frontend\
) else (
    echo   [ERROR] node_modules not found in frontend\
    echo   [INFO] Install with: cd frontend ^&^& npm install --legacy-peer-deps
    set /a ERRORS+=1
)

:: Check 6: Electron files
echo [6/7] Checking Electron files...
if exist "electron\main.js" (
    echo   [OK] electron\main.js found
) else (
    echo   [ERROR] electron\main.js not found
    set /a ERRORS+=1
)
if exist "electron\icon.ico" (
    echo   [OK] electron\icon.ico found
) else (
    echo   [WARN] electron\icon.ico not found (optional but recommended)
)

:: Check 7: MongoDB binary (read from package.json)
echo [7/7] Checking MongoDB binary...
findstr /C:"\"from\": \"D:/mongodb/bin/mongod.exe\"" frontend\package.json >nul
if %ERRORLEVEL% equ 0 (
    if exist "D:\mongodb\bin\mongod.exe" (
        echo   [OK] mongod.exe found at D:\mongodb\bin\mongod.exe
    ) else (
        echo   [ERROR] mongod.exe not found at D:\mongodb\bin\mongod.exe
        echo   [INFO] See SETUP_MONGODB.md for instructions
        set /a ERRORS+=1
    )
) else (
    echo   [INFO] MongoDB path configured differently or commented out
    echo   [INFO] Verify the path in frontend\package.json extraResources
)

echo.
echo =============================================
if %ERRORS% equ 0 (
    echo  [SUCCESS] All prerequisites met!
    echo  You can now run: build_all.bat
) else (
    echo  [FAILED] %ERRORS% error(s) found
    echo  Fix the errors above before building
)
echo =============================================
echo.

pause
endlocal
