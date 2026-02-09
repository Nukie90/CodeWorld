import sys
import os
import json

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.python_plugin.python_analyzer import calculate_metrics

def verify_json(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()
            
        metrics = calculate_metrics(code, os.path.basename(file_path))
        
        # Dump to JSON
        print(metrics.model_dump_json(indent=2))
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    target_file = os.path.join(os.path.dirname(__file__), 'temp.py')
    if len(sys.argv) > 1:
        target_file = sys.argv[1]
        
    verify_json(target_file)
