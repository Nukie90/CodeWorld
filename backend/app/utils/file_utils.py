import os

def get_all_files(root_path: str, extensions: list[str] = None):
    """Walk through project folder and return file list."""
    all_files = []
    for root, _, files in os.walk(root_path):
        for f in files:
            file_path = os.path.join(root, f)
            if extensions:
                if any(file_path.endswith(ext) for ext in extensions):
                    all_files.append(file_path)
            else:
                all_files.append(file_path)
    return all_files
