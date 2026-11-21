// Small helpers for node paths (child indexes from the real root), used to
// address zoom/focus state the same way space.json's `zoom` field does.

export function pathEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function isDescendant(path: number[], ancestor: number[]): boolean {
  return path.length >= ancestor.length && ancestor.every((v, i) => path[i] === v);
}

export function parentPath(path: number[]): number[] {
  return path.slice(0, -1);
}
