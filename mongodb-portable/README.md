# MongoDB Binary for Annapurna POS

This folder contains the MongoDB binary required for the Annapurna POS system.

## What's Included

- `bin/mongod.exe` - MongoDB server executable (72 MB)

## For Developers

If you cloned this repository and the `mongod.exe` is missing, you have two options:

### Option 1: Download from MongoDB Official Site (Recommended)

1. Visit: https://www.mongodb.com/try/download/community
2. Select:
   - Version: 8.0.4 (or latest 8.x)
   - Platform: Windows
   - Package: ZIP
3. Download and extract
4. Copy `bin/mongod.exe` to `mongodb-portable/bin/mongod.exe`

### Option 2: Use System MongoDB

If you have MongoDB installed system-wide:

1. Update `frontend/package.json` line 103
2. Change the path to your MongoDB installation:
   ```json
   {
     "from": "C:/Program Files/MongoDB/Server/8.0/bin/mongod.exe",
     "to": "bin/mongod.exe"
   }
   ```

## File Size

The `mongod.exe` file is approximately 72 MB. It's included in the repository for convenience, but if it's too large for your workflow, you can:

1. Add it to `.gitignore` locally
2. Download it separately when needed
3. Use a system-wide MongoDB installation

## Build Process

During the Electron build process, `mongod.exe` is automatically copied to:
```
dist/win-unpacked/resources/bin/mongod.exe
```

This ensures the application can run MongoDB locally without requiring a system installation.

## Version Information

- **MongoDB Version:** 8.0.4
- **Platform:** Windows x64
- **File Size:** ~72 MB
- **Required:** Yes (for offline operation)

## Troubleshooting

**Problem:** Build fails with "mongod.exe not found"

**Solution:**
1. Check if `mongodb-portable/bin/mongod.exe` exists
2. If missing, download from MongoDB official site
3. Verify the path in `frontend/package.json` is correct

**Problem:** File too large for Git

**Solution:**
1. Use Git LFS (Large File Storage)
2. Or download MongoDB separately and don't commit the binary
3. Document the download process for team members

## Alternative: Git LFS

If you want to track large files with Git:

```bash
# Install Git LFS
git lfs install

# Track mongod.exe
git lfs track "mongodb-portable/bin/mongod.exe"

# Commit the .gitattributes file
git add .gitattributes
git commit -m "Track MongoDB binary with Git LFS"
```

## Security Note

The MongoDB binary is the official release from MongoDB Inc. and is safe to use. Always download from the official MongoDB website to ensure authenticity.
