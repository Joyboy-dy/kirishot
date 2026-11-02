import type { SettingsPatch } from '@/lib/ipc';

/** A settings patch that changes nothing, to spread with the one field to change. */
export const NO_CHANGE: SettingsPatch = {
  saveFolder: null,
  saveFormat: null,
  autoAction: null,
  magnifier: null,
  sound: null,
  flash: null,
  thumbnail: null,
  thumbnailDuration: null,
  alwaysOpenEditor: null,
};
