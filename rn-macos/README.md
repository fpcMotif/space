# Space — fractal rooms (React Native macOS prototype)

A React Native macOS prototype of the "fractal rooms" window manager: windows
tile as a recursive split tree (row / column / stack), any node can be named
(a "room"), and you zoom into any node so it fills the screen. This explores
the same idea as the Swift menu-bar app in `../Sources/Rooms`, as an
alternative, JS-driven front end.

## Stack and why

- **react-native**: `0.81.6`
- **react-native-macos**: `0.81.9` (Microsoft's out-of-tree macOS platform)
- **Xcode**: 27.0 (27A5237l) · **macOS**: 27.0 (26A5425a), both confirmed working
- **Package manager**: bun (`bun`/`bunx`); CocoaPods for native deps

**Plain react-native-macos, not Expo.** Expo's own docs describe macOS support
through `react-native-test-app` as experimental — config plugins there import
from `react-native-test-app/plugins/macos` instead of `@expo/config-plugins`,
and only macOS/tvOS get this treatment among Expo's platform-expansion targets.
That's an extra layer of indirection for a prototype that needs full native
control anyway (a custom Swift/Obj-C Accessibility-API module, an unsandboxed
entitlements file, `NSScreen`/`NSEvent` access) — none of which benefits from
Expo's managed workflow. Plain `react-native-macos` gives a normal Xcode
project you fully own, which is what a native module like this needs.

**Version pairing.** `react-native-macos` publishes its own patch releases
independently of core React Native and currently trails it substantially:
core `react-native`'s latest is `0.87.1` (with `0.88` in RC) while
`react-native-macos`'s newest release is `0.81.9`, and core never published a
`0.81.9` at all (it stopped at `0.81.6`). The docs' rule is to match the
*minor* version between the two, so this project pins core React Native to
the highest `0.81.x` that exists (`0.81.6`) and lets the macOS fork float to
its own latest `0.81.9` patch. Worth naming as a real cost of this stack: you
are always several minor versions behind whatever's current in React Native.

**Xcode 27 risk, resolved empirically.** Xcode 27 (macOS 27) is very new and
not something `react-native-macos` 0.81 was built against. It was not treated
as a blocker — it was tried, and it built and ran cleanly (`pod install`,
Debug and Release `xcodebuild`, and a real launch all succeeded; see below).

## Running it

```sh
cd rn-macos
bun install
pod install --project-directory=macos   # already run once; re-run after native deps change
bun start                                # Metro, needed for Debug only
bun run macos                            # or: xcodebuild ... (see below)
```

Exact command used to verify a Debug build from the CLI (no Xcode GUI):

```sh
cd rn-macos/macos
xcodebuild -workspace space.fractal.rooms.xcworkspace \
  -scheme "space.fractal.rooms-macOS" -configuration Debug \
  -destination 'platform=macOS' build
```

This succeeded, producing
`~/Library/Developer/Xcode/DerivedData/space.fractal.rooms-*/Build/Products/Debug/space.fractal.rooms.app`.
A Release build (`-configuration Release`) also succeeded and embeds the JS
bundle, so it runs standalone without Metro.

The app was launched from the command line (Metro running for the Debug
build), its window was found via `CGWindowListCopyWindowInfo` (a tiny Swift
script, `scratchpad/findwindow_all.swift` during this session — see the repo's
own `Tools/desksnap.swift` for the same technique), and screenshotted with
`screencapture -l <windowid>`. Screenshot: **`rn-macos/docs/screenshot.png`**
(Debug build; `docs/screenshot-release.png` is the same scene from the
standalone Release build, included as a bonus).

## What works

- **Data model**: `src/space/types.ts` matches the shared
  `~/Library/Application Support/Space/space.json` format exactly (`Node`,
  `arrange`, `weight`, `active`, `zoom`, `marks`). The file is only ever read
  (`SpaceWindows.readSpaceFile`), never written. If it's missing or invalid
  JSON, `src/space/demoTree.ts`'s built-in demo tree is used instead — three
  named rooms (Design, Build, Notes) with nested row/column/stack children
  and window leaves across `com.apple.Safari`, `com.apple.Notes`,
  `com.apple.Terminal`, `com.apple.finder`.
- **Layout** (`src/space/layout.ts`): recursive row/column/stack splitting
  with a 16pt gap between siblings and around the zoomed node, exactly as
  specified. The level-of-detail rule (a split that would give any child
  less than 360×240 degrades to a stack) is implemented and demonstrated —
  shrink the window and the three top-level rooms collapse into a stack.
  A stack only paints its active card; other members share its rect but are
  flagged `peeked` and skipped by the renderer, so they don't paint illegible
  overlapping text underneath (a real bug hit and fixed during this session —
  see `LaidOutNode.peeked`).
- **Native module** (`modules/space-windows/macos/SpaceWindows.m`, plain
  Objective-C): `isTrusted`, `requestTrust`, `listWindows`, `setFrame`
  (size → position → size), `raise`, `visibleFrame`, `readSpaceFile`. Windows
  are matched to a window number via the same private
  `_AXUIElementGetWindow` dlsym trick `Sources/Rooms/Windows/AX.swift` uses,
  with a 0.5s `AXUIElementSetMessagingTimeout`. Ships as a local autolinked
  CocoaPod (`space-windows` npm package, `file:./modules/space-windows`), so
  no manual Xcode project surgery was needed.
- **Interactions** (`App.tsx`, `src/components/NodePanel.tsx`,
  `src/components/RoomCanvas.tsx`, `src/useSpace.ts`): click to focus,
  double-click to zoom in, right-click or Escape to zoom out, `h`/`j`/`k`/`l`
  for spatial focus movement (nearest sibling by rect position), `Enter` to
  zoom into the focused node, `0` for the overview, and an ~180ms
  scale+fade zoom transition (`Animated`, native driver). Scroll/pinch zoom
  is wired through a zero-travel `ScrollView` (native `NSScrollView`
  magnification and wheel scrolling captured via `onScroll`'s `zoomScale`
  and `contentOffset`, then recentered every event) — a legitimate use of a
  real native gesture path, not a fabricated one.
- **Apply** (button and the `a` key): lays out the zoomed node's real windows
  via the native module. Leaves are matched to live windows by `windowID`,
  then exact title (within the same bundle ID), then bundle ID
  (`src/space/matching.ts`), each live window claimed at most once. Stack
  members are all positioned (they share a rect) and raised in the same
  order they were laid out in, so a stack's active child — ordered last by
  `layoutTree` — ends up frontmost.
- **Entitlements**: the generated `space.fractal.rooms.entitlements` had
  `com.apple.security.app-sandbox = true` by default (the react-native-macos
  template's default), which blocks both cross-app Accessibility control and
  reading a file outside the sandbox container. Turned off, matching
  `Sources/Rooms` (unsandboxed).

## What doesn't, or wasn't verified

- **Accessibility trust**: the toolbar's "Grant Accessibility…" button (it
  calls `AXIsProcessTrustedWithOptions` with the prompt option) never
  appeared across repeated launches of both the Debug and Release builds in
  this environment, meaning `isTrusted()` returned true — Accessibility
  already appears to be granted for this build here. If it isn't for you,
  the button (or macOS's own prompt) will appear; per the task, no attempt
  was made to grant it by changing system settings.
- **Interactive gestures weren't exercised end-to-end.** This session
  automated the build/launch/screenshot loop from a shell with no
  Accessibility permission of its own — `osascript`'s attempt to send a
  keystroke to the app failed outright ("osascript is not allowed to send
  keystrokes"). So click/double-click/right-click/`hjkl`/`Enter`/`0`/Apply
  are implemented and reviewed but only the initial render was actually
  driven and screenshotted; they weren't clicked through interactively.
- **Marks** (`marks: {letter: path}` in space.json) are read into state but
  there's no UI to set or jump to one — not in the task's required
  interaction list, so left out rather than half-built.
- **Named-container header carve-out**: a named container reserves a 28pt
  strip along its top edge for its own label, so it doesn't sit on top of
  its first child's label. This isn't in the task's layout spec; it's a
  minimal fix for real overlapping text hit during development (see git
  history / session notes) — an alternative would be to only show a
  container's name when nothing already occupies that corner.
- **iOS/Android**: `react-native init` scaffolds `ios/` and `android/` by
  default; they exist but are untouched and untested — this prototype is
  macOS-only per the task.
- A LogBox "Open debugger to view warnings" banner appears in the Debug
  build (gone in Release, confirming it's a dev-only notice); its exact
  source wasn't tracked down since it didn't affect rendering or behavior.

## Measurements

All measured on this machine (Apple Silicon, macOS 27.0), launching the
built `.app` directly (`open`/`Contents/MacOS/space.fractal.rooms`), not
through Xcode's debugger.

| | Debug | Release |
|---|---|---|
| App bundle size (`du -sh`) | 40M | 32M |
| Cold launch → window on screen | ~2s (Metro already running) | ~2–3s (standalone, no Metro) |
| Resident memory, settled (`ps -o rss`) | ~93 MB | ~94 MB |
| Resident memory, peak during launch | ~180 MB (transient, before JS settles) | ~137 MB |

Release embeds the JS bundle (`main.jsbundle`) into the app and needs no
Metro server; Debug fetches it from `localhost:8081` each launch.

## Verdict: React Native macOS vs. the native Swift app

For this specific product — a window manager driven almost entirely by the
Accessibility API, `NSScreen`, and `NSWorkspace` — the native Swift app
(`Sources/Rooms`) is the better fit, and this prototype's own shape argues
for that conclusion rather than against it:

- Nearly everything interesting here (listing windows, moving them, reading
  screen geometry, the dlsym trick for window IDs) had to be written in
  Objective-C/Swift regardless. React Native's contribution was the *tree
  rendering and interaction layer* — panels, zoom, gestures — while the
  actual "window manager" logic still lives in `SpaceWindows.m`, a close
  cousin of `AX.swift`. RN didn't remove native code; it added a bridge to it.
- The bridge has a real, measured cost: this is a ~35 MB average app bundle
  and ~90 MB resident just to show some rounded rectangles, next to a
  menu-bar Swift app that (per its own README/screenshots) is a fraction of
  that. For a background utility that's meant to live in the menu bar
  unnoticed, that's the wrong direction.
- The version-pairing story above (`react-native-macos` trailing core RN by
  several minors, publishing its own patch line) is a maintenance tax that
  doesn't exist for a pure Swift target, and this is a small, low-traffic
  fork — Xcode 27 support, for one example, isn't something to expect on any
  particular timeline.
- Where RN *did* earn its keep: the fractal-zoom UI itself (animated
  transitions, a declarative tree-of-panels, fast iteration on layout math
  in TypeScript with instant Metro reloads) was noticeably quicker to build
  and much more pleasant to restyle than the equivalent would be in AppKit —
  if the product were mostly *this view* (a visual room browser/dashboard
  shown occasionally, not a background daemon), that tradeoff inverts.

Net: keep the window-manipulation core in Swift either way; only reach for
React Native macOS if the product's center of gravity shifts toward being an
always-visible, frequently-redesigned visual surface rather than a
low-footprint background tool.
