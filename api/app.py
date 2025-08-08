from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import requests
import json
import time
from datetime import datetime
import math as Math

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# GeoServer configuration
GEOSERVER_BASE_URL = "http://20.20.152.180:8181/geoserver"
WORKSPACE = "Picarro"
WFS_URL = f"{GEOSERVER_BASE_URL}/{WORKSPACE}/wfs"

# Available layers configuration
AVAILABLE_LAYERS = [
    {"id": "Picarro:Boundary", "name": "Boundary", "visible": True},
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
            layer_end_time = time.time()  # Initialize at the beginning
            
            # Try different geometry field names
            field_names = ["geom", "the_geom", "geometry"]  # Prioritize 'geom' as it worked before
            success = False
            
            for field_name in field_names:
                try:
                    # Prepare WFS request
                    wfs_params = {
                        "service": "WFS",
                        "version": "1.0.0",  # Use 1.0.0 as it works better with this GeoServer
                        "request": "GetFeature",
                        "typeName": layer_id,
                        "outputFormat": "application/json",
                        "maxFeatures": "1000",  # Get all features for spatial query
                        "CQL_FILTER": f"INTERSECTS({field_name}, {geometry})"
                    }
                    
                    # Make WFS request
                    print(f"DEBUG: Trying field '{field_name}' with params: {wfs_params}")
                    response = requests.get(WFS_URL, params=wfs_params, timeout=30)
                    print(f"DEBUG: Response status: {response.status_code}")
                    layer_end_time = time.time()  # Update after request
                    
                    if response.status_code == 200:
                        try:
                            geo_json = response.json()
                            features = geo_json.get("features", [])
                            print(f"DEBUG: Success with field '{field_name}' - found {len(features)} features")
                            
                            results[layer_id] = {
                                "success": True,
                                "features": features,
                                "count": len(features),
                                "loadTime": (layer_end_time - layer_start_time) * 1000,  # Convert to ms
                                "layerName": next((layer["name"] for layer in AVAILABLE_LAYERS if layer["id"] == layer_id), layer_id),
                                "field_used": field_name
                            }
                            success = True
                            break  # Found working field name
                        except json.JSONDecodeError as e:
                            print(f"DEBUG: JSON decode error with field '{field_name}': {e}")
                            continue  # Try next field name
                    else:
                        print(f"DEBUG: Failed with field '{field_name}' - HTTP {response.status_code}")
                        continue  # Try next field name
                        
                except requests.RequestException as e:
                    print(f"DEBUG: Request exception with field '{field_name}': {e}")
                    layer_end_time = time.time()  # Update on exception
                    continue  # Try next field name
            
            # If no field name worked, return error
            if not success:
                layer_end_time = time.time()  # Ensure it's updated
                results[layer_id] = {
                    "success": False,
                    "features": [],
                    "count": 0,
                    "loadTime": (layer_end_time - layer_start_time) * 1000,
                    "error": "No working geometry field found",
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

@app.route("/api/spatial-query-paginated", methods=["POST"])
def spatial_query_paginated():
    """Perform spatial query with pagination support"""
    try:
        data = request.get_json()
        geometry = data.get("geometry")  # WKT format
        layers = data.get("layers", [])  # List of layer IDs to query
        page = int(data.get("page", 1))
        page_size = int(data.get("pageSize", 100))
        start_index = (page - 1) * page_size
        
        if not geometry:
            return jsonify({"error": "Geometry (WKT) is required"}), 400
        
        if not layers:
            return jsonify({"error": "At least one layer is required"}), 400
        
        start_time = time.time()
        results = {}
        
        # Query each layer
        for layer_id in layers:
            layer_start_time = time.time()
            layer_end_time = time.time()  # Initialize at the beginning
            
            # Try different geometry field names
            field_names = ["geom", "the_geom", "geometry"]  # Prioritize 'geom' as it works
            success = False
            
            for field_name in field_names:
                try:
                    # First, get total count
                    count_params = {
                        "service": "WFS",
                        "version": "1.0.0",  # Use 1.0.0 as it works better with this GeoServer
                        "request": "GetFeature",
                        "typeName": layer_id,
                        "resultType": "hits",
                        "CQL_FILTER": f"INTERSECTS({field_name}, {geometry})"
                    }
                    
                    print(f"DEBUG: Getting count for spatial query with params: {count_params}")
                    count_response = requests.get(WFS_URL, params=count_params, timeout=30)
                    
                    if count_response.status_code == 200:
                        try:
                            count_text = count_response.text
                            print(f"DEBUG: Full count response text: {count_text}")
                            import re
                            
                            # Parse XML response to extract total count
                            # Look for numberOfFeatures attribute in FeatureCollection
                            number_match = re.search(r'numberOfFeatures="(\d+)"', count_text)
                            if number_match:
                                total_features = int(number_match.group(1))
                                print(f"DEBUG: Found numberOfFeatures: {total_features}")
                            else:
                                # Try to find numberOfFeatures without quotes
                                alt_match = re.search(r'numberOfFeatures=(\d+)', count_text)
                                if alt_match:
                                    total_features = int(alt_match.group(1))
                                    print(f"DEBUG: Found numberOfFeatures (no quotes): {total_features}")
                                else:
                                    # Try to find numberMatched attribute (WFS 2.0.0)
                                    matched_match = re.search(r'numberMatched="(\d+)"', count_text)
                                    if matched_match:
                                        total_features = int(matched_match.group(1))
                                        print(f"DEBUG: Found numberMatched: {total_features}")
                                    else:
                                        # Try to find numberMatched without quotes
                                        matched_alt_match = re.search(r'numberMatched=(\d+)', count_text)
                                        if matched_alt_match:
                                            total_features = int(matched_alt_match.group(1))
                                            print(f"DEBUG: Found numberMatched (no quotes): {total_features}")
                                        else:
                                            # Try to find numberReturned attribute
                                            returned_match = re.search(r'numberReturned="(\d+)"', count_text)
                                            if returned_match:
                                                total_features = int(returned_match.group(1))
                                                print(f"DEBUG: Found numberReturned: {total_features}")
                                            else:
                                                # Try to find numberReturned without quotes
                                                returned_alt_match = re.search(r'numberReturned=(\d+)', count_text)
                                                if returned_alt_match:
                                                    total_features = int(returned_alt_match.group(1))
                                                    print(f"DEBUG: Found numberReturned (no quotes): {total_features}")
                                                else:
                                                    print(f"DEBUG: No count found in XML response")
                                                    print(f"DEBUG: Full response: {count_text}")
                                                    total_features = 0
                            
                            if total_features > 0:
                                print(f"DEBUG: Spatial query found {total_features} total features")
                                
                                # Now get paginated features
                                wfs_params = {
                                    "service": "WFS",
                                    "version": "1.0.0",  # Use 1.0.0 as it works better with this GeoServer
                                    "request": "GetFeature",
                                    "typeName": layer_id,
                                    "outputFormat": "application/json",
                                    "maxFeatures": str(page_size),
                                    "startIndex": str(start_index),
                                    "CQL_FILTER": f"INTERSECTS({field_name}, {geometry})"
                                }
                                
                                print(f"DEBUG: Getting paginated features with params: {wfs_params}")
                                response = requests.get(WFS_URL, params=wfs_params, timeout=30)
                                layer_end_time = time.time()
                                
                                if response.status_code == 200:
                                    try:
                                        geo_json = response.json()
                                        features = geo_json.get("features", [])
                                        print(f"DEBUG: Success with field '{field_name}' - found {len(features)} features for page {page}")
                                        
                                        results[layer_id] = {
                                            "success": True,
                                            "features": features,
                                            "count": len(features),
                                            "totalFeatures": total_features,
                                            "totalPages": max(1, (total_features + page_size - 1) // page_size),
                                            "currentPage": page,
                                            "pageSize": page_size,
                                            "loadTime": (layer_end_time - layer_start_time) * 1000,
                                            "layerName": next((layer["name"] for layer in AVAILABLE_LAYERS if layer["id"] == layer_id), layer_id),
                                            "field_used": field_name
                                        }
                                        success = True
                                        break
                                    except json.JSONDecodeError as e:
                                        print(f"DEBUG: JSON decode error with field '{field_name}': {e}")
                                        continue
                                else:
                                    print(f"DEBUG: Failed with field '{field_name}' - HTTP {response.status_code}")
                                    continue
                            else:
                                print(f"DEBUG: Could not parse total count from response or total features is 0")
                                continue
                        except Exception as e:
                            print(f"DEBUG: Error parsing count response: {e}")
                            continue
                    else:
                        print(f"DEBUG: Count request failed with status: {count_response.status_code}")
                        continue
                        
                except requests.RequestException as e:
                    print(f"DEBUG: Request exception with field '{field_name}': {e}")
                    layer_end_time = time.time()
                    continue
            
            # If no field name worked, return error
            if not success:
                layer_end_time = time.time()
                results[layer_id] = {
                    "success": False,
                    "features": [],
                    "count": 0,
                    "loadTime": (layer_end_time - layer_start_time) * 1000,
                    "error": "No working geometry field found",
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
        
        # Always get total count if we don't have it
        total_features = 0
        if get_total_count:
            # Use a more reliable approach: get all features and count them
            count_params = {
                "service": "WFS",
                "version": "1.0.0",  # Use 1.0.0 as it works better with this GeoServer
                "request": "GetFeature",
                "typeName": layer_id,
                "outputFormat": "application/json",
                "maxFeatures": "10000"  # Get up to 10000 features to count
            }
            
            # Add spatial filter if geometry provided
            if geometry and geometry != "1=1":
                count_params["CQL_FILTER"] = f"INTERSECTS(the_geom, {geometry})"  # Use 'the_geom' as it's the correct field name
            
            print(f"DEBUG: Making count request to GeoServer with params: {count_params}")
            count_response = requests.get(WFS_URL, params=count_params, timeout=30)
            print(f"DEBUG: Count response status: {count_response.status_code}")
            
            if count_response.status_code == 200:
                try:
                    count_data = count_response.json()
                    features = count_data.get("features", [])
                    total_features = len(features)
                    print(f"DEBUG: Found {total_features} features by counting actual features")
                except Exception as e:
                    print(f"DEBUG: Error parsing count response: {e}")
                    total_features = 0
            else:
                print(f"DEBUG: Count request failed with status: {count_response.status_code}")
                print(f"DEBUG: Count response text: {count_response.text}")
        
        # If we don't have total_features, we need to get it for pagination info
        if total_features == 0:
            # Make a count request to get total features for pagination
            count_params = {
                "service": "WFS",
                "version": "1.0.0",  # Use 1.0.0 as it works better with this GeoServer
                "request": "GetFeature",
                "typeName": layer_id,
                "outputFormat": "application/json",
                "maxFeatures": "10000"  # Get up to 10000 features to count
            }
            
            # Add spatial filter if geometry provided
            if geometry and geometry != "1=1":
                count_params["CQL_FILTER"] = f"INTERSECTS(the_geom, {geometry})"  # Use 'the_geom' as it's the correct field name
            
            try:
                count_response = requests.get(WFS_URL, params=count_params, timeout=10)
                if count_response.status_code == 200:
                    count_data = count_response.json()
                    features = count_data.get("features", [])
                    total_features = len(features)
                    print(f"DEBUG: Got total_features for pagination: {total_features}")
                else:
                    print(f"DEBUG: Count request failed with status: {count_response.status_code}")
                    total_features = 0
            except Exception as e:
                print(f"DEBUG: Error getting total count for pagination: {e}")
                total_features = 0
        
        # Prepare WFS request
        wfs_params = {
            "service": "WFS",
            "version": "1.0.0",  # Use 1.0.0 as it works better with this GeoServer
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": str(page_size), # Use page_size for maxFeatures
            "startIndex": str(start_index),
            "CQL_FILTER": "1=1"  # Default filter to show all features
        }
        
        # Add spatial filter if geometry provided
        if geometry and geometry != "1=1":
            wfs_params["CQL_FILTER"] = f"INTERSECTS(the_geom, {geometry})"  # Use 'the_geom' as it's the correct field name
        
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
            except json.JSONDecodeError as e:
                print(f"DEBUG: JSON decode error: {e}")
                print(f"DEBUG: Response text: {response.text[:500]}...")
                return jsonify({"error": f"Invalid JSON response from GeoServer: {str(e)}"}), 500
        else:
            print(f"DEBUG: WFS request failed with status: {response.status_code}")
            print(f"DEBUG: Response text: {response.text[:500]}...")
            return jsonify({"error": f"WFS request failed: HTTP {response.status_code} - {response.text[:200]}"}), 500
            
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

@app.route("/api/test-layer", methods=["GET"])
def test_layer():
    """Test endpoint to check layer structure and available fields"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Make a simple WFS request to get one feature and see the structure
        wfs_params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": "1"
        }
        
        print(f"DEBUG: Testing layer structure with params: {wfs_params}")
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        print(f"DEBUG: Test response status: {response.status_code}")
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                features = geo_json.get("features", [])
                if features:
                    feature = features[0]
                    properties = feature.get("properties", {})
                    geometry = feature.get("geometry", {})
                    
                    print(f"DEBUG: Feature properties: {list(properties.keys())}")
                    print(f"DEBUG: Geometry type: {geometry.get('type')}")
                    
                    # Print actual coordinates to see coordinate system
                    if geometry.get("type") == "MultiPolygon":
                        coords = geometry.get("coordinates", [])
                        if coords and coords[0] and coords[0][0]:
                            print(f"DEBUG: First polygon coordinates: {coords[0][0][:5]}...")  # First 5 coordinates
                    
                    return jsonify({
                        "success": True,
                        "properties": list(properties.keys()),
                        "geometry_type": geometry.get("type"),
                        "sample_feature": feature,
                        "coordinates_sample": coords[0][0][:5] if geometry.get("type") == "MultiPolygon" and coords and coords[0] and coords[0][0] else None
                    })
                else:
                    return jsonify({"success": False, "error": "No features found"})
            except json.JSONDecodeError as e:
                return jsonify({"success": False, "error": f"Invalid JSON: {str(e)}", "response": response.text[:500]})
        else:
            return jsonify({"success": False, "error": f"HTTP {response.status_code}", "response": response.text[:500]})
            
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-spatial", methods=["GET"])
def test_spatial():
    """Test spatial query with a simple bounding box"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Use a simple bounding box for testing
        test_geometry = "POLYGON((-122.1 37.4, -122.0 37.4, -122.0 37.5, -122.1 37.5, -122.1 37.4))"
        
        # Test with different geometry field names
        field_names = ["the_geom", "geom", "geometry"]
        
        results = {}
        
        for field_name in field_names:
            wfs_params = {
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "typeName": layer_id,
                "outputFormat": "application/json",
                "maxFeatures": "10",
                "CQL_FILTER": f"INTERSECTS({field_name}, {test_geometry})"
            }
            
            print(f"DEBUG: Testing with field '{field_name}' and params: {wfs_params}")
            response = requests.get(WFS_URL, params=wfs_params, timeout=30)
            
            if response.status_code == 200:
                try:
                    geo_json = response.json()
                    features = geo_json.get("features", [])
                    results[field_name] = {
                        "success": True,
                        "count": len(features),
                        "features": features[:2]  # Just first 2 features for debugging
                    }
                except json.JSONDecodeError:
                    results[field_name] = {
                        "success": False,
                        "error": "Invalid JSON response",
                        "response": response.text[:200]
                    }
            else:
                results[field_name] = {
                    "success": False,
                    "error": f"HTTP {response.status_code}",
                    "response": response.text[:200]
                }
        
        return jsonify({
            "test_geometry": test_geometry,
            "results": results
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-large-area", methods=["GET"])
def test_large_area():
    """Test spatial query with a larger area to see if we can find any features"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Use a much larger bounding box for testing
        test_geometry = "POLYGON((-122.5 37.0, -121.5 37.0, -121.5 38.0, -122.5 38.0, -122.5 37.0))"
        
        wfs_params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": "10",
            "CQL_FILTER": f"INTERSECTS(the_geom, {test_geometry})"
        }
        
        print(f"DEBUG: Testing large area with params: {wfs_params}")
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                features = geo_json.get("features", [])
                return jsonify({
                    "success": True,
                    "count": len(features),
                    "features": features[:2]  # Just first 2 features for debugging
                })
            except json.JSONDecodeError:
                return jsonify({
                    "success": False,
                    "error": "Invalid JSON response",
                    "response": response.text[:200]
                })
        else:
            return jsonify({
                "success": False,
                "error": f"HTTP {response.status_code}",
                "response": response.text[:200]
            })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-coordinates", methods=["GET"])
def test_coordinates():
    """Test coordinate transformation and spatial query with different coordinate systems"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Test coordinates in both EPSG:4326 and EPSG:3857
        test_cases = {
            "epsg_4326": "POLYGON((-122.1 37.4, -122.0 37.4, -122.0 37.5, -122.1 37.5, -122.1 37.4))",
            "epsg_3857": "POLYGON((-13600000 4500000, -13580000 4500000, -13580000 4520000, -13600000 4520000, -13600000 4500000))"
        }
        
        results = {}
        
        for coord_system, geometry in test_cases.items():
            wfs_params = {
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "typeName": layer_id,
                "outputFormat": "application/json",
                "maxFeatures": "5",
                "CQL_FILTER": f"INTERSECTS(the_geom, {geometry})"
            }
            
            print(f"DEBUG: Testing {coord_system} with params: {wfs_params}")
            response = requests.get(WFS_URL, params=wfs_params, timeout=30)
            
            if response.status_code == 200:
                try:
                    geo_json = response.json()
                    features = geo_json.get("features", [])
                    results[coord_system] = {
                        "success": True,
                        "count": len(features),
                        "geometry": geometry
                    }
                except json.JSONDecodeError:
                    results[coord_system] = {
                        "success": False,
                        "error": "Invalid JSON response",
                        "geometry": geometry
                    }
            else:
                results[coord_system] = {
                    "success": False,
                    "error": f"HTTP {response.status_code}",
                    "geometry": geometry
                }
        
        return jsonify({
            "test_cases": results,
            "note": "EPSG:4326 should work, EPSG:3857 might fail if GeoServer expects 4326"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-extent", methods=["GET"])
def test_extent():
    """Test with a very large area to see if we can find any features"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Use a very large bounding box that should cover most of California
        test_geometry = "POLYGON((-125.0 32.0, -114.0 32.0, -114.0 42.0, -125.0 42.0, -125.0 32.0))"
        
        wfs_params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": "10",
            "CQL_FILTER": f"INTERSECTS(the_geom, {test_geometry})"
        }
        
        print(f"DEBUG: Testing large extent with params: {wfs_params}")
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                features = geo_json.get("features", [])
                
                # If we find features, let's check their coordinates
                if features:
                    print(f"DEBUG: Found {len(features)} features in large extent")
                    for i, feature in enumerate(features[:3]):  # Check first 3 features
                        geometry = feature.get("geometry", {})
                        if geometry.get("type") == "MultiPolygon":
                            coords = geometry.get("coordinates", [])
                            if coords and coords[0] and coords[0][0]:
                                # Get first coordinate of first polygon
                                first_coord = coords[0][0][0]
                                print(f"DEBUG: Feature {i+1} first coordinate: {first_coord}")
                
                return jsonify({
                    "success": True,
                    "count": len(features),
                    "test_geometry": test_geometry,
                    "features": features[:2]  # Just first 2 features for debugging
                })
            except json.JSONDecodeError:
                return jsonify({
                    "success": False,
                    "error": "Invalid JSON response",
                    "response": response.text[:200]
                })
        else:
            return jsonify({
                "success": False,
                "error": f"HTTP {response.status_code}",
                "response": response.text[:200]
            })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-correct-area", methods=["GET"])
def test_correct_area():
    """Test with a polygon that should intersect with the actual features"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Use coordinates that should intersect with the actual features
        # Based on the coordinates we found: -122.01028502, 37.4351867 to -121.92562039, 37.39958956
        test_geometry = "POLYGON((-122.1 37.4, -121.9 37.4, -121.9 37.5, -122.1 37.5, -122.1 37.4))"
        
        wfs_params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": "10",
            "CQL_FILTER": f"INTERSECTS(the_geom, {test_geometry})"
        }
        
        print(f"DEBUG: Testing correct area with params: {wfs_params}")
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                features = geo_json.get("features", [])
                return jsonify({
                    "success": True,
                    "count": len(features),
                    "test_geometry": test_geometry,
                    "features": features[:2]  # Just first 2 features for debugging
                })
            except json.JSONDecodeError:
                return jsonify({
                    "success": False,
                    "error": "Invalid JSON response",
                    "response": response.text[:200]
                })
        else:
            return jsonify({
                "success": False,
                "error": f"HTTP {response.status_code}",
                "response": response.text[:200]
            })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-geometry-field", methods=["GET"])
def test_geometry_field():
    """Test to find the correct geometry field name"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Get a feature without any filter to see its structure
        wfs_params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": "1"
        }
        
        print(f"DEBUG: Testing geometry field with params: {wfs_params}")
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                features = geo_json.get("features", [])
                if features:
                    feature = features[0]
                    properties = feature.get("properties", {})
                    
                    # Look for geometry-related fields in properties
                    geometry_fields = [key for key in properties.keys() if 'geom' in key.lower() or 'geometry' in key.lower()]
                    
                    print(f"DEBUG: All properties: {list(properties.keys())}")
                    print(f"DEBUG: Geometry-related fields: {geometry_fields}")
                    
                    return jsonify({
                        "success": True,
                        "all_properties": list(properties.keys()),
                        "geometry_fields": geometry_fields,
                        "sample_feature": feature
                    })
                else:
                    return jsonify({"success": False, "error": "No features found"})
            except json.JSONDecodeError:
                return jsonify({
                    "success": False,
                    "error": "Invalid JSON response",
                    "response": response.text[:200]
                })
        else:
            return jsonify({
                "success": False,
                "error": f"HTTP {response.status_code}",
                "response": response.text[:200]
            })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-spatial-approaches", methods=["GET"])
def test_spatial_approaches():
    """Test different spatial query approaches"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Test different approaches
        approaches = {
            "the_geom_intersects": f"INTERSECTS(the_geom, POLYGON((-122.1 37.4, -121.9 37.4, -121.9 37.5, -122.1 37.5, -122.1 37.4)))",
            "geom_intersects": f"INTERSECTS(geom, POLYGON((-122.1 37.4, -121.9 37.4, -121.9 37.5, -122.1 37.5, -122.1 37.4)))",
            "geometry_intersects": f"INTERSECTS(geometry, POLYGON((-122.1 37.4, -121.9 37.4, -121.9 37.5, -122.1 37.5, -122.1 37.4)))",
            "bbox": "BBOX(the_geom, -122.1, 37.4, -121.9, 37.5)",
            "bbox_geom": "BBOX(geom, -122.1, 37.4, -121.9, 37.5)",
            "no_filter": "1=1"
        }
        
        results = {}
        
        for approach_name, filter_expr in approaches.items():
            wfs_params = {
                "service": "WFS",
                "version": "1.1.0",
                "request": "GetFeature",
                "typeName": layer_id,
                "outputFormat": "application/json",
                "maxFeatures": "5"
            }
            
            if filter_expr != "1=1":
                wfs_params["CQL_FILTER"] = filter_expr
            
            print(f"DEBUG: Testing {approach_name} with params: {wfs_params}")
            response = requests.get(WFS_URL, params=wfs_params, timeout=30)
            
            if response.status_code == 200:
                try:
                    geo_json = response.json()
                    features = geo_json.get("features", [])
                    results[approach_name] = {
                        "success": True,
                        "count": len(features),
                        "filter": filter_expr
                    }
                except json.JSONDecodeError:
                    results[approach_name] = {
                        "success": False,
                        "error": "Invalid JSON response",
                        "filter": filter_expr
                    }
            else:
                results[approach_name] = {
                    "success": False,
                    "error": f"HTTP {response.status_code}",
                    "filter": filter_expr
                }
        
        return jsonify({
            "test_results": results,
            "note": "Check which approach returns features"
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/test-huge-area", methods=["GET"])
def test_huge_area():
    """Test with a huge area that should definitely contain the features"""
    try:
        layer_id = request.args.get("layer", "Picarro:Boundary")
        
        # Use a huge area that should definitely contain the features
        # Based on the coordinates we found: around -122.0, 37.4
        test_geometry = "POLYGON((-123.0 36.0, -120.0 36.0, -120.0 39.0, -123.0 39.0, -123.0 36.0))"
        
        wfs_params = {
            "service": "WFS",
            "version": "1.1.0",
            "request": "GetFeature",
            "typeName": layer_id,
            "outputFormat": "application/json",
            "maxFeatures": "10",
            "CQL_FILTER": f"INTERSECTS(the_geom, {test_geometry})"
        }
        
        print(f"DEBUG: Testing huge area with params: {wfs_params}")
        response = requests.get(WFS_URL, params=wfs_params, timeout=30)
        
        if response.status_code == 200:
            try:
                geo_json = response.json()
                features = geo_json.get("features", [])
                return jsonify({
                    "success": True,
                    "count": len(features),
                    "test_geometry": test_geometry,
                    "features": features[:2]  # Just first 2 features for debugging
                })
            except json.JSONDecodeError:
                return jsonify({
                    "success": False,
                    "error": "Invalid JSON response",
                    "response": response.text[:200]
                })
        else:
            return jsonify({
                "success": False,
                "error": f"HTTP {response.status_code}",
                "response": response.text[:200]
            })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500


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