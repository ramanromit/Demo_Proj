@echo off
echo ============================================================
echo   Starting OrderFlow Demo Target Application
echo   - Backend:  http://127.0.0.1:8080 (FastAPI Service)
echo   - Frontend: http://localhost:3000 (React / Vite Dashboard)
echo ============================================================

start "OrderFlow Backend (Port 8080)" cmd /k "cd /d %~dp0backend && .venv\Scripts\python.exe run.py"
start "OrderFlow Frontend (Port 3000)" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Both services launched in separate windows!
echo - Access UI at: http://localhost:3000
echo - API Docs at:  http://127.0.0.1:8080/docs
echo ============================================================
