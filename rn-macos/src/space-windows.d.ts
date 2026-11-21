declare module 'space-windows' {
  interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
  }
  interface LiveWindowInfo {
    pid: number;
    bundleID: string;
    app: string;
    title: string;
    windowID: number;
    frame: Rect;
  }
  interface SpaceWindowsModule {
    isTrusted(): Promise<boolean>;
    requestTrust(): Promise<boolean>;
    listWindows(): Promise<LiveWindowInfo[]>;
    setFrame(windowID: number, rect: Rect): Promise<boolean>;
    raise(windowID: number): Promise<boolean>;
    visibleFrame(): Promise<Rect>;
    readSpaceFile(): Promise<string | null>;
  }
  const SpaceWindows: SpaceWindowsModule;
  export default SpaceWindows;
}
