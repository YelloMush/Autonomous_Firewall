'use strict';

const { contextBridge, ipcRenderer, webFrame } = require('electron');

// ── Zoom (Ctrl/Cmd +/-/0) ─────────────────────────────────────────────────────
// Electron's built-in "Zoom In" menu accelerator is bound to the Plus key, but
// on most layouts Plus is Shift+Equals — key-matching for that combo is flaky,
// which is why zoom-out (a plain, unshifted "-") works while zoom-in doesn't.
// We removed the default menu (see main.js) and handle zoom ourselves here,
// checking both possible key values for the zoom-in chord so it's reliable
// regardless of layout.
const ZOOM_STEP = 0.5;
const ZOOM_MIN = -4;
const ZOOM_MAX = 6;

window.addEventListener('keydown', (e) => {
  const cmdOrCtrl = process.platform === 'darwin' ? e.metaKey : e.ctrlKey;
  if (!cmdOrCtrl) return;

  if (e.key === '=' || e.key === '+') {
    e.preventDefault();
    webFrame.setZoomLevel(Math.min(ZOOM_MAX, webFrame.getZoomLevel() + ZOOM_STEP));
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    webFrame.setZoomLevel(Math.max(ZOOM_MIN, webFrame.getZoomLevel() - ZOOM_STEP));
  } else if (e.key === '0') {
    e.preventDefault();
    webFrame.setZoomLevel(0);
  }
}, { capture: true });

contextBridge.exposeInMainWorld('aegis', {
  // ── Backend ────────────────────────────────────────────────────────────────
  getBackendStatus: () => ipcRenderer.invoke('get-backend-status'),

  // ── Load Tester ────────────────────────────────────────────────────────────
  runTester: (mode, duration, workers) =>
    ipcRenderer.invoke('run-tester', { mode, duration, workers }),
  killTester: () => ipcRenderer.invoke('kill-tester'),
  runDemo:    () => ipcRenderer.invoke('run-demo'),

  // ── Tester stdout/stderr stream ────────────────────────────────────────────
  // Returns an unsubscribe function
  onTesterLine: (callback) => {
    const handler = (_evt, data) => callback(data);
    ipcRenderer.on('tester-line', handler);
    return () => ipcRenderer.removeListener('tester-line', handler);
  },
});
