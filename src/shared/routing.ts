import type { Position, RelationSide } from "../types.ts";
import type { EdgeLayout, NodeLayout, Point, Rect, Relation, TextLayout } from "./model.ts";
import { fail } from "../diagnostics.ts";
import { measure, wrap } from "../design.ts";
import { path } from "./layout.ts";

export function overlaps(a: Rect, b: Rect, gap = 0) {
  return (
    a.x < b.x + b.width + gap &&
    a.x + a.width + gap > b.x &&
    a.y < b.y + b.height + gap &&
    a.y + a.height + gap > b.y
  );
}

// Borders obstruct labels, but remain traversable by relations between regions.
export function borderObstacles(box: Rect): Rect[] {
  return [
    { x: box.x, y: box.y - 0.5, width: box.width, height: 1 },
    { x: box.x, y: box.y + box.height - 0.5, width: box.width, height: 1 },
    { x: box.x - 0.5, y: box.y, width: 1, height: box.height },
    { x: box.x + box.width - 0.5, y: box.y, width: 1, height: box.height },
  ];
}

function crosses(a: Point, b: Point, box: Rect, gap = 0) {
  if (a[0] === b[0]) {
    return (
      a[0] > box.x - gap &&
      a[0] < box.x + box.width + gap &&
      Math.max(a[1], b[1]) > box.y - gap &&
      Math.min(a[1], b[1]) < box.y + box.height + gap
    );
  }
  return (
    a[1] > box.y - gap &&
    a[1] < box.y + box.height + gap &&
    Math.max(a[0], b[0]) > box.x - gap &&
    Math.min(a[0], b[0]) < box.x + box.width + gap
  );
}

function compact(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  for (const point of points) {
    if (result.length && result.at(-1)![0] === point[0] && result.at(-1)![1] === point[1]) continue;
    while (result.length > 1) {
      const [a, b] = result.slice(-2);
      const sameX = a[0] === b[0] && b[0] === point[0];
      const sameY = a[1] === b[1] && b[1] === point[1];
      // Collapse forward collinear segments without removing a reversal.
      if (
        (sameX && (b[1] - a[1]) * (point[1] - b[1]) >= 0) ||
        (sameY && (b[0] - a[0]) * (point[0] - b[0]) >= 0)
      )
        result.pop();
      else break;
    }
    result.push(point);
  }
  return result;
}

function ports(box: Rect, obstacles: Rect[]): { side: RelationSide; point: Point; lead: Point }[] {
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const sides: { side: RelationSide; point: Point; direction: Point }[] = [
    { side: "right", point: [box.x + box.width, y], direction: [1, 0] },
    { side: "bottom", point: [x, box.y + box.height], direction: [0, 1] },
    { side: "left", point: [box.x, y], direction: [-1, 0] },
    { side: "top", point: [x, box.y], direction: [0, -1] },
  ];
  return sides.map(({ side, point, direction }) => {
    let distance = 18;
    // Split a narrow corridor between its facing ports. Route validation still
    // enforces node clearance, including when the corridor is too narrow.
    for (const obstacle of obstacles) {
      if (obstacle === box) continue;
      const horizontal = direction[0] !== 0;
      const axis = horizontal ? 0 : 1;
      const cross = horizontal ? 1 : 0;
      const start: Point = [obstacle.x, obstacle.y];
      const end: Point = [obstacle.x + obstacle.width, obstacle.y + obstacle.height];
      if (point[cross] < start[cross] - 8 || point[cross] > end[cross] + 8) continue;
      const gap = direction[axis] > 0 ? start[axis] - point[axis] : point[axis] - end[axis];
      if (gap >= 0) distance = Math.min(distance, gap / 2);
    }
    return {
      side,
      point,
      lead: [point[0] + direction[0] * distance, point[1] + direction[1] * distance] as Point,
    };
  });
}

function candidates(a: Point, b: Point, columns: number[], rows: number[]): Point[][] {
  const result: Point[][] = [];
  if (a[0] === b[0] || a[1] === b[1]) result.push([a, b]);
  result.push([a, [a[0], b[1]], b], [a, [b[0], a[1]], b]);
  for (const x of new Set([(a[0] + b[0]) / 2, ...columns]))
    result.push([a, [x, a[1]], [x, b[1]], b]);
  for (const y of new Set([(a[1] + b[1]) / 2, ...rows])) result.push([a, [a[0], y], [b[0], y], b]);
  return result;
}

function contains(bounds: Rect, box: Rect) {
  return (
    box.x >= bounds.x &&
    box.y >= bounds.y &&
    box.x + box.width <= bounds.x + bounds.width &&
    box.y + box.height <= bounds.y + bounds.height
  );
}

function labelPositions(
  points: Point[],
  label: TextLayout,
  obstacles: Rect[],
  labelObstacles: Rect[],
  bounds?: Rect,
): Position[] {
  const candidates: Position[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    if (a[1] === b[1] && Math.abs(a[0] - b[0]) >= label.width + 12) {
      for (const x of new Set([
        (a[0] + b[0] - label.width) / 2,
        Math.min(a[0], b[0]) + 6,
        Math.max(a[0], b[0]) - label.width - 6,
      ])) {
        candidates.push({ x, y: a[1] - label.height - 8 }, { x, y: a[1] + 8 });
      }
    } else if (a[0] === b[0] && Math.abs(a[1] - b[1]) >= label.height + 16) {
      for (const y of new Set([
        (a[1] + b[1] - label.height) / 2,
        Math.min(a[1], b[1]) + 8,
        Math.max(a[1], b[1]) - label.height - 8,
      ])) {
        candidates.push({ x: a[0] + 10, y }, { x: a[0] - label.width - 10, y });
      }
    }
  }
  return candidates.filter((position) => {
    const box = { ...position, width: label.width, height: label.height };
    const background = {
      x: box.x - 3,
      y: box.y - 2,
      width: box.width + 6,
      height: box.height + 4,
    };
    return (
      box.x >= 8 &&
      box.y >= 8 &&
      (!bounds || contains(bounds, background)) &&
      !obstacles.some((obstacle) => overlaps(box, obstacle, 6)) &&
      !labelObstacles.some((obstacle) => overlaps(background, obstacle, 2)) &&
      !points.slice(1).some((point, i) => crosses(points[i], point, box, 4))
    );
  });
}

interface LabelChoice {
  label: TextLayout;
  position: Position;
}
interface RouteChoice {
  points: Point[];
  labels: LabelChoice[];
  cost: number;
}
type Score = [overlap: number, crossings: number, lengthAndBends: number, labelHeight: number];

function compare(a: Score, b: Score) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function routeCost(points: Point[]) {
  return (
    points
      .slice(1)
      .reduce(
        (sum, point, i) =>
          sum + Math.abs(point[0] - points[i][0]) + Math.abs(point[1] - points[i][1]),
        0,
      ) +
    (points.length - 2) * 24
  );
}

function samePoint(a: Point, b: Point) {
  return a[0] === b[0] && a[1] === b[1];
}

// Even a shared port lead can hide an arrow or merge independent relations.
// Count its full overlap so another side is preferred when space permits.
function conflicts(points: Point[], previous: Point[]): [number, number] {
  let overlap = 0;
  const intersections = new Set<string>();
  const sharedEnds = [points[0], points.at(-1)!].filter(
    (point) => samePoint(point, previous[0]) || samePoint(point, previous.at(-1)!),
  );
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    for (let j = 1; j < previous.length; j++) {
      const c = previous[j - 1],
        d = previous[j];
      const vertical = a[0] === b[0],
        otherVertical = c[0] === d[0];
      if (vertical === otherVertical) {
        const fixed = vertical ? 0 : 1,
          axis = vertical ? 1 : 0;
        if (a[fixed] !== c[fixed]) continue;
        const lo = Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
        const hi = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis]));
        if (hi <= lo) continue;
        overlap += hi - lo;
      } else {
        const [v1, v2, h1, h2] = vertical ? [a, b, c, d] : [c, d, a, b];
        const point: Point = [v1[0], h1[1]];
        if (
          point[0] >= Math.min(h1[0], h2[0]) &&
          point[0] <= Math.max(h1[0], h2[0]) &&
          point[1] >= Math.min(v1[1], v2[1]) &&
          point[1] <= Math.max(v1[1], v2[1]) &&
          !sharedEnds.some((end) => Math.abs(end[0] - point[0]) + Math.abs(end[1] - point[1]) <= 18)
        ) {
          intersections.add(`${point[0]},${point[1]}`);
        }
      }
    }
  }
  return [overlap, intersections.size];
}

function labelBox(edge: EdgeLayout): Rect {
  return { x: edge.labelX, y: edge.labelY, width: edge.label.width, height: edge.label.height };
}

function score(points: Point[], label: TextLayout, others: EdgeLayout[]): Score {
  const costs = others.map((edge) => conflicts(points, edge.points));
  return [
    costs.reduce((sum, cost) => sum + cost[0], 0),
    costs.reduce((sum, cost) => sum + cost[1], 0),
    routeCost(points),
    label.height,
  ];
}

function select(
  relation: Relation,
  choices: RouteChoice[],
  others: EdgeLayout[],
): EdgeLayout | undefined {
  let best: EdgeLayout | undefined, bestScore: Score | undefined;
  const labels = others.map(labelBox);
  for (const choice of choices) {
    if (
      choice.points
        .slice(1)
        .some((point, i) => labels.some((box) => crosses(choice.points[i], point, box, 4)))
    )
      continue;
    if (
      others.some(
        (edge) =>
          edge.points.length === choice.points.length &&
          (edge.points.every((point, i) => samePoint(point, choice.points[i])) ||
            edge.points.every((point, i) =>
              samePoint(point, choice.points[choice.points.length - 1 - i]),
            )),
      )
    )
      continue;
    const cost = score(choice.points, choice.labels[0].label, others);
    for (const { label, position } of choice.labels) {
      cost[3] = label.height;
      if (bestScore && compare(cost, bestScore) >= 0) continue;
      const box = { ...position, width: label.width, height: label.height };
      if (labels.some((other) => overlaps(box, other, 6))) continue;
      if (
        others.some((edge) =>
          edge.points.slice(1).some((point, i) => crosses(edge.points[i], point, box, 4)),
        )
      )
        continue;
      bestScore = [...cost];
      best = {
        ...relation,
        points: choice.points,
        path: path(choice.points),
        label,
        labelX: position.x,
        labelY: position.y,
      };
    }
  }
  return best;
}

export function routeRelations(
  chart: { id: string; relations: readonly Relation[] },
  nodes: NodeLayout[],
  space: {
    obstacles: Rect[];
    labelObstacles: Rect[];
    bounds?: Rect;
  },
): EdgeLayout[] {
  const { bounds } = space;
  const boxes = new Map(nodes.map((node) => [node.id, node]));
  const obstacles: Rect[] = [...nodes, ...space.obstacles];
  const columns = [
    12,
    ...obstacles.flatMap((box) =>
      [18, 30, 42].flatMap((gap) => [box.x - gap, box.x + box.width + gap]),
    ),
  ].filter((x) => x >= 12);
  const rows = [
    12,
    ...obstacles.flatMap((box) =>
      [18, 32, 44].flatMap((gap) => [box.y - gap, box.y + box.height + gap]),
    ),
  ].filter((y) => y >= 12);
  if (bounds) {
    columns.push(bounds.x + 12, bounds.x + bounds.width - 12);
    rows.push(bounds.y + 12, bounds.y + bounds.height - 12);
  }
  const pools = new Map<string, RouteChoice[]>();
  for (const relation of chart.relations) {
    const from = boxes.get(relation.from)!,
      to = boxes.get(relation.to)!;
    const labelPath = `diagram.${chart.id}.${relation.id}.label`;
    const label = wrap(relation.label, 170, labelPath, 3, 12);
    const variants = [label];
    const gapX = Math.max(to.x - from.x - from.width, from.x - to.x - to.width);
    const widths = [120, 80, gapX - 12];
    const centerY = from.y + from.height / 2;
    if (gapX > 0 && centerY === to.y + to.height / 2) {
      const left = Math.min(from.x + from.width, to.x + to.width);
      const right = Math.max(from.x, to.x);
      let spans = [[left + 6, right - 6]];
      for (const obstacle of space.labelObstacles) {
        if (!crosses([left, centerY], [right, centerY], obstacle)) continue;
        // The background extends 3px horizontally, with 2px border clearance.
        const start = obstacle.x - 5;
        const end = obstacle.x + obstacle.width + 5;
        spans = spans.flatMap(([a, b]) =>
          end <= a || start >= b
            ? [[a, b]]
            : [
                [a, Math.min(b, start)],
                [Math.max(a, end), b],
              ].filter(([x, y]) => y > x),
        );
      }
      widths.push(...spans.map(([a, b]) => b - a));
    }
    const minWordWidth = Math.min(
      170,
      Math.max(24, ...(relation.label.match(/[!-~]+/g) ?? []).map((word) => measure(word, 12))),
    );
    for (const width of new Set(widths)) {
      if (width < minWordWidth || width >= label.width) continue;
      const variant = wrap(relation.label, width, labelPath, Infinity, 12);
      if (
        variant.lines.length <= 3 &&
        !variants.some((other) => other.lines.join("\n") === variant.lines.join("\n"))
      )
        variants.push(variant);
    }
    const choices: RouteChoice[] = [];
    const seen = new Set<string>();

    const starts = ports(from, obstacles).filter(
      (port) => relation.fromSide === undefined || port.side === relation.fromSide,
    );
    const ends = ports(to, obstacles).filter(
      (port) => relation.toSide === undefined || port.side === relation.toSide,
    );
    for (const start of starts) {
      for (const end of ends) {
        if (from.id === to.id && start.side === end.side) continue;
        for (const core of candidates(start.lead, end.lead, columns, rows)) {
          if (core.some((point) => point[0] < 8 || point[1] < 8)) continue;
          if (bounds && core.some(([x, y]) => !contains(bounds, { x, y, width: 0, height: 0 })))
            continue;
          if (
            core
              .slice(1)
              .some((point, i) => obstacles.some((box) => crosses(core[i], point, box, 8)))
          )
            continue;
          if (obstacles.some((box) => box !== from && crosses(start.point, start.lead, box, 4)))
            continue;
          if (obstacles.some((box) => box !== to && crosses(end.lead, end.point, box, 4))) continue;
          const points = compact([start.point, ...core, end.point]);
          if (
            points.slice(2).some((c, i) => {
              const a = points[i],
                b = points[i + 1];
              return (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]) < 0;
            })
          )
            continue;
          const key = JSON.stringify(points);
          if (seen.has(key)) continue;
          seen.add(key);
          const labels = variants.flatMap((label) =>
            labelPositions(points, label, obstacles, space.labelObstacles, bounds).map(
              (position) => ({
                label,
                position,
              }),
            ),
          );
          if (labels.length) choices.push({ points, labels, cost: routeCost(points) });
        }
      }
    }

    choices.sort((a, b) => a.cost - b.cost);
    pools.set(relation.id, choices);
  }

  // Allocate constrained relations first so automatic routes do not consume
  // their limited choices, then prefer short connections and stable IDs.
  // Preserve declaration order in the returned scene, not in route allocation.
  const fixedSides = (relation: Relation) =>
    Number(!!relation.fromSide) + Number(!!relation.toSide);
  const ordered = [...chart.relations].sort(
    (a, b) =>
      fixedSides(b) - fixedSides(a) ||
      (pools.get(a.id)![0]?.cost ?? Infinity) - (pools.get(b.id)![0]?.cost ?? Infinity) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const result = new Map<string, EdgeLayout>();
  for (const relation of ordered) {
    const selected = select(relation, pools.get(relation.id)!, [...result.values()]);
    if (!selected) {
      const geometry = [relation.from, relation.to]
        .map((id) => {
          const { x, y, width, height } = boxes.get(id)!;
          return `${id}: x=${x}, y=${y}, width=${width}, height=${height}`;
        })
        .join("；");
      const constraints = [
        ...(relation.fromSide ? [`fromSide=${relation.fromSide}`] : []),
        ...(relation.toSide ? [`toSide=${relation.toSide}`] : []),
      ];
      fail(
        "RELATION_LAYOUT",
        `diagram.${chart.id}.relations.${relation.id}`,
        `无法在 ${relation.from} 与 ${relation.to} 之间放置清晰的连线和标签${constraints.length ? `（${constraints.join(", ")}）` : ""}。`,
        `当前画布矩形为 ${geometry}。根据节点所属分区或泳道换算局部 position，增加关系沿线的留白；也可调整 fromSide、toSide，或缩短关系标签。尺寸由系统计算。`,
      );
    }
    result.set(relation.id, selected);
  }

  // Every accepted replacement improves the same whole-diagram objective.
  // Three sweeps bound the work while letting earlier routes yield a corridor.
  for (let pass = 0; pass < 3; pass++) {
    let improved = false;
    for (const relation of ordered) {
      const current = result.get(relation.id)!;
      const others = [...result.values()].filter((edge) => edge.id !== relation.id);
      const selected = select(relation, pools.get(relation.id)!, others);
      if (
        selected &&
        compare(
          score(selected.points, selected.label, others),
          score(current.points, current.label, others),
        ) < 0
      ) {
        result.set(relation.id, selected);
        improved = true;
      }
    }
    if (!improved) break;
  }
  return chart.relations.map((relation) => result.get(relation.id)!);
}
