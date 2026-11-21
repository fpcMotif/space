import { NativeModules } from 'react-native';

const { SpaceWindows } = NativeModules;

// In a normal macOS build this is always linked (see SpaceWindows.podspec /
// autolinking). It's missing under Jest's default preset, which doesn't run
// autolinking; fall back to no-ops there instead of crashing the bundle.
const fallback = {
  isTrusted: async () => false,
  requestTrust: async () => false,
  listWindows: async () => [],
  setFrame: async () => false,
  raise: async () => false,
  visibleFrame: async () => ({ x: 0, y: 0, width: 1280, height: 800 }),
  readSpaceFile: async () => null,
};

if (!SpaceWindows) {
  console.warn(
    'SpaceWindows native module is not linked; using no-op stubs. Run `bun install` then `pod install --project-directory=macos`.',
  );
}

export default SpaceWindows
  ? {
      isTrusted: () => SpaceWindows.isTrusted(),
      requestTrust: () => SpaceWindows.requestTrust(),
      listWindows: () => SpaceWindows.listWindows(),
      setFrame: (windowID, rect) => SpaceWindows.setFrame(windowID, rect),
      raise: windowID => SpaceWindows.raise(windowID),
      visibleFrame: () => SpaceWindows.visibleFrame(),
      readSpaceFile: () => SpaceWindows.readSpaceFile(),
    }
  : fallback;
