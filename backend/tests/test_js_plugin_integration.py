import os
import time
import subprocess
import pytest
import httpx
from app.utils.get_file_matrix_js import get_file_matrix_js
from app.adapter.js_plugin_adapter import JSPluginAdapter

@pytest.fixture(scope="module")
def js_plugin_server():
    """Starts the JS plugin server before tests and stops it after."""
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    process = subprocess.Popen(
        ["node", "app/js_plugin/server.js"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=backend_dir
    )
    
    # Wait for the server to be ready
    start_time = time.time()
    while time.time() - start_time < 5:
        try:
            with httpx.Client() as client:
                resp = client.get("http://localhost:3100") # Just checking if it's up
                if resp.status_code == 404: # Express default
                    break
        except httpx.ConnectError:
            time.sleep(0.5)
            
    yield process
    
    process.terminate()
    process.wait()

@pytest.mark.integration
def test_fastapi_to_js_plugin_communication(js_plugin_server):
    """
    Verifies that the FastAPI backend can successfully communicate with the Node.js 
    JS plugin server for real code analysis.
    """
    js_code = """
    function calculateSum(a, b) {
        if (a > 0 && b > 0) {
            return a + b;
        }
        return 0;
    }
    """
    
    filename = "integration_test.js"
    
    # Analyze code via Node.js service
    metrics = get_file_matrix_js(js_code, filename)
    
    assert metrics is not None, "Failed to get metrics from JS plugin"
    assert metrics.filename == filename
    assert metrics.language == "javascript"
    
    # Check for the function metrics 
    assert len(metrics.functions) >= 2
    func = next(f for f in metrics.functions if f.name == "calculateSum")
    
    assert func.lloc == 6
    assert func.cyclomatic_complexity == 3
    print(f"Integration Success: {func.name} metrics retrieved correctly.")

@pytest.mark.asyncio
@pytest.mark.integration
async def test_js_plugin_adapter_lint_content(js_plugin_server):
    """
    Directly tests the JSPluginAdapter's lint_content method to ensure it correctly 
    calls the Node.js service.
    """
    adapter = JSPluginAdapter()
    js_code = "const x = 10; console.log(x);"
    filename = "test_lint.js"
    
    # This calls http://localhost:3100/lint-code
    lint_result = await adapter.lint_content(js_code, filename)
    
    assert lint_result is not None
    assert lint_result.lint_score is not None
    assert isinstance(lint_result.lint_errors, list)
    
    # Since console.log is usually a warning in many ESLint configs (no-console)
    print(f"Adapter Integration Success: Received lint score of {lint_result.lint_score}")
    print(f"Errors found: {len(lint_result.lint_errors)}")
