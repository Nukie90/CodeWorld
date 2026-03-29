from app.utils.ignore import build_ignore_checker


def test_build_ignore_checker_applies_defaults(tmp_path):
    readme = tmp_path / "README.md"
    readme.write_text("docs", encoding="utf-8")
    gitignore = tmp_path / ".gitignore"
    gitignore.write_text("*.tmp\n", encoding="utf-8")
    git_dir = tmp_path / ".git"
    git_dir.mkdir()

    is_ignored = build_ignore_checker(str(tmp_path))

    assert is_ignored(str(readme)) is True
    assert is_ignored(str(gitignore)) is True
    assert is_ignored(str(git_dir)) is True


def test_build_ignore_checker_uses_gitignore_patterns(tmp_path):
    (tmp_path / ".gitignore").write_text("dist/\n*.log\n# comment\n\n", encoding="utf-8")
    dist_dir = tmp_path / "dist"
    dist_dir.mkdir()
    log_file = tmp_path / "server.log"
    log_file.write_text("x", encoding="utf-8")
    src_file = tmp_path / "src.py"
    src_file.write_text("print('ok')", encoding="utf-8")

    is_ignored = build_ignore_checker(str(tmp_path))

    assert is_ignored(str(dist_dir)) is True
    assert is_ignored(str(log_file)) is True
    assert is_ignored(str(src_file)) is False
