from flask import Flask, request, Response
import requests
import urllib.parse

app = Flask(__name__)

# GeoServer WMS endpoint
WMS_URL = "http://20.20.152.180:8181/geoserver/Picarro/wms"
LAYER_NAME = "Picarro:Boundary"  # Updated to match the Picarro workspace

@app.route("/", methods=["GET"])
def health_check():
    """
    Health check endpoint to test if API server is running
    """
    return {
        "status": "ok",
        "message": "Flask API server is running",
        "wms_url": WMS_URL,
        "layer_name": LAYER_NAME,
        "endpoints": [
            "/test-wms",
            "/wms-layers", 
            "/wms-filter",
            "/wms-features"
        ]
    }

@app.route("/wms-capabilities", methods=["GET"])
def wms_capabilities():
    """
    Get WMS capabilities to discover available layers
    """
    params = {
        "service": "WMS",
        "version": "1.1.1",
        "request": "GetCapabilities"
    }
    
    response = requests.get(WMS_URL, params=params)
    
    if response.status_code != 200:
        return {"error": "Failed to get WMS capabilities", "details": response.text}, 500
    
    return Response(response.content, content_type="application/xml")

@app.route("/wms-layers", methods=["GET"])
def wms_layers():
    """
    Get list of available layers from the WMS service
    """
    try:
        params = {
            "service": "WMS",
            "version": "1.1.1",
            "request": "GetCapabilities"
        }
        
        print(f"Requesting WMS capabilities from: {WMS_URL}")
        response = requests.get(WMS_URL, params=params, timeout=10)
        
        print(f"WMS response status: {response.status_code}")
        print(f"WMS response content type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code != 200:
            print(f"WMS request failed with status {response.status_code}")
            print(f"Response content: {response.text[:200]}...")
            # Return default layers if WMS service is not available
            default_layers = [
                {"name": "Picarro:Boundary", "title": "Boundary"},
                {"name": "Picarro:OtherLayer", "title": "Other Layer"}
            ]
            return {"layers": default_layers}
        
        # Check if response is HTML (error page)
        if response.text.strip().startswith('<!DOCTYPE') or response.text.strip().startswith('<html'):
            print("WMS returned HTML instead of XML, likely an error page")
            print(f"Response content: {response.text[:500]}...")
            # Return default layers if WMS returns HTML
            default_layers = [
                {"name": "Picarro:Boundary", "title": "Boundary"},
                {"name": "Picarro:OtherLayer", "title": "Other Layer"}
            ]
            return {"layers": default_layers}
        
        # Parse the XML to extract layer names
        import xml.etree.ElementTree as ET
        try:
            root = ET.fromstring(response.content)
            layers = []
            
            # Find all Layer elements
            for layer in root.findall('.//{http://www.opengis.net/wms}Layer'):
                name_elem = layer.find('{http://www.opengis.net/wms}Name')
                title_elem = layer.find('{http://www.opengis.net/wms}Title')
                
                if name_elem is not None:
                    layer_info = {
                        "name": name_elem.text,
                        "title": title_elem.text if title_elem is not None else name_elem.text
                    }
                    layers.append(layer_info)
                    print(f"Found layer: {layer_info}")
            
            # If no layers found, return default
            if not layers:
                print("No layers found in WMS capabilities, using defaults")
                layers = [
                    {"name": "Picarro:Boundary", "title": "Boundary"},
                    {"name": "Picarro:OtherLayer", "title": "Other Layer"}
                ]
            
            print(f"Returning {len(layers)} layers")
            return {"layers": layers}
        except ET.ParseError as e:
            print(f"XML Parse Error: {e}")
            print(f"Response content: {response.text[:500]}...")
            # Return default layers if XML parsing fails
            default_layers = [
                {"name": "Picarro:Boundary", "title": "Boundary"},
                {"name": "Picarro:OtherLayer", "title": "Other Layer"}
            ]
            return {"layers": default_layers}
            
    except requests.RequestException as e:
        print(f"Request Error: {e}")
        # Return default layers if request fails
        default_layers = [
            {"name": "Picarro:Boundary", "title": "Boundary"},
            {"name": "Picarro:OtherLayer", "title": "Other Layer"}
        ]
        return {"layers": default_layers}
    except Exception as e:
        print(f"Unexpected Error: {e}")
        # Return default layers for any other error
        default_layers = [
            {"name": "Picarro:Boundary", "title": "Boundary"},
            {"name": "Picarro:OtherLayer", "title": "Other Layer"}
        ]
        return {"layers": default_layers}

@app.route("/test-wms", methods=["GET"])
def test_wms():
    """
    Test WMS service connectivity by requesting a small test image
    """
    try:
        # Request a small test image from WMS
        params = {
            "service": "WMS",
            "version": "1.1.1",
            "request": "GetMap",
            "layers": LAYER_NAME,
            "styles": "",
            "bbox": "-9579361.948849378,37.38026292560847,-9579361.935609717,37.394227234056444",
            "width": 256,
            "height": 256,
            "srs": "EPSG:4326",
            "format": "image/png",
            "TRANSPARENT": "true"
        }
        
        print(f"Testing WMS connectivity to: {WMS_URL}")
        response = requests.get(WMS_URL, params=params, timeout=10)
        
        print(f"WMS test response status: {response.status_code}")
        print(f"WMS test response content type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code == 200:
            # Check if response is actually an image
            content_type = response.headers.get('content-type', '')
            if 'image' in content_type:
                print("WMS test successful - received image")
                return Response(response.content, content_type="image/png")
            else:
                print(f"WMS returned non-image content: {content_type}")
                return {"error": f"WMS returned non-image content: {content_type}"}, 500
        else:
            print(f"WMS test failed with status {response.status_code}")
            return {"error": f"WMS request failed with status {response.status_code}"}, 500
        
    except requests.RequestException as e:
        print(f"WMS test network error: {e}")
        return {"error": f"Network error: {str(e)}"}, 500
    except Exception as e:
        print(f"WMS test error: {e}")
        return {"error": str(e)}, 500


@app.route("/wms-filter", methods=["GET"])
def wms_filter():
    """
    Example:
    /wms-filter?bbox=-100,30,-90,40
    or
    /wms-filter?wkt=POLYGON((-100 30, -90 30, -90 40, -100 40, -100 30))
    or
    /wms-filter?bbox=-100,30,-90,40&layer=Picarro:OtherLayer
    """

    bbox = request.args.get("bbox")
    wkt = request.args.get("wkt")
    layer = request.args.get("layer", LAYER_NAME)  # Allow specifying different layers

    print(f"WMS Filter request - bbox: {bbox}, wkt: {wkt}, layer: {layer}")

    if bbox:
        try:
            minx, miny, maxx, maxy = map(float, bbox.split(","))
            wkt = f"POLYGON(({minx} {miny}, {maxx} {miny}, {maxx} {maxy}, {minx} {maxy}, {minx} {miny}))"
            bbox_str = f"{minx},{miny},{maxx},{maxy}"
            print(f"Generated WKT from bbox: {wkt}")
        except ValueError:
            return {"error": "Invalid bbox format"}, 400
    elif wkt:
        # if you use WKT, you still need a BBOX for the map extent
        # calculate your own or provide via another param
        return {"error": "BBOX is required when using WKT"}, 400
    else:
        return {"error": "Provide 'bbox' or 'wkt'"}, 400

    # Build CQL filter to get only intersecting features
    cql_filter = f"INTERSECTS(geom, {wkt})"
    print(f"CQL Filter: {cql_filter}")

    # Prepare WMS GetMap parameters
    params = {
        "service": "WMS",
        "version": "1.1.1",
        "request": "GetMap",
        "layers": layer,
        "styles": "",
        "bbox": bbox_str,
        "width": 800,
        "height": 600,
        "srs": "EPSG:4326",
        "format": "image/png",
        "CQL_FILTER": cql_filter,
        "TRANSPARENT": "true"  # Make background transparent
    }

    print(f"WMS request parameters: {params}")

    try:
        # Make request to GeoServer
        print(f"Making WMS request to: {WMS_URL}")
        response = requests.get(WMS_URL, params=params, timeout=30)
        
        print(f"WMS response status: {response.status_code}")
        print(f"WMS response content type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code != 200:
            print(f"WMS request failed with status {response.status_code}")
            print(f"WMS response content: {response.text[:500]}...")
            
            # Try without CQL filter as fallback
            print("Trying without CQL filter as fallback...")
            params_without_filter = params.copy()
            del params_without_filter['CQL_FILTER']
            
            response = requests.get(WMS_URL, params=params_without_filter, timeout=30)
            if response.status_code != 200:
                return {"error": "WMS request failed", "details": response.text}, 500
            else:
                print("WMS request successful without CQL filter")
                return Response(response.content, content_type="image/png")

        # Return image from GeoServer as response
        print(f"WMS request successful with CQL filter, returning image")
        return Response(response.content, content_type="image/png")
        
    except requests.RequestException as e:
        print(f"WMS Request Error: {e}")
        return {"error": f"Network error: {str(e)}"}, 500
    except Exception as e:
        print(f"WMS Unexpected Error: {e}")
        return {"error": f"Unexpected error: {str(e)}"}, 500

@app.route("/wms-proxy", methods=["GET"])
def wms_proxy():
    """
    Flexible WMS proxy that forwards all parameters to the WMS service
    Example: /wms-proxy?layers=Picarro:Boundary&bbox=-100,30,-90,40&width=800&height=600
    """
    # Get all query parameters from the request
    params = dict(request.args)
    
    # Add required WMS parameters if not provided
    if 'service' not in params:
        params['service'] = 'WMS'
    if 'version' not in params:
        params['version'] = '1.1.1'
    if 'request' not in params:
        params['request'] = 'GetMap'
    if 'format' not in params:
        params['format'] = 'image/png'
    if 'srs' not in params:
        params['srs'] = 'EPSG:4326'
    
    # Make request to GeoServer
    response = requests.get(WMS_URL, params=params)
    
    if response.status_code != 200:
        return {"error": "WMS request failed", "details": response.text}, 500
    
    # Return the response with appropriate content type
    content_type = response.headers.get('content-type', 'image/png')
    return Response(response.content, content_type=content_type)

@app.route("/wms-features", methods=["GET"])
def wms_features():
    """
    Get GeoJSON features that intersect with the provided geometry
    Example: /wms-features?bbox=-100,30,-90,40&layer=Picarro:Boundary
    """
    bbox = request.args.get("bbox")
    wkt = request.args.get("wkt")
    layer = request.args.get("layer", LAYER_NAME)

    print(f"WFS Features request - bbox: {bbox}, wkt: {wkt}, layer: {layer}")

    if bbox:
        try:
            minx, miny, maxx, maxy = map(float, bbox.split(","))
            wkt = f"POLYGON(({minx} {miny}, {maxx} {miny}, {maxx} {maxy}, {minx} {maxy}, {minx} {miny}))"
            print(f"Generated WKT from bbox: {wkt}")
        except ValueError:
            return {"error": "Invalid bbox format"}, 400
    elif wkt:
        print(f"Using provided WKT: {wkt}")
        pass  # Use provided WKT
    else:
        return {"error": "Provide 'bbox' or 'wkt'"}, 400

    # Build CQL filter to get only intersecting features
    cql_filter = f"INTERSECTS(geom, {wkt})"
    print(f"CQL Filter: {cql_filter}")

    # Prepare WFS GetFeature parameters
    wfs_url = WMS_URL.replace('/wms', '/wfs')
    print(f"WFS URL: {wfs_url}")
    
    params = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": layer,
        "outputFormat": "application/json",
        "CQL_FILTER": cql_filter,
        "srsName": "EPSG:4326"
    }
    
    print(f"WFS request parameters: {params}")

    try:
        # Make request to GeoServer WFS
        print(f"Making WFS request to: {wfs_url}")
        response = requests.get(wfs_url, params=params, timeout=30)
        
        print(f"WFS response status: {response.status_code}")
        print(f"WFS response content type: {response.headers.get('content-type', 'unknown')}")
        
        if response.status_code != 200:
            print(f"WFS request failed with status {response.status_code}")
            print(f"WFS response content: {response.text[:500]}...")
            return {"error": "WFS request failed", "details": response.text}, 500

        # Check if response is valid JSON
        try:
            json_data = response.json()
            print(f"WFS returned valid JSON with {len(json_data.get('features', []))} features")
            return Response(response.content, content_type="application/json")
        except ValueError as e:
            print(f"WFS response is not valid JSON: {e}")
            print(f"WFS response content: {response.text[:500]}...")
            return {"error": "WFS response is not valid JSON", "details": response.text}, 500
        
    except requests.RequestException as e:
        print(f"WFS Request Error: {e}")
        return {"error": f"Network error: {str(e)}"}, 500
    except Exception as e:
        print(f"WFS Unexpected Error: {e}")
        return {"error": f"Unexpected error: {str(e)}"}, 500


if __name__ == "__main__":
    print("Starting Flask API server...")
    print("API will be available at: http://localhost:5000")
    print("WMS URL: http://20.20.152.180:8181/geoserver/Picarro/wms")
    print("Test endpoints:")
    print("  - GET http://localhost:5000/test-wms")
    print("  - GET http://localhost:5000/wms-layers")
    print("  - GET http://localhost:5000/wms-filter")
    print("  - GET http://localhost:5000/wms-features")
    print("\nMake sure the React app is running on http://localhost:3000")
    print("The React app will proxy /api requests to this Flask server")
    
    try:
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        print(f"Failed to start Flask server: {e}")
        print("Make sure port 5000 is not already in use")
        print("You can kill existing processes with: lsof -ti:5000 | xargs kill -9")
