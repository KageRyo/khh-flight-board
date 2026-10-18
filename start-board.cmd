@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22.19 or newer from https://nodejs.org/
  pause
  exit /b 1
)
echo Open http://127.0.0.1:3000 in your browser. See .env for custom port.
node --env-file-if-exists=.env server.mjs
pause
