import pytest
import os
import time
import subprocess
import httpx
from app.python_plugin.python_analyzer import calculate_metrics as py_calculate
from app.utils.get_file_matrix_js import get_file_matrix_js

@pytest.fixture(scope="module")
def js_plugin_server():
    """Starts the JS plugin server for multi-language unit testing."""
    backend_dir = "/Users/neztage/Documents/GitHub/CodeWorld/backend"
    process = subprocess.Popen(
        ["node", "app/js_plugin/server.js"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=backend_dir
    )
    
    start_time = time.time()
    while time.time() - start_time < 5:
        try:
            with httpx.Client() as client:
                resp = client.get("http://localhost:3001")
                if resp.status_code == 404:
                    break
        except httpx.ConnectError:
            time.sleep(0.5)
            
    yield process
    process.terminate()
    process.wait()

# --- Python Test ---
def test_python_metric_calculation():
    py_code = """
def hello(name):
    if name:
        return f"Hello {name}"
    return "Hello World"
"""
    metrics = py_calculate(py_code, "test.py")
    assert metrics.language == "python"
    assert len(metrics.functions) >= 2 
    hello_fn = next(f for f in metrics.functions if f.name == "hello")
    assert hello_fn.cyclomatic_complexity == 2 
    assert hello_fn.lloc == 4

# --- JavaScript Test ---
def test_js_metric_calculation(js_plugin_server):
    js_code = """
function add(a, b) {
    return a + b;
}
"""
    metrics = get_file_matrix_js(js_code, "test.js")
    assert metrics.language == "javascript"
    add_fn = next(f for f in metrics.functions if f.name == "add")
    assert add_fn.cyclomatic_complexity == 1
    assert add_fn.lloc == 3

# --- JSX Test ---
def test_jsx_metric_calculation(js_plugin_server):
    jsx_code = """
const Component = ({ items }) => {
    return (
        <ul>
            {items.map(item => <li key={item.id}>{item.name}</li>)}
        </ul>
    );
};
"""
    metrics = get_file_matrix_js(jsx_code, "test.jsx")
    assert metrics.language == "javascript" 
    comp_fn = next(f for f in metrics.functions if "Component" in f.name)
    # The analyzer counts logical lines of code (LLOC). 
    assert comp_fn.lloc >= 5
    print(f"JSX LLOC found: {comp_fn.lloc}")

# --- TypeScript Test ---
def test_ts_metric_calculation(js_plugin_server):
    ts_code = """
interface User { id: number; name: string; }
function greet(user: User): string {
    return `Hi ${user.name}`;
}
"""
    metrics = get_file_matrix_js(ts_code, "test.ts")
    assert metrics.language == "typescript"
    greet_fn = next(f for f in metrics.functions if f.name == "greet")
    assert greet_fn.lloc == 3

# --- TSX Test ---
def test_tsx_metric_calculation(js_plugin_server):
    tsx_code = """
import React from 'react';
interface Props { title: string; }
export const Header: React.FC<Props> = ({ title }) => {
    if (!title) return null;
    return <h1>{title}</h1>;
};
"""
    metrics = get_file_matrix_js(tsx_code, "test.tsx")
    assert metrics.language == "typescript"
    header_fn = next(f for f in metrics.functions if "Header" in f.name)
    assert header_fn.cyclomatic_complexity == 2 
    assert header_fn.lloc == 4


def test_multiline_template_spacing_does_not_inflate_js_lloc(js_plugin_server):
    js_code = """
const Component = ({ value }) => {
    return (
        `
          <div>${value}</div>
        `
    );
};
"""
    metrics = get_file_matrix_js(js_code, "template_spacing.js")
    component_fn = next(f for f in metrics.functions if "Component" in f.name)
    assert component_fn.lloc == 5
