/** USB-to-serial chipsets commonly found in radio programming cables. */
export type ChipsetId = 'ch340' | 'cp210x' | 'pl2303' | 'ftdi' | 'unknown';

export interface ChipsetDescriptor {
  readonly id: ChipsetId;
  readonly displayName: string;
  /** Lowercase 4-digit hex, no prefix. */
  readonly vendorIds: readonly string[];
  readonly productIds: readonly string[];
  /** Official vendor driver download page, shown in the driver help UI. */
  readonly driverUrl: string;
}

export const CHIPSETS: readonly ChipsetDescriptor[] = [
  {
    id: 'ch340',
    displayName: 'WCH CH340 / CH341',
    vendorIds: ['1a86'],
    productIds: ['7523', '5523', '7522'],
    driverUrl: 'https://www.wch-ic.com/downloads/CH341SER_EXE.html',
  },
  {
    id: 'cp210x',
    displayName: 'Silicon Labs CP210x',
    vendorIds: ['10c4'],
    productIds: ['ea60', 'ea70', 'ea71'],
    driverUrl:
      'https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers',
  },
  {
    id: 'pl2303',
    displayName: 'Prolific PL2303',
    vendorIds: ['067b'],
    productIds: ['2303', '23a3', '23c3'],
    driverUrl: 'https://www.prolific.com.tw/US/ShowProduct.aspx?p_id=225&pcid=41',
  },
  {
    id: 'ftdi',
    displayName: 'FTDI FT232',
    vendorIds: ['0403'],
    productIds: ['6001', '6015'],
    driverUrl: 'https://ftdichip.com/drivers/vcp-drivers/',
  },
];

/** Fallback for cables that expose no standard COM port. */
export const ZADIG_URL = 'https://zadig.akeo.ie/';
