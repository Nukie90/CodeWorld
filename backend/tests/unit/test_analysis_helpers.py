import pytest

from app.adapter.adapter import AnalysisAdapter
from app.model.analyzer_model import FileMetrics, FolderAnalysisResult, FolderMetrics, FunctionMetric
from app.utils.analysis_helpers import (
    aggregate_metrics,
    ensure_file_total_cognitive_complexity,
    group_files_by_adapter,
    normalize_analysis_result,
    run_adapter_batches,
)


class DummyAdapter(AnalysisAdapter):
    def __init__(self, suffix):
        self.suffix = suffix

    def supports(self, filename: str) -> bool:
        return filename.endswith(self.suffix)

    async def analyze_content(self, content: str, filename: str):
        return None

    async def lint_content(self, content: str, filename: str):
        return None


class DummyBatchAdapter(DummyAdapter):
    async def analyze_batch(self, files):
        return [
            make_file(filename, [make_function(filename, id_=index + 1)])
            for index, (_, filename) in enumerate(files)
        ]


def make_function(name, *, id_, parent_id=None, cognitive=0):
    return FunctionMetric(
        id=id_,
        parentId=parent_id,
        name=name,
        long_name=name,
        lloc=5,
        cognitive_complexity=cognitive,
        cyclomatic_complexity=1,
        max_nesting_depth=1,
    )


def make_file(filename, functions, *, total_cognitive_complexity=None, mi=None):
    return FileMetrics(
        filename=filename,
        language="python",
        total_loc=20,
        total_lloc=15,
        function_count=len(functions),
        total_complexity=3,
        total_cognitive_complexity=total_cognitive_complexity,
        maintainability_index=mi,
        functions=functions,
    )


def test_ensure_file_total_cognitive_complexity_rolls_up_children():
    child = make_function("child", id_=2, parent_id=1, cognitive=3)
    parent = make_function("parent", id_=1, cognitive=5)
    parent.children.append(child)
    file_metrics = make_file("example.py", [parent, child])

    result = ensure_file_total_cognitive_complexity(file_metrics)

    assert result.total_cognitive_complexity == 8
    assert parent.total_cognitive_complexity == 8
    assert child.total_cognitive_complexity == 3


def test_normalize_analysis_result_populates_missing_totals():
    root_fn = make_function("root", id_=1, cognitive=4)
    file_metrics = make_file("sample.py", [root_fn])
    analysis = FolderAnalysisResult(
        folder_metrics=FolderMetrics(
            folder_name="repo",
            total_files=1,
            total_loc=20,
            total_lloc=15,
            total_functions=1,
            total_complexity=3,
            files=[file_metrics],
        ),
        individual_files=[file_metrics],
    )

    normalized = normalize_analysis_result(analysis)

    assert normalized.individual_files[0].total_cognitive_complexity == 4


def test_ensure_file_total_cognitive_complexity_keeps_existing_total():
    root_fn = make_function("root", id_=1, cognitive=4)
    file_metrics = make_file("sample.py", [root_fn], total_cognitive_complexity=99)

    result = ensure_file_total_cognitive_complexity(file_metrics)

    assert result.total_cognitive_complexity == 99


def test_aggregate_metrics_sums_totals_and_averages_mi():
    file_a = make_file("a.py", [make_function("a", id_=1)], mi=80.0)
    file_a.total_loc = 10
    file_a.total_lloc = 8
    file_a.total_complexity = 2
    file_a.halstead_volume = 100.0

    file_b = make_file("b.py", [make_function("b", id_=2)], mi=70.0)
    file_b.total_loc = 30
    file_b.total_lloc = 25
    file_b.total_complexity = 6
    file_b.halstead_volume = 40.0

    folder = aggregate_metrics([file_a, file_b], "repo")

    assert folder.folder_name == "repo"
    assert folder.total_files == 2
    assert folder.total_loc == 40
    assert folder.total_lloc == 33
    assert folder.total_functions == 2
    assert folder.total_complexity == 8
    assert folder.halstead_volume == 140.0
    assert folder.maintainability_index == 75.0


def test_group_files_by_adapter_groups_supported_and_unsupported_files():
    py_adapter = DummyAdapter(".py")
    js_adapter = DummyAdapter(".js")
    rel_paths = ["keep.py", "ignore.js", "notes.txt", "deleted.py", "missing.py"]
    content_map = {
        "keep.py": "print('ok')",
        "ignore.js": "console.log('ok')",
        "notes.txt": "plain text",
        "deleted.py": "removed",
    }

    grouped, unsupported = group_files_by_adapter(
        rel_paths,
        [py_adapter, js_adapter],
        content_map.get,
        deleted_set={"deleted.py"},
    )

    assert grouped[id(py_adapter)][1] == [("print('ok')", "keep.py")]
    assert grouped[id(js_adapter)][1] == [("console.log('ok')", "ignore.js")]
    assert unsupported == [("notes.txt", "plain text")]


@pytest.mark.asyncio
async def test_run_adapter_batches_flattens_batch_results():
    py_adapter = DummyBatchAdapter(".py")
    js_adapter = DummyBatchAdapter(".js")
    grouped = {
        id(py_adapter): (py_adapter, [("print('ok')", "a.py")]),
        id(js_adapter): (js_adapter, [("console.log('ok')", "b.js")]),
    }

    results = await run_adapter_batches(grouped)

    assert [result.filename for result in results] == ["a.py", "b.js"]
