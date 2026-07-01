/**
 * Anndevta POS — Electron Preload Script
 *
 * Exposes a minimal, safe API to the renderer via contextBridge.
 * Node integration is disabled in the renderer for security.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /** App version from package.json */
  getVersion: () => ipcRenderer.invoke('get-version'),

  /** Open the log directory in Windows Explorer */
  openLogs: () => ipcRenderer.invoke('open-logs'),

  /** Platform info */
  platform: process.platform,
});
