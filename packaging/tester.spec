# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['../tests/real_world_tester.py'],
    pathex=[],
    binaries=[],
    datas=[],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['matplotlib', 'tkinter', 'PIL', 'jedi', 'IPython', 'notebook', 'jupyter', 'jupyter_client', 'jupyter_core', 'pytest', 'PyQt5', 'PyQt6', 'PySide2', 'PySide6', 'wx', 'numpy', 'pandas', 'sklearn', 'scipy', 'boto3', 'botocore', 'fastapi', 'uvicorn', 'scapy'],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='tester',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='tester',
)
