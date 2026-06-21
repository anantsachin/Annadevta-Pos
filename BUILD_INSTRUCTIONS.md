# Annapurna POS - Production Build Instructions

## Prerequisites

### 1. MongoDB Binary (REQUIRED for production)

**Option A: Download MongoDB Portable**
1. Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
2. Extract `mongod.exe` from the archive
3. Place it in: `POS-system/mongodb-portable/bin/mongod.exe`

**Option B: Use System MongoDB**
1. Install MongoDB Community Server
2. Note the installation path (e.g., `C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe`)
3. Update `frontend/package.json` line 103 with the correct path

### 2. Node.js & Python
- Node.js 18+ installed
- Python 3.9+ installed with venv

### 3. Dependencies Installed
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install pyinstaller
```

## Build Process

### Step 1: Add MongoDB to Build

Edit `frontend/package.json` and add after line 101:

```json
    ],
    "extraFiles": [
      {
        "from": "../mongodb-portable/bin/mongod.exe",
        "to": "bin/mongod.exe"
      }
    ],
    "win": {
```

OR if using system MongoDB:

```json
    ],
    "extraFiles": [
      {
        "from": "C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe",
        "to": "bin/mongod.exe"
      }
    ],
    "win": {
```

### Step 2: Run Build Script

```bash
cd POS-system
build_all.bat
```

This will:
1. Kill any running processes
2. Clean build directories
3. Build backend.exe with PyInstaller
4. Build React frontend
5. Package everything with electron-builder

### Step 3: Locate Installer

The installer will be created at:
```
POS-system/frontend/dist/Annapurna POS Setup.exe
```

## Build Output

- **Installer**: `frontend/dist/Annapurna POS Setup.exe`
- **Unpacked**: `frontend/dist/win-unpacked/` (for testing)
- **Backend**: `backend/dist/backend.exe`
- **Frontend**: `frontend/build/`

## Testing

### Test Unpacked Version
```bash
cd frontend/dist/win-unpacked
"Annapurna POS.exe"
```

### Test Installer
1. Run `Annapurna POS Setup.exe`
2. Install to default location
3. Launch from desktop shortcut
4. Verify:
   - Login works
   - Password change prompt appears
   - Billing works
   - Data persists after restart

## Troubleshooting

### Build fails with "mongod.exe not found"
- Ensure MongoDB binary is placed correctly
- Check path in `frontend/package.json` extraFiles

### Backend fails to start
- Check logs in: `%APPDATA%\Annapurna POS\logs\backend.log`
- Verify backend.exe exists in build output

### MongoDB fails to start
- Check logs in: `%APPDATA%\Annapurna POS\logs\mongod.log`
- Ensure port 27017 is not in use

### Electron build fails
- Run `cleanup_processes.bat` first
- Delete `frontend/dist` folder
- Try build again

## Production Checklist

- [ ] MongoDB binary added to build
- [ ] Backend builds successfully
- [ ] Frontend builds successfully
- [ ] Electron-builder completes without errors
- [ ] Installer runs on clean Windows machine
- [ ] First login password change works
- [ ] Backup/restore works
- [ ] Data persists after restart
- [ ] All validation works (discount, price, GST)
- [ ] Confirmation dialogs appear

## File Structure After Build

```
Annapurna POS Setup.exe (Installer)
│
└── Installed to: C:\Users\[User]\AppData\Local\Programs\annapurna-pos\
    ├── Annapurna POS.exe (Main executable)
    ├── resources\
    │   ├── app.asar (Frontend + Electron)
    │   └── bin\
    │       ├── backend.exe
    │       └── mongod.exe
    └── ...other Electron files

Data stored in: C:\Users\[User]\AppData\Roaming\Annapurna POS\
├── data\db\ (MongoDB database)
└── logs\ (Application logs)
```

## Version Information

- Electron: 29.x
- React: 19.x
- FastAPI: Latest
- MongoDB: 8.0+ compatible
- Python: 3.9+
- Node: 18+
