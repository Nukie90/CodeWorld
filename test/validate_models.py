from pydantic import ValidationError
import sys
import os

# Ensure backend/app is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

try:
    from app.model.analyzer_model import FileMetrics, FolderMetrics, FunctionMetric
    from app.routes.github_routes import FunctionCodeRequest

    print("Import successful!")

    # Test FunctionMetric
    f = FunctionMetric(name="foo", long_name="foo", lloc=10, cyclomatic_complexity=2, max_nesting_depth=1)
    print("FunctionMetric validated")

    # Test FileMetrics
    fm = FileMetrics(filename="test.py", language="python", total_loc=20, total_lloc=15, function_count=1, functions=[f], total_complexity=2)
    print("FileMetrics validated")

    # Test FunctionCodeRequest
    req = FunctionCodeRequest(repo_url="url", filename="file", function_name="name", start_line=1, lloc=10)
    print("FunctionCodeRequest validated")

    print("\nAll models validated correctly with 'lloc'!")

except ImportError as e:
    print(f"Import error: {e}")
except ValidationError as e:
    print(f"Validation error: {e}")
except Exception as e:
    print(f"Error: {e}")
