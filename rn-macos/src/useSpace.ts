import { useCallback, useEffect, useMemo, useState } from 'react';
import SpaceWindows from 'space-windows';
import { demoTree } from './space/demoTree';
import { GAP, getNode, insetRect, layoutTree } from './space/layout';
import { matchWindow } from './space/matching';
import { parentPath, pathEqual } from './space/paths';
import type { LaidOutNode, SpaceFile, SpaceNode } from './space/types';

type Source = 'demo' | 'file';

export interface ApplyResult {
  placed: number;
  missing: number;
  at: number;
}

/** A sensible first focus under `basePath`: its first child, or itself if
 * it's a leaf — the empty root path itself is never a useful focus target. */
function defaultFocus(node: SpaceNode, basePath: number[]): number[] {
  return node.children && node.children.length > 0 ? [...basePath, 0] : basePath;
}

export function useSpace() {
  const [root, setRoot] = useState<SpaceNode>(demoTree);
  const [source, setSource] = useState<Source>('demo');
  const [zoomPath, setZoomPath] = useState<number[]>([]);
  const [focusPath, setFocusPath] = useState<number[]>(() => defaultFocus(demoTree, []));
  const [trusted, setTrusted] = useState<boolean | null>(null);
  const [applyResult, setApplyResult] = useState<ApplyResult | null>(null);
  const [applying, setApplying] = useState(false);

  // Load the shared file once, if present. Never written back to.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await SpaceWindows.readSpaceFile();
        if (cancelled || typeof raw !== 'string') return;
        const parsed = JSON.parse(raw) as SpaceFile;
        if (parsed && parsed.root) {
          const zoom = Array.isArray(parsed.zoom) ? parsed.zoom : [];
          setRoot(parsed.root);
          setSource('file');
          setZoomPath(zoom);
          setFocusPath(defaultFocus(getNode(parsed.root, zoom) ?? parsed.root, zoom));
        }
      } catch {
        // No file, unreadable, or invalid JSON: keep the demo tree.
      }
      try {
        const isTrusted = await SpaceWindows.isTrusted();
        if (!cancelled) setTrusted(Boolean(isTrusted));
      } catch {
        if (!cancelled) setTrusted(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const zoomedNode = useMemo(() => getNode(root, zoomPath) ?? root, [root, zoomPath]);

  /** Lays out the current zoomed node over `rect` (render points or AX
   * points) — the zoomed node gets `rect` inset by the outer gap, per the
   * task's layout spec. */
  const layoutFor = useCallback(
    (rect: { x: number; y: number; width: number; height: number }): LaidOutNode[] => {
      const relative = layoutTree(zoomedNode, insetRect(rect, GAP));
      return relative.map(n => ({ ...n, path: [...zoomPath, ...n.path] }));
    },
    [zoomedNode, zoomPath],
  );

  const zoomTo = useCallback((path: number[]) => {
    setZoomPath(path);
    setFocusPath(path);
  }, []);

  const zoomIn = useCallback(
    (path?: number[]) => {
      const target = path ?? focusPath;
      if (getNode(root, target)) zoomTo(target);
    },
    [focusPath, root, zoomTo],
  );

  const zoomOut = useCallback(() => {
    if (zoomPath.length === 0) return;
    const parent = parentPath(zoomPath);
    setZoomPath(parent);
    setFocusPath(zoomPath); // land on the room you just zoomed out of
  }, [zoomPath]);

  const zoomOverview = useCallback(() => {
    if (zoomPath.length > 0) setFocusPath(zoomPath);
    setZoomPath([]);
  }, [zoomPath]);

  const focus = useCallback((path: number[]) => setFocusPath(path), []);

  /** hjkl: moves focus to the nearest sibling (of the focused node's parent,
   * or of the zoomed node's direct children if focus is the zoomed node
   * itself) in the given direction. */
  const moveFocus = useCallback(
    (direction: 'h' | 'j' | 'k' | 'l', nodes: LaidOutNode[]) => {
      const current = nodes.find(n => pathEqual(n.path, focusPath));
      if (!current) return;
      const siblings = pathEqual(focusPath, zoomPath)
        ? nodes.filter(n => n.path.length === zoomPath.length + 1)
        : nodes.filter(
            n => n.path.length === focusPath.length && pathEqual(parentPath(n.path), parentPath(focusPath)),
          );

      const cx = current.rect.x + current.rect.width / 2;
      const cy = current.rect.y + current.rect.height / 2;
      let best: LaidOutNode | null = null;
      let bestScore = Infinity;
      for (const n of siblings) {
        if (pathEqual(n.path, focusPath)) continue;
        const nx = n.rect.x + n.rect.width / 2;
        const ny = n.rect.y + n.rect.height / 2;
        const dx = nx - cx;
        const dy = ny - cy;
        let primary = 0;
        let perpendicular = 0;
        let ok = false;
        switch (direction) {
          case 'l':
            ok = dx > 1;
            primary = dx;
            perpendicular = Math.abs(dy);
            break;
          case 'h':
            ok = dx < -1;
            primary = -dx;
            perpendicular = Math.abs(dy);
            break;
          case 'j':
            ok = dy > 1;
            primary = dy;
            perpendicular = Math.abs(dx);
            break;
          case 'k':
            ok = dy < -1;
            primary = -dy;
            perpendicular = Math.abs(dx);
            break;
        }
        if (!ok) continue;
        const score = primary + perpendicular * 2;
        if (score < bestScore) {
          bestScore = score;
          best = n;
        }
      }
      if (best) setFocusPath(best.path);
    },
    [focusPath, zoomPath],
  );

  /** Lays out the zoomed node's real windows via the native module. */
  const apply = useCallback(async () => {
    setApplying(true);
    try {
      const visible = await SpaceWindows.visibleFrame();
      // Every window leaf gets positioned, including inactive stack members
      // (they share the active card's rect); traversal order already puts
      // each stack's active child last, so the raise loop below ends up
      // with the right one frontmost without any extra filtering.
      const placements = layoutTree(zoomedNode, insetRect(visible, GAP)).filter(n => n.node.window);
      const live = await SpaceWindows.listWindows();
      const used = new Set<number>();
      let placed = 0;
      const missing: string[] = [];

      // Matches must be resolved in the same order they're applied in, both
      // times, so the same leaf claims the same live window each pass.
      for (const p of placements) {
        const ref = p.node.window!;
        const match = matchWindow(ref, live, used);
        if (!match) {
          missing.push(ref.app ?? ref.bundleID);
          continue;
        }
        used.add(match.windowID);
        await SpaceWindows.setFrame(match.windowID, p.rect);
      }
      // Raise in the same order the panels were laid out (stack's active
      // child is ordered last, so it ends up frontmost within its stack).
      const raised = new Set<number>();
      for (const p of placements) {
        const match = matchWindow(p.node.window!, live, raised);
        if (!match) continue;
        raised.add(match.windowID);
        await SpaceWindows.raise(match.windowID);
      }
      setApplyResult({ placed: placements.length - missing.length, missing: missing.length, at: Date.now() });
    } finally {
      setApplying(false);
    }
  }, [zoomedNode]);

  return {
    root,
    source,
    zoomPath,
    focusPath,
    zoomedNode,
    trusted,
    applying,
    applyResult,
    layoutFor,
    zoomTo,
    zoomIn,
    zoomOut,
    zoomOverview,
    focus,
    moveFocus,
    apply,
    requestTrust: () => SpaceWindows.requestTrust(),
  };
}
