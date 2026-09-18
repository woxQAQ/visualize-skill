import type { Alignment, Position } from "../types.ts";
import type { Rect } from "./model.ts";
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
  align?: Alignment;
}

/** Center measured boxes in dependency rows and columns; explicit coordinates remain fixed. */
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
  const automatic = boxes.filter((box) => !box.position);
  const groups = [...new Set(automatic.map((box) => levels.get(box.id) ?? 0))]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      members: automatic.filter((box) => (levels.get(box.id) ?? 0) === level),
    }));
  const rows = new Map<number, Map<number, PlacementBox>>();
  let widths: number[];
  if (horizontal) {
    const columns = Math.max(1, Math.floor((maxWidth + gap) / columnWidth));
    widths = Array.from({ length: columns }, () => columnWidth - gap);
    for (const { level, members } of groups) {
      for (const box of members) {
        const column = level % columns;
        let row = Math.floor(level / columns);
        while (rows.get(row)?.has(column)) row++;
        if (!rows.has(row)) rows.set(row, new Map());
        rows.get(row)!.set(column, box);
      }
    }
  } else {
    // Measure columns across all levels before placing any row. Unequal node
    // widths then share center lines without forcing every node to grow.
    let columns = Math.max(1, ...groups.map(({ members }) => members.length));
    for (;;) {
      widths = Array.from({ length: columns }, () => 0);
      for (const { members } of groups) {
        members.forEach((box, index) => {
          const column = index % columns;
          widths[column] = Math.max(widths[column], box.width);
        });
      }
      if (
        columns === 1 ||
        widths.reduce((sum, width) => sum + width, 0) + gap * (columns - 1) <= maxWidth
      )
        break;
      columns--;
    }
    for (const { members } of groups) {
      for (let index = 0; index < members.length; index += columns) {
        rows.set(
          rows.size,
          new Map(members.slice(index, index + columns).map((box, column) => [column, box])),
        );
      }
    }
  }
  const centers: number[] = [];
  let nextX = 0;
  for (const width of widths) {
    centers.push(nextX + width / 2);
    nextX += width + gap;
  }
  let nextY = 0;
  for (const [row, members] of [...rows].sort(([a], [b]) => a - b)) {
    const height = Math.max(
      horizontal ? rowHeight - gap : 0,
      ...[...members.values()].map((box) => box.height),
    );
    const top = Math.max(nextY, horizontal ? row * rowHeight : 0);
    const rects = [...members].map(([column, box]) => ({
      id: box.id,
      x: centers[column] - box.width / 2,
      y: top + (height - box.height) / 2,
      width: box.width,
      height: box.height,
    }));
    // Move the whole row around pins so collision resolution preserves its
    // horizontal center line as well as the column centers.
    let shift = 0;
    for (;;) {
      let required = 0;
      for (const rect of rects) {
        for (const other of placed.values()) {
          if (overlaps(rect, other, gap / 2))
            required = Math.max(required, other.y + other.height + gap - rect.y);
        }
      }
      if (!required) break;
      for (const rect of rects) rect.y += required;
      shift += required;
    }
    for (const { id, ...rect } of rects) placed.set(id, rect);
    nextY = top + shift + height + gap;
  }
  // Center alignments resolve after automatic placement: each aligned box moves on
  // one axis to match its target's final center. Chains settle in reference order;
  // validation guarantees targets join the same call and never form cycles.
  const alignments = new Map(
    boxes.flatMap((box) => (box.align ? [[box.id, box.align] as const] : [])),
  );
  const settled = new Set<string>();
  const settling = new Set<string>();
  const settle = (id: string) => {
    if (settled.has(id) || settling.has(id)) return;
    const align = alignments.get(id);
    if (!align) return;
    settling.add(id);
    settle(align.with);
    settling.delete(id);
    const rect = placed.get(id)!;
    const target = placed.get(align.with);
    if (target) {
      if (align.axis === "x") rect.x = target.x + target.width / 2 - rect.width / 2;
      else rect.y = target.y + target.height / 2 - rect.height / 2;
    }
    settled.add(id);
  };
  for (const id of alignments.keys()) settle(id);
  return placed;
}
