import pytest

from app.model.analyzer_model import FileMetrics, FunctionMetric
from app.python_plugin.python_analyzer import calculate_maintainability_index
from app.services.analyze_local_folder import _analyze_single_file
from app.utils.analysis_helpers import aggregate_metrics, ensure_file_total_cognitive_complexity

pytestmark = pytest.mark.unit


def test_metric_calculation_correctness_for_small_fixed_input():
    function = FunctionMetric(
        id=1,
        name="sumValues",
        long_name="sumValues",
        start_line=1,
        end_line=4,
        lloc=4,
        cognitive_complexity=2,
        cyclomatic_complexity=1,
        total_cognitive_complexity=None,
        maintainability_index=91.2,
        max_nesting_depth=1,
        halstead_volume=14.5,
        children=[],
    )
    file_metrics = FileMetrics(
        filename="src/math.js",
        language="javascript",
        total_loc=6,
        total_lloc=4,
        function_count=1,
        total_complexity=1,
        total_cognitive_complexity=None,
        halstead_volume=14.5,
        maintainability_index=91.2,
        functions=[function],
    )

    normalized_file = ensure_file_total_cognitive_complexity(file_metrics)
    folder_metrics = aggregate_metrics([normalized_file], "demo-repo")

    assert normalized_file.total_cognitive_complexity == 2
    assert folder_metrics.total_files == 1
    assert folder_metrics.total_loc == 6
    assert folder_metrics.total_lloc == 4
    assert folder_metrics.total_functions == 1
    assert folder_metrics.total_complexity == 1
    assert folder_metrics.maintainability_index == 91.2


def test_unsupported_file_types_are_ignored_for_function_metrics(tmp_path, monkeypatch):
    monkeypatch.setattr(
        "app.services.analyze_local_folder.get_adapters",
        lambda: [],
    )

    file_path = tmp_path / "diagram.png"
    file_path.write_text("png-placeholder-content", encoding="utf-8")

    result = _analyze_single_file(str(file_path), "assets/diagram.png")

    assert result is not None
    assert result.is_unsupported is True
    assert result.function_count == 0
    assert result.total_complexity == 0
    assert result.filename.startswith("assets/diagram.png")


def test_maintainability_threshold_logic_flags_complex_code():
    healthy = calculate_maintainability_index(
        halstead_volume=20.0,
        cyclomatic_complexity=1,
        loc=10,
    )
    risky = calculate_maintainability_index(
        halstead_volume=5000.0,
        cyclomatic_complexity=35,
        loc=600,
    )

    assert 0 <= healthy <= 100
    assert 0 <= risky <= 100
    assert healthy > risky
    assert risky < 20
