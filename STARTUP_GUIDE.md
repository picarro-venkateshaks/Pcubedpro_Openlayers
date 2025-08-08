# Startup Guide

## Quick Start

### 1. Start the API Server (Flask)
```bash
# Open a new terminal window
cd api
python queries.py
```

You should see:
```
Starting Flask API server...
API will be available at: http://localhost:5000
WMS URL: http://20.20.152.180:8181/geoserver/Picarro/wms
Test endpoints:
  - GET http://localhost:5000/test-wms
  - GET http://localhost:5000/wms-layers
  - GET http://localhost:5000/wms-filter
  - GET http://localhost:5000/wms-features

Make sure the React app is running on http://localhost:3000
The React app will proxy /api requests to this Flask server
 * Running on http://0.0.0.0:5000
```

### 2. Start the React App
```bash
# Open another terminal window
npm start
```

You should see:
```
Compiled successfully!

You can now view your app in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000
```

### 3. Test the Setup

1. **Check API Server**: Click "Check API" button in the app
   - Should show: "✅ API Server is running!"

2. **Test WMS Connection**: Click "Test WMS" button
   - Should show: "WMS Test Result: Status: Success"

3. **Test Drawing**: Click "Draw Box" and draw a rectangle
   - Should show spatial query results

## Troubleshooting

### If "Check API" fails:
- Make sure you're in the `api` directory
- Make sure port 5000 is not in use
- Try: `lsof -ti:5000 | xargs kill -9` (Mac/Linux)
- Try: `netstat -ano | findstr :5000` (Windows)

### If "Test WMS" fails:
- Check if the WMS server is accessible: `http://20.20.152.180:8181/geoserver/Picarro/wms`
- Check network connectivity to the WMS server
- Verify the layer name: `Picarro:Boundary`

### If React app shows "You need to enable JavaScript":
- This means the API server is not running
- Start the Flask API server first
- Make sure both servers are running simultaneously

## Port Configuration

- **React App**: `http://localhost:3000`
- **API Server**: `http://localhost:5000`
- **WMS Server**: `http://20.20.152.180:8181`

## API Endpoints

- `GET /api/` - Health check
- `GET /api/test-wms` - Test WMS connection
- `GET /api/wms-layers` - Get available layers
- `GET /api/wms-filter` - Spatial query with WMS image
- `GET /api/wms-features` - Spatial query with WFS features 