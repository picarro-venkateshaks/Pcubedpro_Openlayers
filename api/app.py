from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import json
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# GeoServer configuration
GEOSERVER_BASE_URL = "http://20.20.152.180:8181/geoserver"
WORKSPACE = "Picarro"
WMS_URL = f"{GEOSERVER_BASE_URL}/{WORKSPACE}/wms"
WFS_URL = f"{GEOSERVER_BASE_URL}/{WORKSPACE}/wfs"

# Available layers configuration
AVAILABLE_LAYERS = [
    {"id": "Picarro:Boundary", "name": "Boundary", "visible": True},
    {"id": "Picarro:OtherLayer", "name": "Other Layer", "visible": False},
]

@app.route("/", methods=["GET"])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "message": "GIS API Server is running",
        "timestamp": datetime.now().isoformat(),
        "geoserver_url": GEOSERVER_BASE_URL,
        "endpoints": [
            "/api/layers",
            "/api/spatial-query",
            "/api/features",
            "/api/performance"
        ]
    })

@app.route("/api/layers", methods=["GET"])
def get_layers():
    """Get available layers"""
    try:
        # Try to get layers from GeoServer capabilities
        params = {
            "service": "WMS",
            "version": "1.1.1",
            "request": "GetCapabilities"
        }
        
        response = requests.get(WMS_URL, params=params, timeout=10)
        
        if response.status_code == 200:
            # Parse capabilities to get actual layers
            import xml.etree.ElementTree as ET
            try:
                root = ET.fromstring(response.content)
                layers = []
                
                for layer in root.findall('.//{http://www.opengis.net/wms}Layer'):
                    name_elem = layer.find('{http://www.opengis.net/wms}Name')
                    title_elem = layer.find('{http://www.opengis.net/wms}Title')
                    
                    if name_elem is not None:
                        layer_info = {
                            "id": name_elem.text,
                            "name": title_elem.text if title_elem is not None else name_elem.text,
                            "visible": True
                        }
                        layers.append(layer_info)
                
                if layers:
                    return jsonify({"layers": layers})
            except ET.ParseError:
                pass
        
        # Return default layers if capabilities parsing fails
        return jsonify({"layers": AVAILABLE_LAYERS})
        
    except Exception as e:
        print(f"Error getting layers: {e}")
        return jsonify({"layers": AVAILABLE_LAYERS})

@app.route("/api/spatial-query", methods=["POST"])
def spatial_query():
    """Perform spatial query with multiple layers"""
    try:
        data = request.get_json()
        geometry = data.get("geometry")  # WKT format
        layers = data.get("layers", [])  # List of layer IDs to query
        
        if not geometry:
            return jsonify({"error": "Geometry (WKT) is required"}), 400
        
        if not layers:
            return jsonify({"error": "At least one layer is required"}), 400
        
        start_time = time.time()
        results = {}
        
        # Query each layer
        for layer_id in layers:
            layer_start_time = time.time()
            
            try:
                # Prepare WFS request
                wfs_params = {
                    "service": "WFS",
                    "version": "1.0.0",
                    "request": "GetFeature",
                    "typeName": layer_id,
                    "outputFormat": "application/json",
                    "maxFeatures": "1000",
                    "CQL_FILTER": f"INTERSECTS(the_geom, {geometry})"
                }
                
                # Make WFS request
                response = requests.get(WFS_URL, params=wfs_params, timeout=30)
                layer_end_time = time.time()
                
                if response.status_code == 200:
                    try:
                        geo_json = response.json()
                        features = geo_json.get("features", [])
                        
                        results[layer_id] = {
                            "success": True,
                            "features": features,
                            "count": len(features),
                            "loadTime": (layer_end_time - layer_start_time) * 1000,  # Convert to ms
                            "layerName": next((layer["name"] for layer in AVAILABLE_LAYERS if layer["id"] == layer_id), layer_id)
                        }
                    except json.JSONDecodeError:
                        results[layer_id] = {
                            "success": False,
                            "features": [],
                            "count": 0,
                            "loadTime": (layer_end_time - layer_start_time) * 1000,
                            "error": "Invalid JSON response",
                            "layerName": next((layer["name"] for layer in AVAILABLE_LAYERS if layer["id"] == layer_id), layer_id)
                        }
                else:
                    results[layer_id] = {
                        "success": False,
                        "features": [],
                        "count": 0,
                        "loadTime": (layer_end_time - layer_start_time) * 1000,
                        "error": f"HTTP {response.status_code}",
                        "layerName": next((layer["name"] for layer in AVAILABLE_LAYERS if layer["id"] == layer_id), layer_id)
                    }
                    
            except requests.RequestException as e:
                layer_end_time = time.time()
                results[layer_id] = {
                    "success": False,
                    "features": [],
                    "count": 0,
                    "loadTime": (layer_end_time - layer_start_time) * 1000,
                    "error": str(e),
                    "layerName": next((layer["name"] for layer in AVAILABLE_LAYERS if layer["id"] == layer_id), layer_id)
                }
        
        total_time = (time.time() - start_time) * 1000
        
        return jsonify({
            "success": True,
            "results": results,
            "totalTime": total_time,
            "queryTime": datetime.now().isoformat(),
            "geometry": geometry
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/features", methods=["GET"])
def get_features():
    """Get features for a specific layer with optional filtering"""
    try:
        layer_id = request.args.get("layer")
        geometry = request.args.get("geometry")  # WKT format
        max_features = request.args.get("maxFeatures", "1000")
        
        if not layer_id:
            return jsonify({"error": "Layer ID is required"}), 400
        
        # Prepare WFS request
        wfs_params = {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": max_features
        }
        
        # Add spatial filter if geometry provided
        if geometry and geometry != "1=1":
            wfs_params["CQL_FILTER"] = f"INTERSECTS(the_geom, {geometry})"
        
        # Make WFS request
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                return jsonify(geo_json)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON response from GeoServer"}), 500
        else:
            return jsonify({"error": f"WFS request failed: {response.status_code}"}), 500
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/performance", methods=["GET"])
def get_performance():
    """Get performance metrics for recent queries"""
    # This could be extended to store and retrieve performance metrics
    return jsonify({
        "message": "Performance metrics endpoint",
        "timestamp": datetime.now().isoformat()
    })

@app.route("/api/test-connection", methods=["GET"])
def test_connection():
    """Test GeoServer connection"""
    try:
        # Test WMS capabilities
        wms_params = {
            "service": "WMS",
            "version": "1.1.1",
            "request": "GetCapabilities"
        }
        
        wms_response = requests.get(WMS_URL, params=wms_params, timeout=10)
        wms_status = wms_response.status_code == 200
        
        # Test WFS capabilities
        wfs_params = {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetCapabilities"
        }
        
        wfs_response = requests.get(WFS_URL, params=wfs_params, timeout=10)
        wfs_status = wfs_response.status_code == 200
        
        return jsonify({
            "wms_status": "connected" if wms_status else "failed",
            "wfs_status": "connected" if wfs_status else "failed",
            "wms_url": WMS_URL,
            "wfs_url": WFS_URL,
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            "error": str(e),
            "wms_url": WMS_URL,
            "wfs_url": WFS_URL,
            "timestamp": datetime.now().isoformat()
        }), 500

if __name__ == "__main__":
    print("Starting GIS API Server...")
    print(f"GeoServer URL: {GEOSERVER_BASE_URL}")
    print(f"WMS URL: {WMS_URL}")
    print(f"WFS URL: {WFS_URL}")
    print("API will be available at: http://localhost:5000")
    print("\nAvailable endpoints:")
    print("  - GET  /api/layers")
    print("  - POST /api/spatial-query")
    print("  - GET  /api/features")
    print("  - GET  /api/performance")
    print("  - GET  /api/test-connection")
    
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Failed to start server: {e}")
        print("Make sure port 5000 is not already in use") 