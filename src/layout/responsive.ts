import type {
  ArchitectureChart,
  ArchitectureScene,
  ArchitecturePartitionLayout,
  LayoutContext,
  NodeLayout,
  Participant,
  Position,
  Rect,
  SwimlaneChart,
  SwimlaneScene,
} from "../model.ts";
import { wrap } from "../design.ts";
import { borderObstacles, routeRelations } from "./routing.ts";

const margin = 16;
const padding = 16;
const gap = 72;

interface Block extends Rect {
  nodes: NodeLayout[];
  partition?: ArchitecturePartitionLayout;
}

function readingOrder(a: { position: Position }, b: { position: Position }) {
  return a.position.y - b.position.y || a.position.x - b.position.x;
}

function fitNode(node: Participant, ctx: LayoutContext, available: number): NodeLayout {
  const width = Math.min(
    node.size.width,
    Math.max(Math.min(48, available), available - padding * 2),
  );
  const entity = ctx.entities.get(node.entity)!;
  const title = wrap(entity.label, width - 32, `entity.${entity.id}.label`, 12);
  const detail = entity.description
    ? wrap(entity.description, width - 32, `entity.${entity.id}.description`, 20, 12)
    : null;
  const contentHeight = 28 + title.height + (detail ? detail.height + 6 : 0);
  return {
    id: entity.id,
    role: node.role,
    x: 0,
    y: 0,
    width,
    height: Math.max(node.size.height, contentHeight),
    contentHeight,
    title,
    detail,
  };
}

// Pack complete blocks in reading order. Only gaps and line breaks change;
// text is rewrapped at its original font size before any edges are routed.
function pack<T extends Rect>(blocks: T[], width: number): number {
  let y = 0;
  let row: T[] = [];
  let used = 0;
  const flush = () => {
    let x = (width - used) / 2;
    for (const block of row) {
      block.x = x;
      block.y = y;
      x += block.width + gap;
    }
    y += Math.max(0, ...row.map((block) => block.height)) + gap;
    row = [];
    used = 0;
  };
  for (const block of blocks) {
    if (row.length && used + gap + block.width > width) flush();
    if (row.length) used += gap;
    row.push(block);
    used += block.width;
  }
  if (row.length) flush();
  return Math.max(0, y - gap);
}

export function responsiveArchitecture(
  chart: ArchitectureChart,
  ctx: LayoutContext,
  width: number,
): ArchitectureScene {
  const available = width - margin * 2;
  const blocks: { position: Position; block: Block }[] = [];
  for (const node of chart.nodes.filter((node) => !node.partition)) {
    const box = fitNode(node, ctx, available);
    blocks.push({ position: node.position, block: { ...box, nodes: [box] } });
  }
  for (const partition of chart.partitions) {
    const regionWidth = Math.min(partition.size.width, available);
    const innerWidth = regionWidth - padding * 2;
    const title = wrap(partition.label, innerWidth, `partition.${partition.id}.label`, 12);
    const headerHeight = title.height + 24;
    const nodes = chart.nodes
      .filter((node) => node.partition === partition.id)
      .sort(readingOrder)
      .map((node) => fitNode(node, ctx, innerWidth));
    const contentHeight = pack(nodes, innerWidth);
    for (const node of nodes) {
      node.x += padding;
      node.y += headerHeight + padding;
    }
    const region: ArchitecturePartitionLayout = {
      id: partition.id,
      x: 0,
      y: 0,
      width: regionWidth,
      height: headerHeight + padding * 2 + contentHeight,
      title,
      headerHeight,
    };
    blocks.push({ position: partition.position, block: { ...region, nodes, partition: region } });
  }
  const ordered = blocks.sort(readingOrder).map(({ block }) => block);
  const height = pack(ordered, available) + margin * 2;
  const nodes: NodeLayout[] = [];
  const partitions: ArchitecturePartitionLayout[] = [];
  for (const block of ordered) {
    const x = block.x + margin;
    const y = block.y + margin;
    for (const node of block.nodes) nodes.push({ ...node, x: node.x + x, y: node.y + y });
    if (block.partition) partitions.push({ ...block.partition, x, y });
  }
  // Preserve semantic order in the scene while using declared coordinates only
  // to establish the reading order of the compact layout.
  nodes.sort(
    (a, b) =>
      chart.nodes.findIndex((n) => n.entity === a.id) -
      chart.nodes.findIndex((n) => n.entity === b.id),
  );
  const edges = routeRelations(chart, nodes, {
    labelsOnPath: true,
    obstacles: partitions.map((p) => ({
      x: p.x + 24,
      y: p.y + 12,
      width: p.title.width,
      height: p.title.height,
    })),
    labelObstacles: partitions.flatMap(borderObstacles),
    bounds: { x: 0, y: 0, width, height },
  });
  return { kind: "architecture", id: chart.id, width, height, nodes, partitions, edges };
}

export function responsiveSwimlane(
  chart: SwimlaneChart,
  ctx: LayoutContext,
  width: number,
): SwimlaneScene {
  const laneWidth = width - margin * 2;
  const headerWidth = Math.min(chart.headerWidth, 80);
  const innerWidth = laneWidth - headerWidth - padding * 2;
  let y = margin;
  const nodes: NodeLayout[] = [];
  const lanes = chart.lanes.map((lane) => {
    const title = wrap(lane.label, headerWidth - 32, `lane.${lane.id}.label`, 20);
    const children = chart.nodes
      .filter((node) => node.lane === lane.id)
      .sort(readingOrder)
      .map((node) => fitNode(node, ctx, innerWidth));
    const contentHeight = pack(children, innerWidth);
    const height = Math.max(lane.height, contentHeight + padding * 2, title.height + 32);
    for (const node of children)
      nodes.push({ ...node, x: margin + headerWidth + padding + node.x, y: y + padding + node.y });
    const region = { id: lane.id, x: margin, y, width: laneWidth, height, title, headerWidth };
    y += height;
    return region;
  });
  nodes.sort(
    (a, b) =>
      chart.nodes.findIndex((n) => n.entity === a.id) -
      chart.nodes.findIndex((n) => n.entity === b.id),
  );
  const edges = routeRelations(chart, nodes, {
    labelsOnPath: true,
    obstacles: lanes.map((lane) => ({ ...lane, width: headerWidth })),
    labelObstacles: lanes.flatMap(borderObstacles),
    bounds: {
      x: margin + headerWidth,
      y: margin,
      width: laneWidth - headerWidth,
      height: y - margin,
    },
  });
  return { kind: "swimlane", id: chart.id, width, height: y + margin, nodes, lanes, edges };
}
