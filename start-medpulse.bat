@echo off
title MedPulse AI server
cd /d "%~dp0"

set "PY="
if exist "C:\venvs\medpulse\Scripts\python.exe" set "PY=C:\venvs\medpulse\Scripts\python.exe"
if not defined PY if exist ".venv\Scripts\python.exe" set "PY=.venv\Scripts\python.exe"
if not defined PY (
  echo Could not find the virtual environment.
  echo Expected C:\venvs\medpulse or .venv in this folder.
  pause
  exit /b 1
)

echo Starting MedPulse AI at http://127.0.0.1:8000  (close this window to stop)
start "" cmd /c "timeout /t 4 >nul & start http://127.0.0.1:8000"
"%PY%" -m uvicorn main:app --reload
pause
