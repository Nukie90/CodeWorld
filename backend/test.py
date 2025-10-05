import os
import lizard
from typing import Dict, Any, List

def calculate_file_averages(file_info: lizard.FileInformation) -> Dict[str, float]:
    """Calculates average CCN and NLOC for a single file."""
    if not file_info.function_list:
        return {"avg_ccn": 0.0, "avg_nloc": 0.0}

    total_ccn = sum(func.cyclomatic_complexity for func in file_info.function_list)
    total_nloc = sum(func.nloc for func in file_info.function_list)
    
    func_count = len(file_info.function_list)
    
    return {
        "avg_ccn": total_ccn / func_count,
        "avg_nloc": total_nloc / func_count,
    }


def analyze_folder_with_lizard(folder_path: str) -> Dict[str, Any]:
    """
    Analyzes a folder recursively using the Lizard code complexity analyzer
    and returns a dictionary containing overall and per-file metrics.
    """
    if not os.path.isdir(folder_path):
        return {"error": f"Folder not found: {folder_path}"}

    print(f"Starting Lizard analysis for: {folder_path}...")

    # The lizard.analyze function returns a Generator for FileInformation objects
    analysis_results = lizard.analyze([folder_path])

    report: Dict[str, Any] = {
        "folder_path": folder_path,
        "overall_metrics": {
            "total_nloc": 0,
            "total_function_count": 0,
            "total_ccn": 0,
            "total_token_count": 0,
        },
        "file_analysis": [],
    }

    # Iterate over the files processed by Lizard
    file_count = 0
    all_function_metrics: List[Dict[str, Any]] = []

    for file_info in analysis_results:
        file_count += 1
        
        # Manually calculate the file averages here
        averages = calculate_file_averages(file_info)

        file_data = {
            "filename": file_info.filename,
            "nloc": file_info.nloc,
            "function_count": len(file_info.function_list),
            # Use the calculated averages
            "avg_nloc": averages["avg_nloc"],
            "avg_ccn": averages["avg_ccn"],
            "function_metrics": []
        }

        # Collect metrics for each function in the file
        for func in file_info.function_list:
            function_metrics = {
                "name": func.name,
                "long_name": func.long_name,
                "start_line": func.start_line,
                "end_line": func.end_line,
                "nloc": func.nloc,
                "cyclomatic_complexity": func.cyclomatic_complexity, # CCN
                "token_count": func.token_count,
                "parameter_count": func.parameter_count,
            }
            file_data["function_metrics"].append(function_metrics)
            all_function_metrics.append(function_metrics) # For overall calculation
        
        report["file_analysis"].append(file_data)
        
        # Accumulate overall project NLOC and function count
        report["overall_metrics"]["total_nloc"] += file_info.nloc
        report["overall_metrics"]["total_function_count"] += file_data["function_count"]

    # Calculate overall project CCN and token count from ALL functions
    report["overall_metrics"]["total_ccn"] = sum(f["cyclomatic_complexity"] for f in all_function_metrics)
    report["overall_metrics"]["total_token_count"] = sum(f["token_count"] for f in all_function_metrics)
    report["overall_metrics"]["total_files_analyzed"] = file_count
    
    # Calculate average CCN and NLOC for the whole project
    func_count = report["overall_metrics"]["total_function_count"]
    report["overall_metrics"]["avg_ccn_project"] = (
        report["overall_metrics"]["total_ccn"] / func_count if func_count else 0
    )
    report["overall_metrics"]["avg_nloc_project"] = (
        report["overall_metrics"]["total_nloc"] / file_count if file_count else 0
    )

    print("Analysis complete.")
    return report

# The print_analysis_report and __main__ blocks remain the same as the original, 
# but will now use the correctly calculated 'avg_ccn' and 'avg_nloc' fields.

def print_analysis_report(report: Dict[str, Any]):
    """Prints the analysis report in a readable format."""
    if "error" in report:
        print(f"Error: {report['error']}")
        return

    print("\n" + "="*80)
    print(f"  LIZARD CODE COMPLEXITY REPORT FOR: {report['folder_path']}")
    print("="*80)

    # Print overall metrics
    overall = report["overall_metrics"]
    print("\n## 📊 Overall Folder Metrics")
    print("-" * 30)
    print(f"  Total Files Analyzed: {overall['total_files_analyzed']}")
    print(f"  Total Functions:      {overall['total_function_count']}")
    print(f"  Total Non-Comment LOC (NLOC): {overall['total_nloc']}")
    print(f"  Total Cyclomatic Complexity (CCN): {overall['total_ccn']}")
    print(f"  Project Avg CCN per Function: {overall['avg_ccn_project']:.2f}")
    print(f"  Project Avg NLOC per File: {overall['avg_nloc_project']:.2f}")
    print("-" * 30)

    # Print per-file and per-function metrics
    print("\n## 📝 Per-File and Per-Function Analysis")
    for file_data in report["file_analysis"]:
        # The calculated averages are now available
        print(f"\n--- 📄 File: {file_data['filename']} ---")
        print(f"  NLOC: {file_data['nloc']}, Functions: {file_data['function_count']}")
        print(f"  Avg CCN: {file_data['avg_ccn']:.2f}, Avg NLOC: {file_data['avg_nloc']:.2f}")
        
        if file_data['function_metrics']:
            print("  Functions:")
            for func in file_data['function_metrics']:
                # The @line@file is redundant here, so we use name only
                print(f"    - {func['name']} (L{func['start_line']}-{func['end_line']}):")
                print(f"      - NLOC: {func['nloc']}, CCN: {func['cyclomatic_complexity']}")
                print(f"      - Params: {func['parameter_count']}, Tokens: {func['token_count']}")


if __name__ == "__main__":
    # --- IMPORTANT: CHANGE THIS PATH TO YOUR TARGET FOLDER ---
    target_folder = "/Users/roshan/Desktop/Uni/CodeWorld/backend/app/services" 
    # ---------------------------------------------------------
    
    # Create a dummy project structure for demonstration if it doesn't exist
    if not os.path.exists(target_folder):
        os.makedirs(target_folder, exist_ok=True)
        with open(os.path.join(target_folder, "example_module.py"), "w") as f:
            f.write("""
def simple_function(a):
    # This is a comment, which is ignored by NLOC
    if a > 0:
        return a + 1
    return a
    
def complex_logic(x, y, z):
    # CCN = 1 for function + 1 for each decision point (if, elif, for, while, etc.)
    # Here: base (1) + if (1) + elif (1) + for (1) = 4
    if x > 10:
        if y < 5: # Nested if counts towards complexity
            print("A")
        elif y == 5:
            print("B")
        else:
            print("C")
    
    total = 0
    for item in z:
        total += item
    return total
""")
        with open(os.path.join(target_folder, "another_file.c"), "w") as f:
             f.write("""
/* C code example */
int factorial(int n) {
    if (n < 0) {
        return -1; // CCN + 1
    } else if (n == 0) {
        return 1; // CCN + 1
    } else {
        int result = 1;
        for (int i = 1; i <= n; i++) { // CCN + 1
            result *= i;
        }
        return result;
    }
} // Total CCN = 1 (base) + 3 decision points = 4
""")
        print(f"Created a dummy folder at '{target_folder}' for analysis.")
    
    analysis_report = analyze_folder_with_lizard(target_folder)
    print_analysis_report(analysis_report)
    
