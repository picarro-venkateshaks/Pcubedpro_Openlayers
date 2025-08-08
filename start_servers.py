#!/usr/bin/env python3
"""
Quick start script for the GIS Web Application
This script starts both the Flask backend and React frontend servers.
"""

import subprocess
import sys
import time
import os
import signal
import threading
from pathlib import Path

def find_npm():
    """Find npm executable on Windows"""
    # Common npm locations on Windows
    npm_paths = [
        'npm',
        'npm.cmd',
        r'C:\Program Files\nodejs\npm.cmd',
        r'C:\Program Files (x86)\nodejs\npm.cmd',
        os.path.expanduser(r'~\AppData\Roaming\npm\npm.cmd'),
        os.path.expanduser(r'~\AppData\Local\Programs\nodejs\npm.cmd')
    ]
    
    for npm_path in npm_paths:
        try:
            result = subprocess.run([npm_path, '--version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"✅ Found npm at: {npm_path}")
                return npm_path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    
    return None

def find_node():
    """Find node executable on Windows"""
    # Common node locations on Windows
    node_paths = [
        'node',
        'node.exe',
        r'C:\Program Files\nodejs\node.exe',
        r'C:\Program Files (x86)\nodejs\node.exe',
        os.path.expanduser(r'~\AppData\Local\Programs\nodejs\node.exe')
    ]
    
    for node_path in node_paths:
        try:
            result = subprocess.run([node_path, '--version'], 
                                  capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"✅ Found Node.js at: {node_path}")
                return node_path
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    
    return None

def check_dependencies():
    """Check if required dependencies are installed"""
    print("🔍 Checking dependencies...")
    
    # Check Python
    try:
        import flask
        import requests
        print("✅ Python dependencies found")
    except ImportError as e:
        print(f"❌ Python dependency missing: {e}")
        print("Run: pip install -r api/requirements.txt")
        return False
    
    # Check Node.js
    node_path = find_node()
    if not node_path:
        print("❌ Node.js not found")
        print("Please install Node.js from: https://nodejs.org/")
        print("After installation, restart your terminal/command prompt")
        return False
    
    # Check npm
    npm_path = find_npm()
    if not npm_path:
        print("❌ npm not found")
        print("Please install Node.js from: https://nodejs.org/")
        print("After installation, restart your terminal/command prompt")
        return False
    
    return True

def install_dependencies():
    """Install dependencies if needed"""
    print("\n📦 Installing dependencies...")
    
    # Install Python dependencies
    print("Installing Python dependencies...")
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', 'api/requirements.txt'], 
                      check=True, capture_output=True)
        print("✅ Python dependencies installed")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install Python dependencies: {e}")
        return False
    
    # Install Node.js dependencies
    print("Installing Node.js dependencies...")
    npm_path = find_npm()
    if not npm_path:
        print("❌ npm not found, cannot install Node.js dependencies")
        return False
    
    try:
        subprocess.run([npm_path, 'install'], check=True, capture_output=True)
        print("✅ Node.js dependencies installed")
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install Node.js dependencies: {e}")
        return False
    
    return True

def start_backend():
    """Start the Flask backend server"""
    print("\n🚀 Starting Flask backend server...")
    try:
        # Change to api directory and start Flask
        os.chdir('api')
        process = subprocess.Popen([sys.executable, 'app.py'], 
                                 stdout=subprocess.PIPE, 
                                 stderr=subprocess.PIPE,
                                 text=True)
        
        # Wait a moment for server to start
        time.sleep(3)
        
        # Check if server is running
        if process.poll() is None:
            print("✅ Flask backend server started on http://localhost:5000")
            return process
        else:
            stdout, stderr = process.communicate()
            print(f"❌ Failed to start Flask server: {stderr}")
            return None
    except Exception as e:
        print(f"❌ Error starting Flask server: {e}")
        return None

def start_frontend():
    """Start the React frontend server"""
    print("\n🌐 React frontend server not started automatically.")
    print("💡 To start the frontend, run: npm start")
    print("   The frontend will be available at: http://localhost:3000")
    return None

def monitor_processes(backend_process, frontend_process):
    """Monitor the running processes"""
    print("\n📊 Monitoring backend server...")
    print("Press Ctrl+C to stop the server")
    
    try:
        while True:
            # Check if backend process is still running
            if backend_process and backend_process.poll() is not None:
                print("❌ Backend server stopped unexpectedly")
                break
            
            time.sleep(5)
            
    except KeyboardInterrupt:
        print("\n🛑 Stopping backend server...")
        
        # Stop backend
        if backend_process:
            backend_process.terminate()
            try:
                backend_process.wait(timeout=5)
                print("✅ Backend server stopped")
            except subprocess.TimeoutExpired:
                backend_process.kill()
                print("⚠️ Backend server force killed")
        
        print("👋 Backend server stopped")

def main():
    """Main function to start the application"""
    print("🎯 GIS Web Application Quick Start")
    print("=" * 50)
    
    # Check if we're in the right directory
    if not Path('api').exists() or not Path('package.json').exists():
        print("❌ Please run this script from the project root directory")
        sys.exit(1)
    
    # Check dependencies
    if not check_dependencies():
        print("\n❌ Dependencies check failed")
        print("\n🔧 Manual Installation Steps:")
        print("1. Install Node.js from: https://nodejs.org/")
        print("2. Restart your terminal/command prompt")
        print("3. Run: pip install -r api/requirements.txt")
        print("4. Run: npm install")
        print("5. Try running this script again")
        
        response = input("\nWould you like to try installing dependencies anyway? (y/n): ")
        if response.lower() == 'y':
            if not install_dependencies():
                print("❌ Failed to install dependencies")
                print("Please install manually and try again")
                sys.exit(1)
        else:
            print("Please install dependencies manually and try again")
            sys.exit(1)
    
    # Start backend
    backend_process = start_backend()
    if not backend_process:
        print("❌ Failed to start backend server")
        sys.exit(1)
    
    # Start frontend (optional)
    frontend_process = start_frontend()
    
    # Print success message
    print("\n🎉 Backend server started successfully!")
    print("=" * 50)
    print("🔧 Backend:  http://localhost:5000")
    print("📚 API Docs: http://localhost:5000/")
    print("\n💡 To start the frontend:")
    print("   1. Open a new terminal")
    print("   2. Navigate to the project directory")
    print("   3. Run: npm start")
    print("   4. Frontend will be available at: http://localhost:3000")
    print("\n💡 Tips:")
    print("   - Draw a box on the map to query features")
    print("   - Use the basemap gallery to change map style")
    print("   - Check the performance metrics for query times")
    print("   - Press Ctrl+C to stop the backend server")
    print("=" * 50)
    
    # Monitor processes (only backend)
    monitor_processes(backend_process, frontend_process)

if __name__ == "__main__":
    main() 