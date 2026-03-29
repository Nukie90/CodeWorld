import os
from typing import Callable

import pathspec


def build_ignore_checker(root: str) -> Callable[[str], bool]:
    """Return a function that tells whether a path (absolute) should be ignored.

    It reads .gitignore in the given root (if present) and also always ignores
    the .git directory, README.md and .gitignore file itself.
    """
    patterns = []
    gitignore_path = os.path.join(root, '.gitignore')
    if os.path.exists(gitignore_path):
        try:
            with open(gitignore_path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.rstrip('\n')
                    if not line or line.lstrip().startswith('#'):
                        continue
                    patterns.append(line)
        except Exception:
            # If reading .gitignore fails, proceed with defaults
            pass

    # default ignores
    patterns.extend([
        '.git/', '.gitignore', 'README.md', 'LICENSE',
        'node_modules/', 'venv/', '.env', '__pycache__/',
        'dist/', 'build/', 'out/', 'target/',
        '.DS_Store', 'Thumbs.db',
        '*.jpg', '*.jpeg', '*.png', '*.gif', '*.ico', '*.svg', '*.webp',
        '*.mp3', '*.wav', '*.ogg', '*.m4a', '*.mp4', '*.mov', '*.avi',
        '*.zip', '*.tar', '*.gz', '*.rar', '*.7z',
        '*.exe', '*.bin', '*.dll', '*.so', '*.dylib',
        'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
        '*.txt', '*.md', '*.log', '*.csv',
        '.github/', '*.xml', '*.yml', '*.yaml', '*.json', "*.pdf"
    ])

    try:
        spec = pathspec.PathSpec.from_lines('gitwildmatch', patterns)
    except Exception:
        # if pathspec fails, fallback to no ignores
        spec = None

    def is_ignored(path: str) -> bool:
        # path is absolute; compute relative path to root
        try:
            rel = os.path.relpath(path, root)
        except Exception:
            rel = path

        # Normalize to posix style for pathspec which expects forward slashes
        rel_posix = rel.replace(os.path.sep, '/')

        # For directories, ensure trailing slash to match patterns like '.git/'
        if os.path.isdir(path) and not rel_posix.endswith('/'):
            rel_posix = rel_posix + '/'

        if spec is None:
            return False

        return spec.match_file(rel_posix)

    return is_ignored
