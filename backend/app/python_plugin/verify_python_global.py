import sys
import os

# Add backend directory to sys.path to allow imports from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.python_plugin.python_analyzer import calculate_metrics

code = """
a = 1
if a > 0:
    print('global')

def foo():
    return
"""

try:
    metrics = calculate_metrics(code, "test.py")
    
    global_fn = next((f for f in metrics.functions if f.id == -1), None)
    
    # In the separated model, foo is a root, so it should be in metrics.functions (which lists all, but parentId check matters)
    # Actually calculate_metrics returns a list of roots in `functions` field if processed?
    # No, `python_analyzer.py` returns `roots`.
    # `roots` should now contain `(global)` AND `foo`.
    
    roots = metrics.functions
    
    global_fn = next((f for f in roots if f.id == -1), None)
    foo_fn = next((f for f in roots if f.name == 'foo'), None)

    if not global_fn:
        print('FAIL: (global) function not found in roots')
        sys.exit(1)
        
    if not foo_fn:
         print('FAIL: foo function not found in roots (should be sibling)')
         sys.exit(1)

    if foo_fn.parentId is not None:
        print(f'FAIL: foo parentId should be None, got {foo_fn.parentId}')
        sys.exit(1)

    if global_fn.cyclomatic_complexity != 1:
        print(f'FAIL: Global CC should be 1, got {global_fn.cyclomatic_complexity}')
        sys.exit(1)

    print('SUCCESS: Python Separation verification passed')

except Exception as e:
    import traceback
    traceback.print_exc()
    print(f'ERROR: {e}')
    sys.exit(1)
