# WMS API Documentation

This API provides endpoints to interact with the Picarro WMS service at `http://20.20.152.180:8181/geoserver/Picarro/wms`.

## Available Endpoints

### 1. Get WMS Capabilities
**GET** `/api/wms-capabilities`

Returns the full WMS capabilities XML document from the GeoServer.

**Example:**
```
GET /api/wms-capabilities
```

### 2. Get Available Layers
**GET** `/api/wms-layers`

Returns a JSON list of available layers from the WMS service.

**Example:**
```
GET /api/wms-layers
```

**Response:**
```json
{
  "layers": [
    {
      "name": "Picarro:Boundary",
      "title": "Boundary"
    },
    {
      "name": "Picarro:OtherLayer",
      "title": "Other Layer"
    }
  ]
}
```

### 3. WMS Filter with CQL
**GET** `/api/wms-filter`

Returns a filtered WMS image based on bounding box or WKT geometry.

**Parameters:**
- `bbox` (string): Comma-separated bounding box coordinates (minx,miny,maxx,maxy)
- `wkt` (string): WKT geometry string (requires bbox for map extent)

**Examples:**
```
GET /api/wms-filter?bbox=-100,30,-90,40
GET /api/wms-filter?bbox=-100,30,-90,40&wkt=POLYGON((-100 30, -90 30, -90 40, -100 40, -100 30))
```

### 4. Flexible WMS Proxy
**GET** `/api/wms-proxy`

A flexible proxy that forwards all parameters to the WMS service. Useful for custom WMS requests.

**Parameters:** Any valid WMS parameters

**Examples:**
```
GET /api/wms-proxy?layers=Picarro:Boundary&bbox=-100,30,-90,40&width=800&height=600
GET /api/wms-proxy?layers=Picarro:Boundary&request=GetFeatureInfo&info_format=application/json&x=400&y=300
```

## Running the API

1. Install Python dependencies:
```bash
pip install flask requests
```

2. Start the Flask server:
```bash
cd api
python queries.py
```

The API will be available at `http://localhost:5000`

## Integration with React App

The React app is configured to proxy API requests through `/api` to the Flask backend. The setupProxy.js file handles this routing.

## WMS Service Details

- **WMS URL:** `http://20.20.152.180:8181/geoserver/Picarro/wms`
- **Default Layer:** `Picarro:Boundary`
- **Supported Formats:** image/png, image/jpeg, image/gif
- **Supported SRS:** EPSG:4326, EPSG:3857

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (invalid parameters)
- `500`: Server Error (WMS service unavailable or parsing errors)

Error responses include a JSON object with an `error` field and optional `details`. 