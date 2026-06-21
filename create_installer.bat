@echo off
echo ========================================
echo Annapurna POS - Portable Installer Creator
echo ========================================
echo.

cd /d "%~dp0"

echo [1/3] Checking if 7-Zip is available...
where 7z >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: 7-Zip not found. Please install 7-Zip or use Windows built-in compression.
    echo.
    echo Creating ZIP using PowerShell instead...
    powershell -Command "Compress-Archive -Path 'dist\win-unpacked\*' -DestinationPath 'dist\Annapurna-POS-v1.0.0-Portable.zip' -Force"
    if %ERRORLEVEL% EQU 0 (
        echo SUCCESS: Portable ZIP created at dist\Annapurna-POS-v1.0.0-Portable.zip
    ) else (
        echo ERROR: Failed to create ZIP file
        exit /b 1
    )
) else (
    echo [2/3] Creating portable ZIP package...
    cd dist\win-unpacked
    7z a -tzip "..\Annapurna-POS-v1.0.0-Portable.zip" * -mx9
    cd ..\..
    
    if exist "dist\Annapurna-POS-v1.0.0-Portable.zip" (
        echo SUCCESS: Portable ZIP created at dist\Annapurna-POS-v1.0.0-Portable.zip
    ) else (
        echo ERROR: Failed to create ZIP file
        exit /b 1
    )
)

echo.
echo [3/3] Getting file size...
for %%A in ("dist\Annapurna-POS-v1.0.0-Portable.zip") do echo File Size: %%~zA bytes

echo.
echo ========================================
echo DONE!
echo ========================================
echo.
echo Portable package created successfully!
echo Location: dist\Annapurna-POS-v1.0.0-Portable.zip
echo.
echo To install:
echo 1. Extract the ZIP file
echo 2. Run "Annapurna POS.exe"
echo 3. Login with: admin@pos.com / admin123
echo 4. Change password on first login
echo.
pause
