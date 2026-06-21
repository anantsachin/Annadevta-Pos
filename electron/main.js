/**
 * Annapurna POS — Electron Main Process
 *
 * Startup sequence:
 *  1. Spawn mongod.exe (local MongoDB)
 *  2. Spawn backend.exe (PyInstaller FastAPI server)
 *  3. Poll /api/health until backend is ready
 *  4. Open BrowserWindow loading the React production build
 *  5. On quit: gracefully terminate backend → mongod
 */

const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

// ─── Paths ───────────────────────────────────────────────────────────────────

/**
 * In production (packaged .exe), __dirname is inside the asar.
 * process.resourcesPath points to the Resources/ folder next to the .exe.
 * In development, we resolve from the repo root.
 */
const IS_PACKAGED = app.isPackaged;

function getResourcePath(...segments) {
  if (IS_PACKAGED) {
    // Packaged: binaries and React build are in process.resourcesPath (extraResources)
    // electron/ files are inside app.asar, but bin/ and build/ are in extraResources
    return path.join(process.resourcesPath, ...segments);
  }
  // Dev: __dirname = D:\GIT\POS-system\electron\
  // React build lives in frontend\build\
  if (segments[0] === 'build') {
    return path.join(__dirname, '..', 'frontend', ...segments);
  }
  // bin/ and other resources are at repo root
  return path.join(__dirname, '..', ...segments);
}

// MongoDB data directory — stored in user's AppData so it persists between updates
const MONGO_DATA_DIR = path.join(app.getPath('userData'), 'data', 'db');
const MONGO_LOG_DIR  = path.join(app.getPath('userData'), 'logs');

// Bundled binaries
const MONGOD_EXE   = getResourcePath('bin', 'mongod.exe');
const BACKEND_EXE  = getResourcePath('bin', 'backend.exe');

// React production build (index.html)
const REACT_BUILD  = getResourcePath('build', 'index.html');

// Backend API
const BACKEND_PORT = 8000;
const BACKEND_URL  = `http://127.0.0.1:${BACKEND_PORT}`;
const HEALTH_URL   = `${BACKEND_URL}/api/health`;

// ─── State ───────────────────────────────────────────────────────────────────

let mainWindow = null;
let mongodProc = null;
let backendProc = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function logToFile(tag, data) {
  const logPath = path.join(MONGO_LOG_DIR, 'electron.log');
  const line = `[${new Date().toISOString()}] [${tag}] ${data}\n`;
  try { fs.appendFileSync(logPath, line); } catch (_) {}
}

function spawnSilent(exe, args, opts = {}) {
  const proc = spawn(exe, args, {
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    ...opts,
  });
  proc.stdout.on('data', (d) => logToFile(path.basename(exe), d.toString().trim()));
  proc.stderr.on('data', (d) => logToFile(`${path.basename(exe)}:ERR`, d.toString().trim()));
  proc.on('error', (e) => logToFile(`${path.basename(exe)}:ERROR`, e.message));
  return proc;
}

/**
 * Poll a URL until it returns HTTP 200 or timeout expires.
 * @param {string} url
 * @param {number} timeoutMs
 * @param {number} intervalMs
 * @returns {Promise<boolean>}
 */
function waitForUrl(url, timeoutMs = 60000, intervalMs = 1000) {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    function attempt() {
      if (Date.now() > deadline) {
        resolve(false);
        return;
      }
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve(true);
        } else {
          res.resume();
          setTimeout(attempt, intervalMs);
        }
      });
      req.on('error', () => setTimeout(attempt, intervalMs));
      req.setTimeout(3000, () => { req.destroy(); setTimeout(attempt, intervalMs); });
    }
    attempt();
  });
}

// ─── Startup ─────────────────────────────────────────────────────────────────

async function startServices() {
  ensureDir(MONGO_DATA_DIR);
  ensureDir(MONGO_LOG_DIR);

  logToFile('main', `IS_PACKAGED=${IS_PACKAGED}`);
  logToFile('main', `MONGOD_EXE=${MONGOD_EXE}`);
  logToFile('main', `BACKEND_EXE=${BACKEND_EXE}`);
  logToFile('main', `REACT_BUILD=${REACT_BUILD}`);

  // 1. Start MongoDB
  if (!fs.existsSync(MONGOD_EXE)) {
    logToFile('main', 'WARN: mongod.exe not found — assuming external MongoDB is running');
  } else {
    logToFile('main', 'Starting mongod...');
    mongodProc = spawnSilent(MONGOD_EXE, [
      '--dbpath', MONGO_DATA_DIR,
      '--port', '27017',
      '--bind_ip', '127.0.0.1',
      '--logpath', path.join(MONGO_LOG_DIR, 'mongod.log'),
      '--logappend',
    ]);
    logToFile('main', `mongod PID: ${mongodProc.pid}`);
    // Give MongoDB a moment to initialise before starting the backend
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 2. Start FastAPI backend
  if (!fs.existsSync(BACKEND_EXE)) {
    logToFile('main', 'WARN: backend.exe not found — assuming external backend is running');
  } else {
    logToFile('main', 'Starting backend.exe...');
    backendProc = spawnSilent(BACKEND_EXE, [], {
      env: {
        ...process.env,
        MONGO_URL: 'mongodb://127.0.0.1:27017',
        DB_NAME: 'thali_pos',
        JWT_SECRET: 'thali-pos-super-secret-key-987654321',
        ADMIN_EMAIL: 'admin@pos.com',
        ADMIN_PASSWORD: 'admin123',
        PORT: String(BACKEND_PORT),
      },
    });
    logToFile('main', `backend PID: ${backendProc.pid}`);
  }

  // 3. Wait for backend to be ready
  logToFile('main', `Waiting for backend at ${HEALTH_URL}...`);
  const ready = await waitForUrl(HEALTH_URL, 90000, 1000);
  if (!ready) {
    logToFile('main', 'ERROR: Backend did not become ready in time');
    const choice = dialog.showMessageBoxSync({
      type: 'error',
      title: 'Annapurna POS — Startup Error',
      message: 'The backend server failed to start.',
      detail: `Check logs at:\n${MONGO_LOG_DIR}\n\nDo you want to open the log folder?`,
      buttons: ['Open Logs', 'Quit'],
    });
    if (choice === 0) shell.openPath(MONGO_LOG_DIR);
    app.quit();
    return false;
  }
  logToFile('main', 'Backend is ready!');
  return true;
}

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Annapurna POS',
    icon: IS_PACKAGED ? path.join(__dirname, 'icon.ico') : path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Allow file:// → http://127.0.0.1 XHR (needed for packaged mode)
      webSecurity: true,
    },
    backgroundColor: '#0f172a',
    show: false, // show after content loads
  });

  // In dev mode load React dev server; in production load the built index.html
  if (!IS_PACKAGED && process.env.ELECTRON_DEV) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(REACT_BUILD);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
}

// ─── Shutdown ────────────────────────────────────────────────────────────────

function killProcess(proc, name) {
  if (!proc) return;
  try {
    logToFile('main', `Terminating ${name} (PID ${proc.pid})...`);
    process.kill(proc.pid, 'SIGTERM');
  } catch (e) {
    logToFile('main', `Failed to kill ${name}: ${e.message}`);
  }
}

function shutdownServices() {
  killProcess(backendProc, 'backend');
  // Wait briefly before killing mongod so backend can flush writes
  setTimeout(() => killProcess(mongodProc, 'mongod'), 1500);
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Show a loading splash via a small window while services start
  const splash = new BrowserWindow({
    width: 480,
    height: 300,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: { nodeIntegration: false },
  });
  splash.loadFile(path.join(__dirname, 'splash.html'));
  splash.center();

  const ok = await startServices();
  if (!ok) return;

  createWindow();
  splash.destroy();
});

app.on('before-quit', shutdownServices);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
