@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required to run this local review build.
  pause
  exit /b 1
)
echo Starting The Desygn Shop local review...
node launch.mjs
pause
