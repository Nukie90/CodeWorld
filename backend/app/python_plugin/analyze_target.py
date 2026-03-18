import sys
import os

# Ensure we can import from backend/app
# Assuming this script is run from backend/app/python_plugin/
# We need to add backend/ to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.python_plugin.python_analyzer import calculate_metrics

def analyze_file(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            code = f.read()
        
        metrics = calculate_metrics(code, os.path.basename(file_path))
        
        # Helper to compute total CC recursively (since analyzer might not pre-calculate total)
        def compute_total_cc(f):
            child_sum = 0
            for c in f.children:
                child_sum += compute_total_cc(c)
            # Store in total_cognitive_complexity field
            f.total_cognitive_complexity = (f.cyclomatic_complexity or 0) + child_sum
            return f.total_cognitive_complexity

        roots = metrics.functions
        for r in roots:
            compute_total_cc(r)
            
        print(f"{'Function Name':<30} | {'Start Line':<10} | {'End Line':<8} | {'CC':<8} | {'LLOC'}")
        print("-" * 75)
        
        def print_node(f, indent_level=0):
            indent = "     " * indent_level
            name_display = (indent + f.name)
            
            cc_display = str(f.total_cognitive_complexity)
            if f.children:
                cc_display += "(total)"
            
            print(f"{name_display:<30} | {str(f.start_line):<10} | {str(f.end_line):<8} | {cc_display:<8} | {f.lloc}")
            
            for c in f.children:
                print_node(c, indent_level + 1)
        
        for r in roots:
            print_node(r)

    except Exception as e:
        print(f"Error analyzing file: {e}")

if __name__ == "__main__":
    target_file = os.path.join(os.path.dirname(__file__), 'temp.py')
    if len(sys.argv) > 1:
        target_file = sys.argv[1]
    
    print(f"Analyzing {target_file}...")
    analyze_file(target_file)
