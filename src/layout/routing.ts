import type { ArchitectureChart, EdgeLayout, NodeLayout, PartitionLayout, Point, Position, Rect, TextLayout } from '../model.ts';
import { fail } from '../diagnostics.ts';
import { wrap } from '../design.ts';
import { path } from './common.ts';

export function overlaps(a: Rect, b: Rect, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

function crosses(a: Point, b: Point, box: Rect, gap = 0) {
  if (a[0] === b[0]) {
    return a[0] > box.x - gap && a[0] < box.x + box.width + gap
      && Math.max(a[1], b[1]) > box.y - gap && Math.min(a[1], b[1]) < box.y + box.height + gap;
  }
  return a[1] > box.y - gap && a[1] < box.y + box.height + gap
    && Math.max(a[0], b[0]) > box.x - gap && Math.min(a[0], b[0]) < box.x + box.width + gap;
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
      if ((sameX && (b[1] - a[1]) * (point[1] - b[1]) >= 0)
        || (sameY && (b[0] - a[0]) * (point[0] - b[0]) >= 0)) result.pop();
      else break;
    }
    result.push(point);
  }
  return result;
}

function ports(box: Rect, fraction: number): { side: string; point: Point; lead: Point }[] {
  const x = box.x + box.width * fraction;
  const y = box.y + box.height * fraction;
  return [
    { side: 'right', point: [box.x + box.width, y], lead: [box.x + box.width + 18, y] },
    { side: 'bottom', point: [x, box.y + box.height], lead: [x, box.y + box.height + 18] },
    { side: 'left', point: [box.x, y], lead: [box.x - 18, y] },
    { side: 'top', point: [x, box.y], lead: [x, box.y - 18] }
  ];
}

function candidates(a: Point, b: Point, columns: number[], rows: number[]): Point[][] {
  const result: Point[][] = [];
  if (a[0] === b[0] || a[1] === b[1]) result.push([a, b]);
  result.push([a, [a[0], b[1]], b], [a, [b[0], a[1]], b]);
  for (const x of new Set([(a[0] + b[0]) / 2, ...columns])) result.push([a, [x, a[1]], [x, b[1]], b]);
  for (const y of new Set([(a[1] + b[1]) / 2, ...rows])) result.push([a, [a[0], y], [b[0], y], b]);
  return result;
}

function labelPosition(points: Point[], label: TextLayout, obstacles: Rect[], labels: Rect[], usedEdges: Point[][]): Position | undefined {
  const candidates = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    if (a[1] === b[1] && Math.abs(a[0] - b[0]) >= label.width + 16) {
      const x = (a[0] + b[0] - label.width) / 2;
      candidates.push({ x, y: a[1] - label.height - 8 }, { x, y: a[1] + 8 });
    } else if (a[0] === b[0] && Math.abs(a[1] - b[1]) >= label.height + 16) {
      const y = (a[1] + b[1] - label.height) / 2;
      candidates.push({ x: a[0] + 10, y }, { x: a[0] - label.width - 10, y });
    }
  }
  return candidates.find(position => {
    const box = { ...position, width: label.width, height: label.height };
    return box.x >= 8 && box.y >= 8
      && ![...obstacles, ...labels].some(obstacle => overlaps(box, obstacle, 6))
      && ![points, ...usedEdges].some(route => route.slice(1).some((point, i) => crosses(route[i], point, box, 2)));
  });
}

export function routeRelations(chart: ArchitectureChart, nodes: NodeLayout[], partitions: PartitionLayout[]): EdgeLayout[] {
  const boxes = new Map(nodes.map(node => [node.id, node]));
  const obstacles: Rect[] = [...nodes, ...partitions.map(partition => ({ x: partition.x + 16, y: partition.y + 8, width: partition.title.width + 16, height: partition.title.height + 8 }))];
  const columns = [12, ...obstacles.flatMap(box => [box.x - 24, box.x + box.width + 24])].filter(x => x >= 12);
  const rows = [12, ...obstacles.flatMap(box => [box.y - 32, box.y + box.height + 32])].filter(y => y >= 12);
  const labels: Rect[] = [], usedEdges: Point[][] = [];

  return chart.relations.map(relation => {
    const from = boxes.get(relation.from)!, to = boxes.get(relation.to)!;
    const outgoing = chart.relations.filter(edge => edge.from === relation.from);
    const incoming = chart.relations.filter(edge => edge.to === relation.to);
    const fractionFrom = (outgoing.indexOf(relation) + 1) / (outgoing.length + 1);
    const fractionTo = (incoming.indexOf(relation) + 1) / (incoming.length + 1);
    const label = wrap(relation.label, 170, `diagram.${chart.id}.${relation.id}.label`, 3, 12);
    const choices: { points: Point[]; position: Position; cost: number }[] = [];

    for (const start of ports(from, fractionFrom)) {
      for (const end of ports(to, fractionTo)) {
        if (from.id === to.id && start.side === end.side) continue;
        for (const core of candidates(start.lead, end.lead, columns, rows)) {
          if (core.some(point => point[0] < 8 || point[1] < 8)) continue;
          if (core.slice(1).some((point, i) => obstacles.some(box => crosses(core[i], point, box, 8)))) continue;
          if (obstacles.some(box => box !== from && crosses(start.point, start.lead, box, 4))) continue;
          if (obstacles.some(box => box !== to && crosses(end.lead, end.point, box, 4))) continue;
          const points = compact([start.point, ...core, end.point]);
          if (usedEdges.some(previous => JSON.stringify(previous) === JSON.stringify(points) || JSON.stringify([...previous].reverse()) === JSON.stringify(points))) continue;
          if (points.slice(1).some((point, i) => labels.some(box => crosses(points[i], point, box, 4)))) continue;
          const position = labelPosition(points, label, obstacles, labels, usedEdges);
          if (!position) continue;
          const length = points.slice(1).reduce((sum, point, i) => sum + Math.abs(point[0] - points[i][0]) + Math.abs(point[1] - points[i][1]), 0);
          choices.push({ points, position, cost: length + (points.length - 2) * 24 });
        }
      }
    }

    choices.sort((a, b) => a.cost - b.cost);
    const selected = choices[0];
    if (!selected) {
      fail('RELATION_LAYOUT', `diagram.${chart.id}.relations.${relation.id}`, `无法在 ${relation.from} 与 ${relation.to} 之间放置清晰的连线和标签。`, '调整节点 position，增加关系沿线的留白，或缩短关系标签。');
    }
    labels.push({ ...selected.position, width: label.width, height: label.height });
    usedEdges.push(selected.points);
    return { ...relation, points: selected.points, path: path(selected.points), label, labelX: selected.position.x, labelY: selected.position.y };
  });
}
