import requests

def test_count_request():
    """Test the WFS count request directly with different field names"""
    
    WFS_URL = "http://20.20.152.180:8181/geoserver/Picarro/wfs"
    
    # Test different approaches to get count
    print("=== Testing different count approaches ===")
    
    # Approach 1: resultType=hits
    print("\n--- Approach 1: resultType=hits ---")
    count_params_1 = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": "Picarro:Boundary",
        "resultType": "hits"
    }
    
    try:
        response = requests.get(WFS_URL, params=count_params_1, timeout=30)
        print(f"Response status: {response.status_code}")
        import re
        number_match = re.search(r'numberOfFeatures="(\d+)"', response.text)
        if number_match:
            count = int(number_match.group(1))
            print(f"Found numberOfFeatures: {count}")
        else:
            print("No numberOfFeatures found")
    except Exception as e:
        print(f"Error: {e}")
    
    # Approach 2: maxFeatures=0
    print("\n--- Approach 2: maxFeatures=0 ---")
    count_params_2 = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": "Picarro:Boundary",
        "outputFormat": "application/json",
        "maxFeatures": "0"
    }
    
    try:
        response = requests.get(WFS_URL, params=count_params_2, timeout=30)
        print(f"Response status: {response.status_code}")
        if response.status_code == 200:
            try:
                data = response.json()
                features = data.get("features", [])
                print(f"Found {len(features)} features")
                # Check if there's a total count in the response
                if "totalFeatures" in data:
                    print(f"Total features: {data['totalFeatures']}")
            except Exception as e:
                print(f"Error parsing JSON: {e}")
    except Exception as e:
        print(f"Error: {e}")
    
    # Approach 3: Get all features and count them
    print("\n--- Approach 3: Get all features and count ---")
    count_params_3 = {
        "service": "WFS",
        "version": "1.0.0",
        "request": "GetFeature",
        "typeName": "Picarro:Boundary",
        "outputFormat": "application/json",
        "maxFeatures": "1000"  # Get up to 1000 features
    }
    
    try:
        response = requests.get(WFS_URL, params=count_params_3, timeout=30)
        print(f"Response status: {response.status_code}")
        if response.status_code == 200:
            try:
                data = response.json()
                features = data.get("features", [])
                print(f"Found {len(features)} features")
                if features:
                    print("First feature properties:", list(features[0].get("properties", {}).keys()))
            except Exception as e:
                print(f"Error parsing JSON: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_count_request()
