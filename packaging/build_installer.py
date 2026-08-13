#!/usr/bin/env python3
"""
Builds the fully self-contained Windows installer for the Aegis desktop
client — no system Python required on the end user's machine.

Steps:
  1. Freeze core_backend/api_server.py (+ analytics_engine.py) into
     packaging/backend_dist/api_server/api_server.exe via PyInstaller.
  2. Freeze tests/real_world_tester.py into
     packaging/backend_dist/tester/tester.exe via PyInstaller.
  3. Run electron-builder (desktop_client/package.json's "build" config,
     which ships both frozen exes + web_dashboard/ as extraResources)
     to produce desktop_client/release/Aegis Enterprise Setup <version>.exe.

Usage: python3 packaging/build_installer.py
Requires: pip install pyinstaller pyinstaller-hooks-contrib (also installs
the project's own requirements.txt), and Node/npm for the Electron step.
"""
import os
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Modules pulled in transitively (by pandas/sklearn's optional-plotting
# checks, or by unrelated tools on the build machine) that api_server.py and
# real_world_tester.py never actually use at runtime.
COMMON_EXCLUDES = [
    "matplotlib", "tkinter", "PIL", "jedi", "IPython", "notebook",
    "jupyter", "jupyter_client", "jupyter_core", "pytest",
    "PyQt5", "PyQt6", "PySide2", "PySide6", "wx",
]


def run(cmd, cwd=None):
    print(f"\n$ {' '.join(cmd)}")
    subprocess.run(cmd, cwd=cwd or ROOT, check=True)


def freeze(entry_script, name, extra_excludes):
    run([
        sys.executable, "-m", "PyInstaller", entry_script,
        "--name", name,
        "--onedir", "--noconfirm", "--console",
        "--distpath", os.path.join("packaging", "backend_dist"),
        "--workpath", os.path.join("packaging", "build"),
        "--specpath", "packaging",
        *[f"--exclude-module={m}" for m in COMMON_EXCLUDES + extra_excludes],
    ])


def main():
    freeze(
        os.path.join("core_backend", "api_server.py"), "api_server",
        extra_excludes=["scapy"],
    )
    freeze(
        os.path.join("tests", "real_world_tester.py"), "tester",
        extra_excludes=[
            "numpy", "pandas", "sklearn", "scipy", "boto3", "botocore",
            "fastapi", "uvicorn", "scapy",
        ],
    )

    # npm run dist == vite build && electron-builder. signAndEditExecutable
    # is disabled in package.json's build.win config; combined with this env
    # var, it avoids electron-builder's winCodeSign download hitting "cannot
    # create symbolic link" on non-admin, non-Developer-Mode Windows.
    env = {**os.environ, "CSC_IDENTITY_AUTO_DISCOVERY": "false"}
    npm = shutil.which("npm") or "npm"  # on Windows this is npm.cmd — a raw
    # "npm" string isn't resolvable by CreateProcess without shell=True.
    print("\n$ npm run dist   (desktop_client/)")
    subprocess.run([npm, "run", "dist"], cwd=os.path.join(ROOT, "desktop_client"), check=True, env=env)

    print("\nDone. Installer is under desktop_client/release/.")


if __name__ == "__main__":
    main()
