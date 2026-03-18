import sys
import os

# Ensure backend/app is in path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../')))

from app.python_plugin.python_analyzer import calculate_metrics

code = """
def my_function():
    x = 1 # LLOC 1
    if x > 0: # LLOC 2
        print("x is positive") # LLOC 3
    return x # LLOC 4

# Outer scope
a = 10 # LLOC 5
b = 20 # LLOC 6
"""

metrics = calculate_metrics(code, "test.py")

print(f"Total LLOC: {metrics.total_lloc}")
for func in metrics.functions:
    print(f"Function: {func.name}, LLOC: {func.lloc}")

# Expected: 
# my_function: 4 LLOC (assignment, if, print, return)
# code outside functions: 2 LLOC (a=10, b=20)
# Total: 6 LLOC (or slightly more depending on how AST counts nodes like Expr)
