'use strict';

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

// ── Path resolution ──────────────────────────────────────────────────────────
// In dev: desktop_client/ → project root is two levels up, backend/tester run
// as plain scripts under the system `python`.
// In packaged builds there is no system Python dependency at all — the
// backend and load-tester are PyInstaller-frozen executables shipped as
// extraResources (see package.json's build.extraResources and
// packaging/*.spec), laid out as:
//   resources/backend/api_server.exe (+ _internal/)
//   resources/tester/tester.exe (+ _internal/)
//   resources/web_dashboard/...
const PROJECT_ROOT = path.join(__dirname, '..', '..');

let mainWindow = null;
let pythonBackend = null;
let testerProcess = null;

// Spawns either the dev-mode Python script or the packaged frozen executable
// for the given tool, so every call site doesn't need to branch itself.
function launch(kind, extraArgs = []) {
  if (isDev) {
    const script = kind === 'backend'
      ? path.join(PROJECT_ROOT, 'core_backend', 'api_server.py')
      : path.join(PROJECT_ROOT, 'tests', 'real_world_tester.py');
    return spawn('python', [script, ...extraArgs], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' },
    });
  }
  const dir = path.join(process.resourcesPath, kind === 'backend' ? 'backend' : 'tester');
  const exeName = kind === 'backend' ? 'api_server' : 'tester';
  const exe = path.join(dir, process.platform === 'win32' ? `${exeName}.exe` : exeName);
  return spawn(exe, extraArgs, {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  });
}

// ── Python Backend Spawner ───────────────────────────────────────────────────
function startPythonBackend() {
  console.log('[Aegis] Spawning backend (dev=' + isDev + ')');
  pythonBackend = launch('backend');

  pythonBackend.stdout.on('data', d => process.stdout.write('[API] ' + d));
  pythonBackend.stderr.on('data', d => {
    const s = d.toString();
    if (!s.includes('DeprecationWarning') && !s.includes('on_event')) {
      process.stderr.write('[API:ERR] ' + s);
    }
  });
  pythonBackend.on('exit', code => {
    console.log('[Aegis] Backend exited:', code);
    pythonBackend = null;
  });
  pythonBackend.on('error', err => {
    console.error('[Aegis] Failed to start backend:', err.message);
    pythonBackend = null;
  });
}

// ── Window Factory ───────────────────────────────────────────────────────────
function createWindow() {
  // Electron ships a default application menu whose Cmd/Ctrl+Plus "Zoom In"
  // accelerator is notoriously unreliable across keyboard layouts (the "+"
  // key reports differently depending on whether Shift is involved). We
  // remove it and implement zoom explicitly in preload.js via webFrame,
  // which is reliable and also lets Ctrl+Minus/Ctrl+0 keep working the same way.
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 960,
    height: 650,
    minWidth: 960,
    minHeight: 650,
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

  const args = [
    '--mode', mode,
    '--target', 'http://localhost:8000/ingest',
    '--duration', String(duration || 20),
    '--workers', String(workers || 8),
  ];

  console.log('[Aegis] Spawning tester:', args.join(' '));

  testerProcess = launch('tester', args);

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
  const proc = launch('tester', ['--demo']);
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
