@echo off
echo 🎯 GIS Web Application Quick Start
echo ==================================================

REM Check if we're in the right directory
if not exist "api\app.py" (
    echo ❌ Please run this script from the project root directory
    pause
    exit /b 1
)

if not exist "package.json" (
    echo ❌ Please run this script from the project root directory
    pause
    exit /b 1
)

echo 🔍 Checking dependencies...

REM Check if Python is available
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python not found
    echo Please install Python from: https://www.python.org/downloads/
    pause
    exit /b 1
)
echo ✅ Python found

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js not found
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart your terminal/command prompt
    pause
    exit /b 1
)
echo ✅ Node.js found

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm not found
    echo Please install Node.js from: https://nodejs.org/
    echo After installation, restart your terminal/command prompt
    pause
    exit /b 1
)
echo ✅ npm found

echo.
echo 📦 Installing dependencies...

REM Install Python dependencies
echo Installing Python dependencies...
cd api
pip install -r requirements.txt
if errorlevel 1 (
    echo ❌ Failed to install Python dependencies
    pause
    exit /b 1
)
cd ..

REM Install Node.js dependencies
echo Installing Node.js dependencies...
npm install
if errorlevel 1 (
    echo ❌ Failed to install Node.js dependencies
    pause
    exit /b 1
)

echo.
echo 🚀 Starting backend server...

REM Start backend server in background
echo Starting Flask backend server...
start "Flask Backend" cmd /k "cd api && python app.py"

REM Wait a moment for backend to start
timeout /t 3 /nobreak >nul

echo.
echo 🎉 Backend server started successfully!
echo ==================================================
echo 🔧 Backend:  http://localhost:5000
echo 📚 API Docs: http://localhost:5000/
echo.
echo 💡 To start the frontend:
echo    1. Open a new terminal
echo    2. Navigate to the project directory
echo    3. Run: npm start
echo    4. Frontend will be available at: http://localhost:3000
echo.
echo 💡 Tips:
echo    - Draw a box on the map to query features
echo    - Use the basemap gallery to change map style
echo    - Check the performance metrics for query times
echo    - Close the command window to stop the backend server
echo ==================================================
echo.
echo Press any key to open the backend API docs in your browser...
pause >nul

REM Open the API docs in default browser
start http://localhost:5000

echo.
echo 🌐 Backend API docs opened in browser!
echo.
echo To stop the backend server, close the command window that opened.
pause 