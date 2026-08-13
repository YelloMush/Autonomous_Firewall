#!/usr/bin/env python3
"""
Bundle the Project Aegis source tree into project-aegis-presentation.zip for
easy transfer to a presentation machine.

Excludes: node_modules, .git, .env(*), build artifacts (dist, build, release,
packaging/backend_dist — the PyInstaller output for the installer, see
packaging/build_installer.py), common junk (__pycache__, .DS_Store, *.pyc),
the experimental web_frontend/ draft, and secrets (*.pem,
aws_infrastructure/aegis_config.txt). Everything else — source code, docs,
the SQLite sample DB — is included as-is.

Usage: python3 package_release.py
"""
import os
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
OUTPUT = os.path.join(ROOT, 'project-aegis-presentation.zip')

EXCLUDE_DIRS = {'node_modules', '.git', 'dist', 'build', 'release', '__pycache__', 'web_frontend', '.claude', '.vscode', '.idea', 'backend_dist'}
EXCLUDE_FILE_PREFIXES = ('.env',)
EXCLUDE_FILE_SUFFIXES = ('.pyc', '.pem')
EXCLUDE_FILE_NAMES = {'.DS_Store', os.path.basename(OUTPUT), 'aegis_config.txt'}


def should_skip_dir(name):
    return name in EXCLUDE_DIRS or name.startswith('.git')


def should_skip_file(name):
    if name in EXCLUDE_FILE_NAMES:
        return True
    if name.startswith(EXCLUDE_FILE_PREFIXES):
        return True
    if name.endswith(EXCLUDE_FILE_SUFFIXES):
        return True
    return False


def main():
    if os.path.exists(OUTPUT):
        os.remove(OUTPUT)

    file_count = 0
    with zipfile.ZipFile(OUTPUT, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for dirpath, dirnames, filenames in os.walk(ROOT):
            dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
            for fname in filenames:
                if should_skip_file(fname):
                    continue
                full = os.path.join(dirpath, fname)
                arcname = os.path.relpath(full, ROOT)
                zf.write(full, arcname)
                file_count += 1

    size_mb = os.path.getsize(OUTPUT) / (1024 * 1024)
    print(f"Wrote {OUTPUT}")
    print(f"  {file_count} files, {size_mb:.1f} MB")


if __name__ == '__main__':
    main()
