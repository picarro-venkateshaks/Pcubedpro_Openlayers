# Web GIS Application with OpenLayers

A professional web GIS application built with React.js, OpenLayers, and Python Flask backend.

## Features

- Interactive map with multiple layers
- Spatial query functionality with drawing tools
- Feature table with pagination
- Layer management and legend
- Measurement tools
- Professional UI with collapsible panels

## Architecture

- **Frontend**: React.js with OpenLayers for map rendering
- **Backend**: Python Flask API for WFS calls
- **GeoServer**: WMS calls directly from frontend, WFS calls via backend
- **Database**: GeoServer with spatial data

## Working Spatial Query Implementation

### Key Configuration for Working Spatial Queries

The spatial query functionality works with the following configuration:

1. **Geometry Field Name**: Use `the_geom` (not `geom`)
2. **WFS Version**: Use `1.0.0` for spatial queries
3. **Coordinate System**: Transform coordinates from map projection (EPSG:3857) to EPSG:4326 before sending to backend
4. **Field Priority**: Try `["the_geom", "geom", "geometry"]` in order

### Backend Configuration (api/app.py)

```python
# Spatial query with working configuration
wfs_params = {
    "service": "WFS",
    "version": "1.0.0",  # Use 1.0.0 for spatial queries
    "request": "GetFeature",
    "typeName": layer_id,
    "outputFormat": "application/json",
    "maxFeatures": "1000",
    "CQL_FILTER": f"INTERSECTS(the_geom, {geometry})"  # Use the_geom field
}
```

### Frontend Coordinate Transformation (src/App.js)

```javascript
// Transform coordinates from map projection to EPSG:4326
const coordStrings = coordinates.map(coord => {
    const transformed = transform(coord, map.getView().getProjection(), 'EPSG:4326');
    return `${transformed[0].toFixed(6)} ${transformed[1].toFixed(6)}`;
});
wktGeometry = `POLYGON((${coordStrings.join(',')}))`;
```

### Why This Works

- **WFS 1.0.0**: More compatible with spatial queries
- **the_geom field**: Correct geometry field name in GeoServer
- **EPSG:4326 coordinates**: GeoServer expects WGS84 coordinates for spatial queries
- **Coordinate transformation**: Ensures proper spatial relationship calculations

## Installation and Setup

### Prerequisites

- Node.js and npm
- Python 3.7+
- GeoServer running on http://20.20.152.180:8181/geoserver

### Backend Setup

```bash
cd api
pip install flask flask-cors requests
python app.py
```

### Frontend Setup

```bash
npm install
npm start
```

### Windows Setup

For Windows users, use the provided batch files:

```bash
start_servers.bat
```

## API Endpoints

- `GET /api/layers` - Get available layers
- `POST /api/spatial-query` - Perform spatial queries
- `GET /api/features` - Get features with pagination
- `GET /api/performance` - Performance metrics

## Widgets

- **Layers Panel**: Layer visibility and management
- **Spatial Query**: Draw polygons for spatial filtering
- **Feature Table**: Paginated feature display
- **Legend**: Layer symbology display
- **Measure**: Distance and area measurement tools

## Troubleshooting

### Spatial Queries Not Working

1. Check that WFS version is `1.0.0`
2. Verify geometry field name is `the_geom`
3. Ensure coordinates are in EPSG:4326
4. Check GeoServer layer configuration

### Table Not Loading

1. Verify backend is running on port 5000
2. Check GeoServer connectivity
3. Ensure layer exists in GeoServer

## Development Notes

- WMS calls go directly from frontend to GeoServer
- WFS calls are proxied through the backend
- Spatial queries require coordinate transformation
- Pagination is server-side with 100 features per page 