# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec for Anndevta POS backend (FastAPI + uvicorn).

Build with:
    cd backend
    .venv\Scripts\pyinstaller backend.spec
"""

import sys
import os
from pathlib import Path

block_cipher = None

# ──────────────────────────────────────────────
# Hidden imports needed by FastAPI / uvicorn
# ──────────────────────────────────────────────
hidden_imports = [
    # uvicorn internals
    'uvicorn',
    'uvicorn.main',
    'uvicorn.config',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.loops.asyncio',
    'uvicorn.loops.uvloop',
    'uvicorn.http',
    'uvicorn.http.auto',
    'uvicorn.http.h11_impl',
    'uvicorn.http.httptools_impl',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.protocols.websockets.websockets_impl',
    'uvicorn.protocols.websockets.wsproto_impl',
    'uvicorn.lifespan',
    'uvicorn.lifespan.off',
    'uvicorn.lifespan.on',
    # FastAPI / Starlette
    'fastapi',
    'starlette',
    'starlette.middleware',
    'starlette.middleware.cors',
    'starlette.responses',
    'starlette.routing',
    'starlette.staticfiles',
    # Database
    'motor',
    'motor.motor_asyncio',
    'pymongo',
    'bson',
    'bson.json_util',
    # Auth
    'jwt',
    'bcrypt',
    'passlib',
    'passlib.context',
    # Data
    'pydantic',
    'pydantic.v1',
    'email_validator',
    'dotenv',
    # HTTP
    'httpx',
    'anyio',
    'anyio._backends._asyncio',
    # Excel
    'openpyxl',
    'openpyxl.styles',
    # Utils
    'multipart',
    'python_multipart',
]

a = Analysis(
    ['server.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        # Bundle the .env file so the server can read it
        ('.env', '.'),
    ],
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'PIL'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,           # No console window
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)
