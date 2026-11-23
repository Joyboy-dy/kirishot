/** The Linux port detects its platform from the user agent: the IPC bindings expose none. */
export const isLinux =
  typeof navigator !== 'undefined' && /Linux/i.test(navigator.userAgent);
