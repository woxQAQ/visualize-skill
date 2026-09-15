import type { Position, Rect } from "./model.ts";
import { overlaps } from "./routing.ts";

interface Link {
  from: string;
  to: string;
}

/** Assign dependency levels, ignoring DFS back edges only for placement; all links remain routed. */
export function dependencyLevels(
  ids: readonly string[],
  links: readonly Link[],
): Map<string, number> {
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  for (const { from, to } of links) {
    if (from !== to && outgoing.has(from) && outgoing.has(to)) outgoing.get(from)!.push(to);
  }
  const state = new Map<string, number>();
  const forward = new Map(ids.map((id) => [id, [] as string[]]));
  const order: string[] = [];
  function visit(id: string) {
    state.set(id, 1);
    for (const next of outgoing.get(id)!) {
      if (state.get(next) === 1) continue;
      forward.get(id)!.push(next);
      if (!state.has(next)) visit(next);
    }
    state.set(id, 2);
    order.push(id);
  }
  const targets = new Set(links.map((link) => link.to));
  for (const id of [...ids.filter((id) => !targets.has(id)), ...ids]) {
    if (!state.has(id)) visit(id);
  }
  const levels = new Map(ids.map((id) => [id, 0]));
  for (const id of order.reverse()) {
    for (const next of forward.get(id)!) {
      levels.set(next, Math.max(levels.get(next)!, levels.get(id)! + 1));
    }
  }
  return levels;
}

interface PlacementBox {
  id: string;
  width: number;
  height: number;
  position?: Position;
}

/** Place measured boxes in dependency order while reserving explicit local coordinates first. */
export function placeBoxes(
  boxes: readonly PlacementBox[],
  levels: ReadonlyMap<string, number>,
  {
    horizontal = false,
    maxWidth = 1080,
    columnWidth = Math.max(0, ...boxes.map((box) => box.width)) + 80,
    rowHeight = Math.max(0, ...boxes.map((box) => box.height)) + 80,
  } = {},
): Map<string, Rect> {
  const gap = 80;
  const placed = new Map<string, Rect>();
  for (const box of boxes) {
    if (box.position) placed.set(box.id, { ...box.position, width: box.width, height: box.height });
  }
  const columns = Math.max(1, Math.floor((maxWidth + gap) / columnWidth));
  let nextY = 0;
  for (const level of [...new Set(boxes.map((box) => levels.get(box.id) ?? 0))].sort(
    (a, b) => a - b,
  )) {
    const members = boxes.filter((box) => (levels.get(box.id) ?? 0) === level);
    let x = 0,
      y = nextY,
      height = 0;
    for (const box of members) {
      if (box.position) continue;
      if (horizontal) {
        x = (level % columns) * columnWidth;
        y = Math.floor(level / columns) * rowHeight;
      } else if (x > 0 && x + box.width > maxWidth) {
        x = 0;
        y += height + gap;
        height = 0;
      }
      const rect = { x, y, width: box.width, height: box.height };
      // Pins never move. Resolve automatic collisions by moving below occupied boxes.
      for (;;) {
        const conflicts = [...placed.values()].filter((other) => overlaps(rect, other, gap / 2));
        if (!conflicts.length) break;
        rect.y = Math.max(...conflicts.map((other) => other.y + other.height + gap));
      }
      placed.set(box.id, rect);
      if (!horizontal) {
        x += box.width + gap;
        height = Math.max(height, rect.y - y + box.height);
      }
    }
    nextY = y + height + gap;
  }
  return placed;
}
