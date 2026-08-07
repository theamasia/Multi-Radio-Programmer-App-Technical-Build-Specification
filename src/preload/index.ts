import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/types/ipc.js';

/**
 * The entire renderer-facing API surface.
 *
 * Deliberately enumerated rather than generic: exposing a pass-through
 * `invoke(channel, ...args)` would defeat the point of context isolation.
 */
const api = {
  listSerialPorts: () => ipcRenderer.invoke(IPC.serialListPorts),
  listDrivers: () => ipcRenderer.invoke(IPC.driverList),
  detectRadio: (portPath: string) => ipcRenderer.invoke(IPC.driverDetect, portPath),
} as const;

contextBridge.exposeInMainWorld('radioApi', api);

export type RadioApi = typeof api;
