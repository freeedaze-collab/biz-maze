@echo off
echo ========================================
echo Dollar-biz Production Build ^& Deploy
echo ========================================
echo.

echo [Step 1/2] Building production bundle...
node node_modules\vite\bin\vite.js build

if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build successful!
echo ========================================
echo.
echo The 'dist' folder has been created with your production files.
echo.
echo To deploy to Firebase Hosting:
echo 1. Open https://console.firebase.google.com
echo 2. Select project: biz-mazegit-42313395-c1eab
echo 3. Click "Hosting" in left menu
echo 4. Click "Add another site" or find existing site
echo 5. Drag and drop ALL files from 'dist' folder
echo.
echo Opening dist folder for you...
start explorer "%cd%\dist"
echo.
echo Once uploaded, your changes will be live!
echo.
pause
