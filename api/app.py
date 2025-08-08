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
    """Get available layers - using static list to avoid WMS calls"""
    try:
        # Return static layer list to avoid WMS calls from backend
        # Frontend will handle WMS calls directly to GeoServer
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
                    "version": "1.1.0",  # Use 1.1.0 for consistency
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
    """Get features for a specific layer with pagination support"""
    try:
        layer_id = request.args.get("layer")
        geometry = request.args.get("geometry")  # WKT format
        page = int(request.args.get("page", "1"))
        page_size = int(request.args.get("pageSize", "100"))
        start_index = (page - 1) * page_size
        get_total_count = request.args.get("getTotalCount", "false").lower() == "true"
        
        if not layer_id:
            return jsonify({"error": "Layer ID is required"}), 400
        
        # First, get total count if requested
        total_features = 0
        if get_total_count:
            count_params = {
                "service": "WFS",
                "version": "1.1.0",  # Use 1.1.0 for resultType=hits
                "request": "GetFeature",
                "typeName": layer_id,
                "resultType": "hits"  # Only get count, not features
            }
            
            # Add spatial filter if geometry provided
            if geometry and geometry != "1=1":
                count_params["CQL_FILTER"] = f"INTERSECTS(the_geom, {geometry})"
            
            print(f"DEBUG: Making count request to GeoServer with params: {count_params}")
            count_response = requests.get(WFS_URL, params=count_params, timeout=30)
            print(f"DEBUG: Count response status: {count_response.status_code}")
            
            if count_response.status_code == 200:
                try:
                    count_text = count_response.text
                    print(f"DEBUG: Count response text: {count_text}")
                    
                    # Parse XML response to extract total count
                    # Look for numberOfFeatures attribute in FeatureCollection
                    import re
                    
                    # Try to find numberOfFeatures attribute (WFS 1.1.0)
                    number_match = re.search(r'numberOfFeatures="(\d+)"', count_text)
                    if number_match:
                        total_features = int(number_match.group(1))
                        print(f"DEBUG: Found numberOfFeatures: {total_features}")
                    else:
                        # Try to find numberMatched attribute (WFS 2.0.0)
                        matched_match = re.search(r'numberMatched="(\d+)"', count_text)
                        if matched_match:
                            total_features = int(matched_match.group(1))
                            print(f"DEBUG: Found numberMatched: {total_features}")
                        else:
                            # Try to find numberReturned attribute
                            returned_match = re.search(r'numberReturned="(\d+)"', count_text)
                            if returned_match:
                                total_features = int(returned_match.group(1))
                                print(f"DEBUG: Found numberReturned: {total_features}")
                            else:
                                # Try alternative patterns
                                alt_match = re.search(r'numberOfFeatures=(\d+)', count_text)
                                if alt_match:
                                    total_features = int(alt_match.group(1))
                                    print(f"DEBUG: Found numberOfFeatures (alt): {total_features}")
                                else:
                                    print(f"DEBUG: No count found in XML response, using 0")
                                    print(f"DEBUG: Full response: {count_text}")
                                    total_features = 0
                except Exception as e:
                    print(f"DEBUG: Error parsing count response: {e}")
                    total_features = 0
            else:
                print(f"DEBUG: Count request failed with status: {count_response.status_code}")
                print(f"DEBUG: Count response text: {count_response.text}")
        
        # If we don't have total_features but getTotalCount is false, 
        # we need to get it for pagination info
        if total_features == 0 and not get_total_count:
            # Make a quick count request to get total features for pagination
            count_params = {
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "typeName": layer_id,
                "resultType": "hits"
            }
            
            # Add spatial filter if geometry provided
            if geometry and geometry != "1=1":
                count_params["CQL_FILTER"] = f"INTERSECTS(the_geom, {geometry})"
            
            try:
                count_response = requests.get(WFS_URL, params=count_params, timeout=10)
                if count_response.status_code == 200:
                    count_text = count_response.text
                    import re
                    number_match = re.search(r'numberOfFeatures="(\d+)"', count_text)
                    if number_match:
                        total_features = int(number_match.group(1))
                        print(f"DEBUG: Got total_features for pagination: {total_features}")
            except Exception as e:
                print(f"DEBUG: Error getting total count for pagination: {e}")
                total_features = 0
        
        # Prepare WFS request with pagination
        wfs_params = {
            "service": "WFS",
            "version": "1.1.0",  # Use 1.1.0 for consistency
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": page_size,
            "startIndex": start_index
        }
        
        # Add spatial filter if geometry provided
        if geometry and geometry != "1=1":
            wfs_params["CQL_FILTER"] = f"INTERSECTS(the_geom, {geometry})"
        
        # Make WFS request
        print(f"DEBUG: Making WFS request with params: {wfs_params}")
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        print(f"DEBUG: WFS response status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                features = geo_json.get("features", [])
                print(f"DEBUG: Retrieved {len(features)} features")
                
                # Calculate pagination info
                total_pages = max(1, (total_features + page_size - 1) // page_size) if total_features > 0 else 1
                has_more = page < total_pages
                print(f"DEBUG: Pagination - total_features: {total_features}, total_pages: {total_pages}, current_page: {page}, has_more: {has_more}")
                
                return jsonify({
                    "features": features,
                    "pagination": {
                        "page": page,
                        "pageSize": page_size,
                        "totalFeatures": total_features,
                        "totalPages": total_pages,
                        "hasMore": has_more,
                        "startIndex": start_index,
                        "endIndex": start_index + len(features) - 1
                    }
                })
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



if __name__ == "__main__":
    print("Starting GIS API Server...")
    print(f"GeoServer URL: {GEOSERVER_BASE_URL}")
    print(f"WFS URL: {WFS_URL}")
    print("API will be available at: http://localhost:5000")
    print("Note: WMS calls go directly from frontend to GeoServer")
    print("\nAvailable endpoints:")
    print("  - GET  /api/layers")
    print("  - POST /api/spatial-query")
    print("  - GET  /api/features")
    print("  - GET  /api/performance")

    
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Failed to start server: {e}")
        print("Make sure port 5000 is not already in use") 