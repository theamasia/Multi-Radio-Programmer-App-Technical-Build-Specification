/**
 * IPC channel names and payload contracts.
 *
 * The renderer has no Node access and no direct serial or database access. This
 * module is the only surface between the two processes; every channel added
 * here must validate its inputs in the main process.
 */
export const IPC = {
  serialListPorts: 'serial:listPorts',
  driverList: 'driver:list',
  driverDetect: 'driver:detect',
  codeplugRead: 'codeplug:read',
  codeplugWrite: 'codeplug:write',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
