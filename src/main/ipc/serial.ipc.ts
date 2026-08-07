import { ipcMain } from 'electron';
import { IPC } from '../../shared/types/ipc.js';
import { listPorts } from '../serial/SerialManager.js';

export function registerSerialIpc(): void {
  ipcMain.handle(IPC.serialListPorts, async () => listPorts());
}
