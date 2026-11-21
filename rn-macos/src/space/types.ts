// Shared types for the space.json fractal-rooms format. Kept identical to
// the format documented in the task brief so this JS front end and the
// parallel Rust terminal app (and the Swift `Rooms` app) can share one file.

export type Arrange = 'row' | 'column' | 'stack';

export interface WindowRef {
  bundleID: string;
  app?: string;
  title?: string;
  windowID?: number;
}

export interface SpaceNode {
  name?: string;
  weight?: number;
  arrange?: Arrange;
  active?: number;
  children?: SpaceNode[];
  window?: WindowRef;
}

export interface SpaceFile {
  version: number;
  root: SpaceNode;
  zoom: number[];
  marks: Record<string, number[]>;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A node placed at an absolute path from the real root, with its rect in
 * whatever coordinate space the layout was computed for (render points, or
 * AX screen points). */
export interface LaidOutNode {
  node: SpaceNode;
  path: number[];
  rect: Rect;
  /** Depth relative to the node the layout pass started from (0 = that node itself). */
  depth: number;
  /** True if an ancestor is a stack container and this node isn't its active
   * child — it shares its rect with a visible sibling and shouldn't paint. */
  peeked: boolean;
}

/** A window actually open on screen right now (from the SpaceWindows native module). */
export interface LiveWindow {
  pid: number;
  bundleID: string;
  app: string;
  title: string;
  windowID: number;
  frame: Rect;
}
