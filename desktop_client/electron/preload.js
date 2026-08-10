'use strict';

const { contextBridge, ipcRenderer } = require('electron');

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
