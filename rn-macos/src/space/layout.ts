import type { Arrange, LaidOutNode, Rect, SpaceNode } from './types';

/** Gap between siblings and between the zoomed node and the screen edge. */
export const GAP = 16;
/** Below this, a row/column split degrades to a stack (see task brief). */
const MIN_W = 360;
const MIN_H = 240;
/** A named container reserves this much of its own top edge for its label,
 * so the name doesn't sit exactly on top of its first child's own label. */
const HEADER_HEIGHT = 28;

export function insetRect(rect: Rect, by: number): Rect {
  return {
    x: rect.x + by,
    y: rect.y + by,
    width: Math.max(0, rect.width - by * 2),
    height: Math.max(0, rect.height - by * 2),
  };
}

/**
 * Lays out `node` (treated as the root, filling `rect`) and every descendant,
 * depth-first. Paths in the result are relative to `node` ([] is node itself).
 *
 * Stack children are ordered with the active child last, so both rendering
 * (later siblings paint on top) and Apply's raise order (later == frontmost)
 * fall out of the same traversal for free.
 */
export function layoutTree(
  node: SpaceNode,
  rect: Rect,
  path: number[] = [],
  depth = 0,
  peeked = false,
): LaidOutNode[] {
  const out: LaidOutNode[] = [{ node, path, rect, depth, peeked }];
  const children = node.children;
  if (!children || children.length === 0) return out;

  // A named container's own label lives in a strip along its top edge;
  // children are laid out below it instead of under the same corner.
  const contentRect = node.name
    ? { x: rect.x, y: rect.y + HEADER_HEIGHT, width: rect.width, height: Math.max(0, rect.height - HEADER_HEIGHT) }
    : rect;

  let arrange: Arrange = node.arrange ?? 'row';
  let childRects: Rect[] | null = null;

  if (arrange === 'row' || arrange === 'column') {
    childRects = splitRects(contentRect, children, arrange);
    const fitsLOD = childRects.every(r => r.width >= MIN_W && r.height >= MIN_H);
    if (!fitsLOD) {
      arrange = 'stack';
      childRects = null;
    }
  }

  const activeIndex = arrange === 'stack' ? node.active ?? 0 : null;
  const order = stackOrder(children.length, activeIndex);
  for (const i of order) {
    const childRect = childRects ? childRects[i] : contentRect;
    // A stack shows one card at a time: every non-active child, and its
    // whole subtree, is a hidden "peek" sharing the active child's rect.
    const childPeeked = peeked || (activeIndex != null && i !== activeIndex);
    out.push(...layoutTree(children[i], childRect, [...path, i], depth + 1, childPeeked));
  }
  return out;
}

/** Child indexes in paint/raise order: natural order, except in a stack the
 * active child is moved last so it paints on top and gets raised frontmost. */
function stackOrder(count: number, activeIndex: number | null): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  if (activeIndex == null) return order;
  return order.sort((a, b) => (a === activeIndex ? 1 : 0) - (b === activeIndex ? 1 : 0) || a - b);
}

function splitRects(rect: Rect, children: SpaceNode[], arrange: 'row' | 'column'): Rect[] {
  const n = children.length;
  const weights = children.map(c => Math.max(0.0001, c.weight ?? 1));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const gapTotal = GAP * Math.max(0, n - 1);
  const rects: Rect[] = [];

  if (arrange === 'row') {
    const avail = Math.max(0, rect.width - gapTotal);
    let x = rect.x;
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const w = isLast ? Math.max(0, rect.x + rect.width - x) : Math.round((avail * weights[i]) / totalWeight);
      rects.push({ x, y: rect.y, width: w, height: rect.height });
      x += w + GAP;
    }
  } else {
    const avail = Math.max(0, rect.height - gapTotal);
    let y = rect.y;
    for (let i = 0; i < n; i++) {
      const isLast = i === n - 1;
      const h = isLast ? Math.max(0, rect.y + rect.height - y) : Math.round((avail * weights[i]) / totalWeight);
      rects.push({ x: rect.x, y, width: rect.width, height: h });
      y += h + GAP;
    }
  }
  return rects;
}

/** Walks `path` down from `root`, or null if the path doesn't exist. */
export function getNode(root: SpaceNode, path: number[]): SpaceNode | null {
  let node = root;
  for (const i of path) {
    if (!node.children || !node.children[i]) return null;
    node = node.children[i];
  }
  return node;
}
