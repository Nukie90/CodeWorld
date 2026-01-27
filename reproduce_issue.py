
import json
import urllib.request
import urllib.error

def test_get_function_code():
    url = "http://127.0.0.1:8000/api/repo/function-code"
    
    # "repo_url": "Nukie90/CodeWorld" is a valid short spec.
    # The file path in the repo structure for CodeWorld seems to be 'backend/app/utils/normalize.py'
    # relative to the repo root.
    
    payload = {
        "repo_url": "Nukie90/CodeWorld", 
        "filename": "backend/app/utils/normalize.py",
        "function_name": "normalize_node_metrics",
        "start_line": 17,
        "nloc": 41
    }
    
    req = urllib.request.Request(url)
    req.add_header('Content-Type', 'application/json; charset=utf-8')
    json_data = json.dumps(payload).encode('utf-8')
    
    try:
        response = urllib.request.urlopen(req, json_data)
        data = json.load(response)
        print("Status: 200")
        code_lines = data['code'].split('\n')
        print("Code length (lines):", len(code_lines))
        print("--- CODE ---")
        print(data['code'])
        print("--- END CODE ---")
    except urllib.error.HTTPError as e:
        print("HTTP Error:", e.code, e.read().decode())
    except Exception as e:
        print("Exception:", e)

if __name__ == "__main__":
    test_get_function_code()
