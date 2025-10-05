import os

def analyze_file(path: str):
    """Analyze a single file and return metadata + simple stats."""
    if not os.path.isfile(path):
        return {"error": "Invalid file path"}

    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.readlines()

    return {
        "filename": os.path.basename(path),
        "lines": len(content),
        "non_empty_lines": sum(1 for line in content if line.strip()),
        "size_bytes": os.path.getsize(path),
        "extension": os.path.splitext(path)[1]
    }
