@echo off
:: ============================================================
:: cleanup_processes.bat — Kill all POS-related processes
::
:: Use this script if you need to manually clean up processes
:: before running the build or if the app is stuck.
:: ============================================================

echo.
echo =============================================
echo  Annapurna POS — Process Cleanup
echo =============================================
echo.

:: Kill Annapurna POS instances
echo Killing Annapurna POS instances...
taskkill /F /IM "Annapurna POS.exe" 2>nul
if %ERRORLEVEL% equ 0 (
    echo   [OK] Killed Annapurna POS.exe
) else (
    echo   [INFO] No Annapurna POS.exe processes found
)

:: Kill Electron processes
echo Killing Electron processes...
taskkill /F /IM electron.exe 2>nul
if %ERRORLEVEL% equ 0 (
    echo   [OK] Killed electron.exe
) else (
    echo   [INFO] No electron.exe processes found
)

:: Kill backend.exe processes
echo Killing backend.exe processes...
taskkill /F /IM backend.exe 2>nul
if %ERRORLEVEL% equ 0 (
    echo   [OK] Killed backend.exe
) else (
    echo   [INFO] No backend.exe processes found
)

:: Kill mongod.exe processes
echo Killing mongod.exe processes...
taskkill /F /IM mongod.exe 2>nul
if %ERRORLEVEL% equ 0 (
    echo   [OK] Killed mongod.exe
) else (
    echo   [INFO] No mongod.exe processes found
)

:: Kill app-builder.exe (electron-builder helper)
echo Killing app-builder.exe processes...
taskkill /F /IM app-builder.exe 2>nul
if %ERRORLEVEL% equ 0 (
    echo   [OK] Killed app-builder.exe
) else (
    echo   [INFO] No app-builder.exe processes found
)

:: List any remaining node.exe processes for manual review
echo.
echo Checking for node.exe processes...
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if %ERRORLEVEL% equ 0 (
    echo   [WARN] node.exe processes still running:
    tasklist /FI "IMAGENAME eq node.exe"
    echo.
    echo   If these are related to this project, kill them manually with:
    echo   taskkill /F /IM node.exe
) else (
    echo   [OK] No node.exe processes found
)

echo.
echo =============================================
echo  Cleanup complete!
echo =============================================
echo.
pause
