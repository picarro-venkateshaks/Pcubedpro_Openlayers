import requests
import json

def test_spatial_query():
    """Test the regular spatial query endpoint first"""
    
    # Test geometry (the one that was working before)
    geometry = "POLYGON((-121.925610 37.347756,-121.905785 37.364841,-121.889822 37.339264,-121.922521 37.337934,-121.925610 37.347756))"
    
    # Test data
    test_data = {
        "geometry": geometry,
        "layers": ["Picarro:Boundary"]
    }
    
    try:
        # Make the request
        response = requests.post(
            "http://localhost:5000/api/spatial-query",
            headers={"Content-Type": "application/json"},
            data=json.dumps(test_data),
            timeout=30
        )
        
        print(f"Regular spatial query response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Regular spatial query response data:")
            print(json.dumps(data, indent=2))
            
            # Check if we got results
            if data.get("success"):
                results = data.get("results", {})
                for layer_id, result in results.items():
                    if result.get("success"):
                        print(f"\nLayer {layer_id}:")
                        print(f"  Features found: {result.get('count', 0)}")
                        print(f"  Field used: {result.get('field_used', 'Unknown')}")
                    else:
                        print(f"\nLayer {layer_id} failed: {result.get('error', 'Unknown error')}")
            else:
                print("Request failed")
        else:
            print(f"Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

def test_spatial_query_paginated():
    """Test the spatial query paginated endpoint"""
    
    # Test geometry (the one that was working before)
    geometry = "POLYGON((-121.925610 37.347756,-121.905785 37.364841,-121.889822 37.339264,-121.922521 37.337934,-121.925610 37.347756))"
    
    # Test data
    test_data = {
        "geometry": geometry,
        "layers": ["Picarro:Boundary"],
        "page": 1,
        "pageSize": 100
    }
    
    try:
        # Make the request
        response = requests.post(
            "http://localhost:5000/api/spatial-query-paginated",
            headers={"Content-Type": "application/json"},
            data=json.dumps(test_data),
            timeout=30
        )
        
        print(f"\nPaginated spatial query response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("Paginated spatial query response data:")
            print(json.dumps(data, indent=2))
            
            # Check if we got results
            if data.get("success"):
                results = data.get("results", {})
                for layer_id, result in results.items():
                    if result.get("success"):
                        print(f"\nLayer {layer_id}:")
                        print(f"  Features found: {result.get('count', 0)}")
                        print(f"  Total features: {result.get('totalFeatures', 0)}")
                        print(f"  Total pages: {result.get('totalPages', 0)}")
                        print(f"  Current page: {result.get('currentPage', 0)}")
                        print(f"  Page size: {result.get('pageSize', 0)}")
                        print(f"  Field used: {result.get('field_used', 'Unknown')}")
                    else:
                        print(f"\nLayer {layer_id} failed: {result.get('error', 'Unknown error')}")
            else:
                print("Request failed")
        else:
            print(f"Request failed with status {response.status_code}")
            print(f"Response: {response.text}")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_spatial_query()
    test_spatial_query_paginated()
