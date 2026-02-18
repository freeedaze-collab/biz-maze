@echo off
echo ========================================
echo Dollar-biz Production Deployment
echo ========================================
echo.

echo [Step 1/3] Building production bundle...
node node_modules\vite\bin\vite.js build

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo [Step 2/3] Build successful!
echo.
echo [Step 3/3] Deploying to Firebase Hosting...
echo.

REM Check if firebase-tools is installed locally
if exist node_modules\.bin\firebase.cmd (
    node_modules\.bin\firebase.cmd deploy --only hosting
) else if exist node_modules\firebase-tools\lib\bin\firebase.js (
    node node_modules\firebase-tools\lib\bin\firebase.js deploy --only hosting
) else (
    echo ERROR: Firebase tools not found!
    echo Please install: npm install firebase-tools
    pause
    exit /b 1
)

if %ERRORLEVEL% EQ 0 (
    echo.
    echo ========================================
    echo Deployment successful!
    echo ========================================
) else (
    echo.
    echo ========================================
    echo Deployment failed!
    echo ========================================
    echo.
    echo If you see "401 authentication error", please run:
    echo   node_modules\.bin\firebase login
    echo.
)

pause
