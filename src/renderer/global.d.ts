import type { RadioApi } from '../preload/index.js';

declare global {
  interface Window {
    readonly radioApi: RadioApi;
  }
}
