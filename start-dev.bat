@echo off
cd /d "%~dp0"
node node_modules\vite\bin\vite.js --host --port 8080
pause
