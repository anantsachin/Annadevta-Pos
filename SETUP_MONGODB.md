# MongoDB Setup for Annapurna POS Build

## Issue

The production build requires `mongod.exe` to be bundled with the application. The current `package.json` references:

```
"from": "D:/mongodb/bin/mongod.exe"
```

This path does not exist on your system.

## Solutions

### Option 1: Install MongoDB Community Server (Recommended)

1. Download MongoDB Community Server from:
   https://www.mongodb.com/try/download/community

2. Install MongoDB to a known location (e.g., `C:\Program Files\MongoDB\Server\7.0\bin\`)

3. Update `frontend/package.json` line 102:
   ```json
   {
     "from": "C:/Program Files/MongoDB/Server/7.0/bin/mongod.exe",
     "to": "bin/mongod.exe"
   }
   ```

### Option 2: Download MongoDB Binary Only

1. Download MongoDB ZIP from the same link above

2. Extract `mongod.exe` to a local folder (e.g., `C:\mongodb\bin\`)

3. Update `frontend/package.json` line 102 with the correct path

### Option 3: Create bin/ folder in project (For Testing)

If you want to test the build without MongoDB bundling:

1. Create `bin/` folder in project root
2. Copy `mongod.exe` to `bin/mongod.exe`
3. Update `frontend/package.json` line 102:
   ```json
   {
     "from": "../bin/mongod.exe",
     "to": "bin/mongod.exe"
   }
   ```

### Option 4: Make MongoDB Optional (Development Only)

For development/testing builds where you'll use an external MongoDB:

1. Comment out the mongod.exe entry in `frontend/package.json`:
   ```json
   "extraResources": [
     // ... other resources ...
     // {
     //   "from": "D:/mongodb/bin/mongod.exe",
     //   "to": "bin/mongod.exe"
     // }
   ],
   ```

2. The app will still work if MongoDB is running externally on port 27017

**Note:** For production client deployment, you MUST bundle mongod.exe (Option 1, 2, or 3).

## Verification

After setting up MongoDB, verify the path exists:

```bash
# PowerShell
Test-Path "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"

# Or check your custom path
Test-Path "C:\mongodb\bin\mongod.exe"
```

Should return `True` if the file exists.

## Current Build Status

The build will fail at the electron-builder step with:

```
Error: ENOENT: no such file or directory, stat 'D:\mongodb\bin\mongod.exe'
```

Until you fix the MongoDB path in `frontend/package.json`.
