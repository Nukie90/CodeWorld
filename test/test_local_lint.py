import urllib.request
import json

def test_lint(file_path, endpoint_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()

    url = f"http://127.0.0.1:8000/api/lint/{endpoint_path}"
    data = json.dumps({"code": code}).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    
    try:
        with urllib.request.urlopen(req) as f:
            resp = json.loads(f.read().decode('utf-8'))
            print(f"--- SUCCESS: {endpoint_path} ---")
            print(f"Score: {resp.get('lint_score')}")
            print(f"Errors count: {len(resp.get('lint_errors', []))}")
            if resp.get('lint_errors'):
                for error in resp['lint_errors']:
                    print(f"Error: {error}\n")
    except Exception as e:
        print(f"--- ERROR: {endpoint_path} ---")
        print(e)
        if hasattr(e, 'read'):
            print(e.read().decode('utf-8'))

if __name__ == "__main__":
    test_lint('app/python_plugin/temp.py', 'temp.py')
    test_lint('app/js_plugin/temp_code.jsx', 'temp_code.jsx')
