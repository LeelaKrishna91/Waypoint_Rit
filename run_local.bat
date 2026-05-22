@echo off
echo ===================================================
echo   Waypoint_Rit Local Launch Script
echo ===================================================
echo.
echo Starting FastAPI Backend...
start "Waypoint_Rit Backend" cmd /k "cd backend && python main.py"
timeout /t 2 /nobreak > nul

echo Starting Frontend Server on http://localhost:8080 ...
start "Waypoint_Rit Frontend" cmd /k "python -m http.server 8080 --directory frontend"

echo Starting Frontend Mobile Server on http://localhost:8081 ...
start "Waypoint_Rit Mobile" cmd /k "python -m http.server 8081 --directory frontend_mobile"

echo Starting Frontend New Server on http://localhost:8082 ...
start "Waypoint_Rit Frontend New" cmd /k "python -m http.server 8082 --directory frontend_new"

echo.
echo All services launched!
echo - Backend API: http://127.0.0.1:8000
echo - Main Frontend: http://localhost:8080
echo - Mobile Frontend: http://localhost:8081
echo - New Frontend / Admin: http://localhost:8082
echo.
echo You can close the separate terminal windows to stop the servers.
pause
