import requests

def test_count_request():
    """Test the WFS count request directly with different field names"""
    
    # Test geometry
    geometry = "POLYGON((-121.925610 37.347756,-121.905785 37.364841,-121.889822 37.339264,-121.922521 37.337934,-121.925610 37.347756))"
    
    # Test different field names
    field_names = ["the_geom", "geom", "geometry"]
    
    WFS_URL = "http://20.20.152.180:8181/geoserver/Picarro/wfs"
    
    for field_name in field_names:
        print(f"\n=== Testing field: {field_name} ===")
        
        # Test parameters
        count_params = {
            "service": "WFS",
            "version": "1.0.0",
            "request": "GetFeature",
            "typeName": "Picarro:Boundary",
            "resultType": "hits",
            "CQL_FILTER": f"INTERSECTS({field_name}, {geometry})"
        }
        
        try:
            print("Making count request with params:", count_params)
            response = requests.get(WFS_URL, params=count_params, timeout=30)
            
            print(f"Response status: {response.status_code}")
            print("Response text:")
            print(response.text)
            
            # Try to parse the count
            import re
            number_match = re.search(r'numberOfFeatures="(\d+)"', response.text)
            if number_match:
                count = int(number_match.group(1))
                print(f"Found numberOfFeatures: {count}")
            else:
                print("No numberOfFeatures found in response")
            
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    test_count_request()
