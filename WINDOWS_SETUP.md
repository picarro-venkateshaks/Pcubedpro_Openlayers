# Windows Setup Guide

This guide helps you set up the GIS Web Application on Windows.

## Prerequisites

### 1. Install Python
1. Download Python from: https://www.python.org/downloads/
2. **Important**: Check "Add Python to PATH" during installation
3. Verify installation:
   ```cmd
   python --version
   pip --version
   ```

### 2. Install Node.js
1. Download Node.js from: https://nodejs.org/
2. Choose the LTS version (recommended)
3. **Important**: Check "Add to PATH" during installation
4. Verify installation:
   ```cmd
   node --version
   npm --version
   ```

## Quick Start Options

### Option 1: Use the Batch File (Recommended)
1. Double-click `start_servers.bat`
2. The script will automatically:
   - Check dependencies
   - Install packages
   - Start both servers
   - Open the application in your browser

### Option 2: Use the Python Script
1. Open Command Prompt as Administrator
2. Navigate to your project directory
3. Run:
   ```cmd
   python start_servers.py
   ```

### Option 3: Manual Setup
1. **Install Python dependencies:**
   ```cmd
   cd api
   pip install -r requirements.txt
   cd ..
   ```

2. **Install Node.js dependencies:**
   ```cmd
   npm install
   ```

3. **Start backend server:**
   ```cmd
   cd api
   python app.py
   ```

4. **Start frontend server (in new terminal):**
   ```cmd
   npm start
   ```

## Common Windows Issues

### Issue 1: "npm is not recognized"
**Solution:**
1. Reinstall Node.js and make sure to check "Add to PATH"
2. Restart your Command Prompt
3. If still not working, add Node.js to PATH manually:
   - Open System Properties → Advanced → Environment Variables
   - Add `C:\Program Files\nodejs\` to PATH

### Issue 2: "python is not recognized"
**Solution:**
1. Reinstall Python and make sure to check "Add Python to PATH"
2. Restart your Command Prompt
3. If still not working, add Python to PATH manually:
   - Open System Properties → Advanced → Environment Variables
   - Add `C:\Users\[YourUsername]\AppData\Local\Programs\Python\Python3x\` to PATH

### Issue 3: Port already in use
**Solution:**
1. Find the process using the port:
   ```cmd
   netstat -ano | findstr :5000
   netstat -ano | findstr :3000
   ```
2. Kill the process:
   ```cmd
   taskkill /PID [PID_NUMBER] /F
   ```

### Issue 4: Permission denied
**Solution:**
1. Run Command Prompt as Administrator
2. Or run PowerShell as Administrator

### Issue 5: Antivirus blocking
**Solution:**
1. Add your project folder to antivirus exclusions
2. Temporarily disable antivirus for testing

## Alternative Installation Methods

### Using Chocolatey (if installed)
```cmd
choco install python nodejs
```

### Using Scoop (if installed)
```cmd
scoop install python nodejs
```

## Verification Steps

1. **Check Python:**
   ```cmd
   python --version
   pip --version
   ```

2. **Check Node.js:**
   ```cmd
   node --version
   npm --version
   ```

3. **Test the application:**
   - Backend: http://localhost:5000
   - Frontend: http://localhost:3000

## Troubleshooting Commands

### Check if ports are available:
```cmd
netstat -ano | findstr :5000
netstat -ano | findstr :3000
```

### Kill processes by port:
```cmd
for /f "tokens=5" %a in ('netstat -ano ^| findstr :5000') do taskkill /f /pid %a
for /f "tokens=5" %a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %a
```

### Check PATH environment:
```cmd
echo %PATH%
```

### Find Python installation:
```cmd
where python
```

### Find Node.js installation:
```cmd
where node
where npm
```

## Getting Help

If you're still having issues:

1. **Check the logs:**
   - Backend logs will appear in the Flask command window
   - Frontend logs will appear in the React command window

2. **Common error messages:**
   - `'npm' is not recognized`: Node.js not in PATH
   - `'python' is not recognized`: Python not in PATH
   - `EADDRINUSE`: Port already in use
   - `Permission denied`: Run as Administrator

3. **Reset everything:**
   ```cmd
   rmdir /s node_modules
   rmdir /s api\__pycache__
   npm install
   cd api
   pip install -r requirements.txt
   cd ..
   ```

## Success Indicators

When everything is working correctly, you should see:

1. **Backend server:**
   ```
   Starting GIS API Server...
   * Running on http://0.0.0.0:5000
   ```

2. **Frontend server:**
   ```
   Compiled successfully!
   Local: http://localhost:3000
   ```

3. **Browser:**
   - Map loads with OpenStreetMap tiles
   - API connection status shows "✅ Connected"
   - All UI panels are visible and properly positioned 