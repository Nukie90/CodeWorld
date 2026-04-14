import urllib.request
import json
import time

BASE_URL = "http://127.0.0.1:8000/api"

def benchmark(repo_url, token=None):
    print(f"Benchmarking /repo/commits for {repo_url}...")
    start = time.time()
    
    req = urllib.request.Request(
        f"{BASE_URL}/repo/commits", 
        data=json.dumps({"repo_url": repo_url, "token": token, "limit": 50, "branch": "main"}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            resp_data = json.loads(response.read().decode())
    except Exception as e:
        print("Failed to get commits:", e)
        return
        
    commits = resp_data.get("commits", [])
    print(f"Fetched {len(commits)} commits in {time.time() - start:.3f}s")
    
    if not commits:
        print("No commits found.")
        return
    
    commits.reverse() # Oldest to newest
    
    print("\nBenchmarking /repo/checkout sequentially...")
    total_time = 0
    count = 0
    
    for i, commit in enumerate(commits[:20]): # Test first 20 commits
        start_req = time.time()
        c_req = urllib.request.Request(
            f"{BASE_URL}/repo/checkout",
            data=json.dumps({"repo_url": repo_url, "branch": commit["hash"], "token": token}).encode('utf-8'),
            headers={'Content-Type': 'application/json'}
        )
        
        try:
            with urllib.request.urlopen(c_req) as response:
                data = json.loads(response.read().decode())
                duration = time.time() - start_req
                analysis = data.get("analysis", {})
                files_count = len(analysis.get("individual_files", []))
                print(f"[{i+1}/20] Commit {commit['hash'][:7]} ({files_count} files) -> {duration:.3f}s")
                total_time += duration
                count += 1
        except Exception as e:
            duration = time.time() - start_req
            print(f"[{i+1}/20] Commit {commit['hash'][:7]} -> FAILED ({duration:.3f}s): {e}")
    
    if count > 0:
        print(f"\nAverage backend checkout time: {total_time / count:.3f}s")

if __name__ == "__main__":
    benchmark("https://github.com/expressjs/express")
