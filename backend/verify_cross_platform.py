import os
import sys

def verify_cross_platform():
    print(f"Current OS: {os.name}")
    print(f"Path Separator: {os.path.sep}")

    # Test Case 1: Windows-style path (simulated)
    # Even on Mac, we can have strings with backslashes
    win_path = "folder\\file.txt"
    normalized_win = win_path.replace("\\", "/")
    print(f"Windows Path: {win_path} -> {normalized_win}")
    if "\\" in normalized_win:
        print("FAIL: Windows path still has backslashes")
        sys.exit(1)

    # Test Case 2: Unix-style path (simulated)
    unix_path = "folder/file.txt"
    normalized_unix = unix_path.replace("\\", "/")
    print(f"Unix Path:    {unix_path} -> {normalized_unix}")
    if normalized_unix != unix_path:
        print("FAIL: Unix path was modified incorrectly")
        sys.exit(1)

    # Test Case 3: Actual os.path.relpath behavior
    # We create a dummy path setup
    try:
        base = os.getcwd()
        subdir = os.path.join(base, "subdir")
        os.makedirs(subdir, exist_ok=True)
        target = os.path.join(subdir, "file.txt")
        
        # This is the logic in analyze_local_folder.py
        rel = os.path.relpath(target, base)
        print(f"os.path.relpath raw result: {rel}")
        
        final = rel.replace("\\", "/")
        print(f"Final normalized result:    {final}")
        
        if "\\" in final:
            print("FAIL: Result still contains backslashes")
            sys.exit(1)
            
        print("SUCCESS: Path normalization is working correctly.")
        
    except Exception as e:
        print(f"ERROR during test: {e}")
        sys.exit(1)

if __name__ == "__main__":
    verify_cross_platform()
