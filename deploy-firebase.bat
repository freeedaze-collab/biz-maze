@echo off
echo ========================================
echo Firebase Hosting Deployment
echo ========================================
echo.

REM Step 1: Install firebase-tools if not already installed
echo [1/4] Checking Firebase Tools...
if not exist node_modules\firebase-tools (
    echo Installing Firebase Tools...
    call npm install firebase-tools
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install Firebase Tools
        echo.
        echo Please run this in Command Prompt (cmd), not PowerShell
        pause
        exit /b 1
    )
)

echo.
echo [2/4] Building production bundle...
node node_modules\vite\bin\vite.js build

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [3/4] Logging in to Firebase (opens browser)...
call node_modules\.bin\firebase login

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Firebase login failed!
    pause
    exit /b 1
)

echo.
echo [4/4] Deploying to Firebase Hosting...
call node_modules\.bin\firebase deploy --only hosting

if %ERRORLEVEL% EQ 0 (
    echo.
    echo ========================================
    echo Deployment successful!
    echo ========================================
) else (
    echo.
    echo ERROR: Deployment failed!
)

pause
