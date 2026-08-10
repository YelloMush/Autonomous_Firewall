'use strict';

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

// ── Path resolution ──────────────────────────────────────────────────────────
// In dev: desktop_client/ → project root is two levels up
// In prod: unpacked app → extraResources are at process.resourcesPath
const PROJECT_ROOT = isDev
  ? path.join(__dirname, '..', '..')
  : process.resourcesPath;

let mainWindow = null;
let pythonBackend = null;
let testerProcess = null;

// ── Python Backend Spawner ───────────────────────────────────────────────────
function startPythonBackend() {
  const script = path.join(PROJECT_ROOT, 'core_backend', 'api_server.py');
  console.log('[Aegis] Spawning Python backend:', script);

  pythonBackend = spawn('python', [script], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });

  pythonBackend.stdout.on('data', d => process.stdout.write('[API] ' + d));
  pythonBackend.stderr.on('data', d => {
    const s = d.toString();
    if (!s.includes('DeprecationWarning') && !s.includes('on_event')) {
      process.stderr.write('[API:ERR] ' + s);
    }
  });
  pythonBackend.on('exit', code => {
    console.log('[Aegis] Python backend exited:', code);
    pythonBackend = null;
  });
  pythonBackend.on('error', err => {
    console.error('[Aegis] Failed to start Python backend:', err.message);
    pythonBackend = null;
  });
}

// ── Window Factory ───────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 680,
    backgroundColor: '#fafaf9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startPythonBackend();
  // Wait for FastAPI to be ready before opening window
  setTimeout(createWindow, 2500);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  shutdownAll();
  if (process.platform !== 'darwin') app.quit();
});

function shutdownAll() {
  if (testerProcess) { try { testerProcess.kill('SIGTERM'); } catch (_) {} testerProcess = null; }
  if (pythonBackend)  { try { pythonBackend.kill('SIGTERM');  } catch (_) {} pythonBackend  = null; }
}

// ── IPC: Backend Status ──────────────────────────────────────────────────────
ipcMain.handle('get-backend-status', () => ({
  running: !!(pythonBackend && !pythonBackend.killed),
  pid: pythonBackend?.pid ?? null,
}));

// ── IPC: Run Load Tester ─────────────────────────────────────────────────────
ipcMain.handle('run-tester', async (_event, { mode, duration, workers }) => {
  // Kill any existing tester
  if (testerProcess) {
    try { testerProcess.kill('SIGTERM'); } catch (_) {}
    testerProcess = null;
  }

  const script = path.join(PROJECT_ROOT, 'tests', 'real_world_tester.py');
  const args = [
    script,
    '--mode', mode,
    '--target', 'http://localhost:8000/ingest',
    '--duration', String(duration || 20),
    '--workers', String(workers || 8),
  ];

  console.log('[Aegis] Spawning tester:', args.join(' '));

  testerProcess = spawn('python', args, {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });

  const fwd = (stream, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('tester-line', { stream, line: data.toString() });
    }
  };

  testerProcess.stdout.on('data', d => fwd('stdout', d));
  testerProcess.stderr.on('data', d => fwd('stderr', d));
  testerProcess.on('exit', code => {
    fwd('system', `\n[ Process exited — code ${code ?? '?'} ]\n`);
    testerProcess = null;
  });
  testerProcess.on('error', err => {
    fwd('system', `\n[ Spawn error: ${err.message} ]\n`);
    testerProcess = null;
  });

  return { ok: true, mode, duration, workers, pid: testerProcess.pid };
});

// ── IPC: Kill Tester ─────────────────────────────────────────────────────────
ipcMain.handle('kill-tester', () => {
  if (testerProcess) {
    try { testerProcess.kill('SIGTERM'); } catch (_) {}
    testerProcess = null;
    return { killed: true };
  }
  return { killed: false };
});

// ── IPC: Run Entropy Demo ────────────────────────────────────────────────────
ipcMain.handle('run-demo', () => {
  const script = path.join(PROJECT_ROOT, 'tests', 'real_world_tester.py');
  const proc = spawn('python', [script, '--demo'], {
    cwd: PROJECT_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
  });
  proc.stdout.on('data', d => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('tester-line', { stream: 'stdout', line: d.toString() });
  });
  proc.stderr.on('data', d => {
    if (mainWindow && !mainWindow.isDestroyed())
      mainWindow.webContents.send('tester-line', { stream: 'stderr', line: d.toString() });
  });
  return { ok: true };
});
