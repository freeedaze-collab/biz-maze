@echo off
echo Building production bundle...
node node_modules\vite\bin\vite.js build

if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Build successful! Output in dist folder.
echo.
echo Ready to deploy to Firebase Hosting.
echo Run: firebase deploy --only hosting
pause
