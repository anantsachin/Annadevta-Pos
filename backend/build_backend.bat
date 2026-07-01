@echo off
:: ============================================================
:: build_backend.bat — Build backend.exe with PyInstaller
:: Run from the backend\ directory
:: ============================================================

setlocal

echo [Anndevta POS] Building backend.exe...

:: Ensure we are in the backend directory
cd /d "%~dp0"

:: Activate virtual environment
call .venv\Scripts\activate.bat

:: Install / upgrade pyinstaller
pip install pyinstaller --quiet

:: Clean previous build
if exist dist\backend.exe del /f dist\backend.exe

:: Run PyInstaller
pyinstaller backend.spec --clean --noconfirm

if %ERRORLEVEL% neq 0 (
    echo [ERROR] PyInstaller build failed!
    exit /b 1
)

echo.
echo [SUCCESS] Backend built: backend\dist\backend.exe
echo.

endlocal
