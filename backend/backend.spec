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
from PyInstaller.utils.hooks import collect_all, collect_submodules

block_cipher = None

# Collect ALL files/submodules for google-generativeai (fixes ModuleNotFoundError)
google_genai_datas, google_genai_binaries, google_genai_hiddenimports = collect_all('google.generativeai')
google_api_core_datas, google_api_core_binaries, google_api_core_hiddenimports = collect_all('google.api_core')
google_auth_datas, google_auth_binaries, google_auth_hiddenimports = collect_all('google.auth')
google_protobuf_datas, google_protobuf_binaries, google_protobuf_hiddenimports = collect_all('google.protobuf')

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
    # ── Google Generative AI (Gemini) ────────────────────────────────
    # Root google namespace package (critical — fixes "No module named 'google'")
    'google',
    'google.generativeai',
    'google.generativeai.types',
    'google.generativeai.client',
    'google.generativeai.generative_models',
    'google.generativeai.protos',
    'google.api_core',
    'google.api_core.gapic_v1',
    'google.api_core.gapic_v1.method',
    'google.api_core.operations_v1',
    'google.api_core.retry',
    'google.api_core.retry_async',
    'google.api_core.future',
    'google.api_core.future.polling',
    'google.api_core.exceptions',
    'google.api_core.grpc_helpers',
    'google.api_core.grpc_helpers_async',
    'google.auth',
    'google.auth.credentials',
    'google.auth.transport',
    'google.auth.transport.requests',
    'google.auth.transport.grpc',
    'google.auth.exceptions',
    'google.oauth2',
    'google.oauth2.credentials',
    'google.oauth2.service_account',
    'google.protobuf',
    'google.protobuf.descriptor',
    'google.protobuf.descriptor_pool',
    'google.protobuf.message',
    'google.protobuf.reflection',
    'google.protobuf.symbol_database',
    'google.protobuf.json_format',
    'google.protobuf.timestamp_pb2',
    'google.protobuf.struct_pb2',
    # collected submodules (from collect_all above)
    *google_genai_hiddenimports,
    *google_api_core_hiddenimports,
    *google_auth_hiddenimports,
    *google_protobuf_hiddenimports,
]

a = Analysis(
    ['server.py'],
    pathex=['.'],
    binaries=(
        google_genai_binaries
        + google_api_core_binaries
        + google_auth_binaries
        + google_protobuf_binaries
    ),
    datas=(
        # Bundle the .env file so the server can read it
        [('.env', '.')]
        + google_genai_datas
        + google_api_core_datas
        + google_auth_datas
        + google_protobuf_datas
    ),
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
