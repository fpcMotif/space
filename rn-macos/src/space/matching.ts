import type { LiveWindow, WindowRef } from './types';

/**
 * Matches a space.json window leaf to a live window: windowID, then exact
 * title (within the same app), then bundleID. Each live window is used at
 * most once — `used` tracks windowIDs already claimed by an earlier leaf.
 */
export function matchWindow(ref: WindowRef, live: LiveWindow[], used: Set<number>): LiveWindow | null {
  const available = (w: LiveWindow) => !used.has(w.windowID);

  if (ref.windowID != null) {
    const byId = live.find(w => w.windowID === ref.windowID && available(w));
    if (byId) return byId;
  }
  if (ref.title) {
    const byTitle = live.find(w => w.bundleID === ref.bundleID && w.title === ref.title && available(w));
    if (byTitle) return byTitle;
  }
  return live.find(w => w.bundleID === ref.bundleID && available(w)) ?? null;
}
