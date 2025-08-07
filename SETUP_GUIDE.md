# GIS Web Application Setup Guide

This guide will help you set up and run the complete GIS web application with Python Flask backend and React frontend.

## Prerequisites

- Python 3.7 or higher
- Node.js 14 or higher
- npm or yarn

## Project Structure

```
Pcubedpro_Openlayers/
├── api/
│   ├── app.py              # Flask backend server
│   ├── requirements.txt     # Python dependencies
│   └── queries.py          # Original API file (legacy)
├── src/
│   ├── App.js              # React frontend
│   ├── App.css             # Frontend styles
│   └── ...
├── package.json            # Node.js dependencies
└── SETUP_GUIDE.md         # This file
```

## Step 1: Set Up Python Backend

### 1.1 Install Python Dependencies

Navigate to the `api` directory and install the required Python packages:

```bash
cd api
pip install -r requirements.txt
```

If you don't have pip, install it first:
```bash
# On Windows
python -m ensurepip --upgrade

# On macOS/Linux
sudo apt-get install python3-pip  # Ubuntu/Debian
brew install python3              # macOS with Homebrew
```

### 1.2 Start the Flask Backend Server

Run the Flask application:

```bash
cd api
python app.py
```

The server will start on `http://localhost:5000`

**Expected Output:**
```
Starting GIS API Server...
GeoServer URL: http://20.20.152.180:8181/geoserver
WMS URL: http://20.20.152.180:8181/geoserver/Picarro/wms
WFS URL: http://20.20.152.180:8181/geoserver/Picarro/wfs
API will be available at: http://localhost:5000

Available endpoints:
  - GET  /api/layers
  - POST /api/spatial-query
  - GET  /api/features
  - GET  /api/performance
  - GET  /api/test-connection

 * Serving Flask app 'app'
 * Debug mode: on
 * Running on http://0.0.0.0:5000
```

### 1.3 Test Backend API

You can test the backend API using curl or a web browser:

```bash
# Health check
curl http://localhost:5000/

# Test connection to GeoServer
curl http://localhost:5000/api/test-connection

# Get available layers
curl http://localhost:5000/api/layers
```

## Step 2: Set Up React Frontend

### 2.1 Install Node.js Dependencies

In the project root directory:

```bash
npm install
```

### 2.2 Start the React Development Server

```bash
npm start
```

The React app will start on `http://localhost:3000`

**Expected Output:**
```
Compiled successfully!

You can now view gis-app in the browser.

  Local:            http://localhost:3000
  On Your Network:  http://192.168.x.x:3000

Note that the development build is not optimized.
To create a production build, use npm run build.
```

## Step 3: Verify Everything is Working

### 3.1 Check Backend Status

Visit `http://localhost:5000/` in your browser. You should see:
```json
{
  "status": "ok",
  "message": "GIS API Server is running",
  "timestamp": "2024-01-XX...",
  "geoserver_url": "http://20.20.152.180:8181/geoserver",
  "endpoints": [...]
}
```

### 3.2 Check Frontend Status

Visit `http://localhost:3000` in your browser. You should see:
- The map interface
- API connection status indicator (top-left)
- Performance metrics panel
- Basemap gallery (top-right)
- Layers panel (top-right)
- Spatial query panel (bottom-left)
- Feature table (bottom, collapsed by default)

### 3.3 Test the Complete Workflow

1. **Check API Connection**: The status indicator should show "✅ Connected"
2. **Change Basemap**: Click on different basemap options in the top-right panel
3. **Draw a Query Box**: Click "Draw Box" and draw a polygon on the map
4. **View Results**: The table should expand and show query results
5. **Navigate Results**: Use pagination and tabs to explore different layers

## Troubleshooting

### Backend Issues

**Port 5000 already in use:**
```bash
# Find and kill the process using port 5000
lsof -ti:5000 | xargs kill -9

# Or use a different port
python app.py --port 5001
```

**Python dependencies not found:**
```bash
# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**GeoServer connection issues:**
- Check if GeoServer is running at `http://20.20.152.180:8181/geoserver`
- Verify network connectivity
- Check firewall settings

### Frontend Issues

**Port 3000 already in use:**
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm start
```

**API connection failed:**
- Ensure the Flask backend is running on port 5000
- Check browser console for CORS errors
- Verify the API_BASE_URL in App.js matches your backend URL

**Map not loading:**
- Check internet connection (for tile services)
- Verify OpenLayers is properly installed
- Check browser console for JavaScript errors

## API Endpoints

### Backend API (Flask)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/api/layers` | GET | Get available layers |
| `/api/spatial-query` | POST | Perform spatial query |
| `/api/features` | GET | Get features for a layer |
| `/api/performance` | GET | Get performance metrics |
| `/api/test-connection` | GET | Test GeoServer connection |

### Example API Usage

**Spatial Query:**
```bash
curl -X POST http://localhost:5000/api/spatial-query \
  -H "Content-Type: application/json" \
  -d '{
    "geometry": "POLYGON((-122.1 37.4, -122.0 37.4, -122.0 37.5, -122.1 37.5, -122.1 37.4))",
    "layers": ["Picarro:Boundary", "Picarro:OtherLayer"]
  }'
```

## Development

### Backend Development

The Flask app is in `api/app.py`. Key features:
- CORS enabled for frontend communication
- Error handling and logging
- Performance metrics
- GeoServer WFS/WMS proxy

### Frontend Development

The React app is in `src/App.js`. Key features:
- OpenLayers map integration
- Real-time API communication
- Responsive UI design
- Feature table with pagination

### Configuration

**Backend Configuration** (`api/app.py`):
```python
GEOSERVER_BASE_URL = "http://20.20.152.180:8181/geoserver"
WORKSPACE = "Picarro"
```

**Frontend Configuration** (`src/App.js`):
```javascript
const API_BASE_URL = 'http://localhost:5000/api';
```

## Production Deployment

### Backend Deployment

1. Use a production WSGI server like Gunicorn:
```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

2. Set up a reverse proxy (nginx) for SSL termination

### Frontend Deployment

1. Build the production version:
```bash
npm run build
```

2. Serve the `build` folder with a web server

## Support

For issues or questions:
1. Check the browser console for JavaScript errors
2. Check the Flask server logs for backend errors
3. Verify network connectivity to GeoServer
4. Ensure all dependencies are properly installed 