import type { ArchitectureChart, ArchitectureScene, ArchitecturePartitionLayout } from "./model.ts";
import type { LayoutContext, NodeLayout, Rect } from "../shared/model.ts";
import { fail } from "../diagnostics.ts";
import { wrap, measure } from "../design.ts";
import { nodeBox, finish } from "../shared/layout.ts";
import { dependencyLevels, placeBoxes } from "../shared/placement.ts";
import { routeRelations, overlaps, borderObstacles } from "../shared/routing.ts";

const margin = 32;
const padding = 24;

export function layoutArchitecture(
  chart: ArchitectureChart,
  ctx: LayoutContext,
): ArchitectureScene {
  const measured = new Map(chart.nodes.map((node) => [node.entity, nodeBox(node, ctx, 0, 0)]));
  const membership = new Map(
    chart.partitions.flatMap((partition) =>
      partition.nodes.map((id) => [id, partition.id] as const),
    ),
  );
  const local = new Map<string, Rect>();
  const partitions: ArchitecturePartitionLayout[] = chart.partitions.map((partition) => {
    const members = chart.nodes.filter((node) => membership.get(node.entity) === partition.id);
    const boxes = placeBoxes(
      members.map((node) => ({ ...measured.get(node.entity)!, position: node.position })),
      dependencyLevels(
        members.map((node) => node.entity),
        chart.relations,
      ),
      { maxWidth: 1000 },
    );
    for (const [id, box] of boxes) local.set(id, box);
    const width =
      Math.max(
        160,
        Math.min(384, measure(partition.label)),
        ...[...boxes.values()].map((box) => box.x + box.width),
      ) +
      padding * 2;
    const title = wrap(
      partition.label,
      width - padding * 2,
      `diagram.${chart.id}.partitions.${partition.id}.label`,
      2,
    );
    const headerHeight = title.height + 24;
    const height =
      headerHeight +
      padding * 2 +
      Math.max(...[...boxes.values()].map((box) => box.y + box.height));
    return { id: partition.id, x: 0, y: 0, width, height, title, headerHeight };
  });
  // Prefix root keys because partition IDs and entity IDs occupy independent namespaces.
  const rootId = new Map(
    chart.nodes.map((node) => [
      node.entity,
      membership.has(node.entity)
        ? `partition:${membership.get(node.entity)}`
        : `node:${node.entity}`,
    ]),
  );
  const roots = [
    ...partitions.map((box, i) => ({
      ...box,
      id: `partition:${box.id}`,
      position: chart.partitions[i].position,
    })),
    ...chart.nodes
      .filter((node) => !membership.has(node.entity))
      .map((node) => ({
        ...measured.get(node.entity)!,
        id: `node:${node.entity}`,
        position: node.position,
      })),
  ];
  const rootLinks = chart.relations.map((edge) => ({
    from: rootId.get(edge.from)!,
    to: rootId.get(edge.to)!,
  }));
  const placement = placeBoxes(
    roots,
    dependencyLevels(
      roots.map((box) => box.id),
      rootLinks,
    ),
  );
  for (const partition of partitions) {
    const box = placement.get(`partition:${partition.id}`)!;
    partition.x = margin + box.x;
    partition.y = margin + box.y;
  }
  const partitionById = new Map(partitions.map((partition) => [partition.id, partition]));
  const nodes: NodeLayout[] = chart.nodes.map((node) => {
    const partitionId = membership.get(node.entity);
    const partition = partitionId === undefined ? undefined : partitionById.get(partitionId)!;
    const box = partition ? local.get(node.entity)! : placement.get(`node:${node.entity}`)!;
    return {
      ...measured.get(node.entity)!,
      x: (partition ? partition.x + padding : margin) + box.x,
      y: (partition ? partition.y + partition.headerHeight + padding : margin) + box.y,
    };
  });
  const regions = [...placement.entries()];
  for (let i = 0; i < regions.length; i++) {
    for (let j = i + 1; j < regions.length; j++) {
      if (overlaps(regions[i][1], regions[j][1], 12))
        fail(
          "REGION_OVERLAP",
          `diagram.${chart.id}`,
          `区域 ${regions[i][0]} 与 ${regions[j][0]} 重叠或间距不足。`,
          "调整对应节点或分区的 position；尺寸由内容自动计算，至少保留 12 像素间距。",
        );
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (
        membership.get(nodes[i].id) === membership.get(nodes[j].id) &&
        overlaps(nodes[i], nodes[j], 12)
      )
        fail(
          "NODE_OVERLAP",
          `diagram.${chart.id}.nodes.${nodes[j].id}.position`,
          `节点 ${nodes[i].id} 与 ${nodes[j].id} 重叠或间距不足。`,
          "调整 position，或省略该字段恢复自动布局；至少保留 12 像素间距。",
        );
    }
  }
  const edges = routeRelations(chart, nodes, {
    obstacles: partitions.map((partition) => ({
      x: partition.x + 24,
      y: partition.y + 12,
      width: partition.title.width,
      height: partition.title.height,
    })),
    labelObstacles: partitions.flatMap(borderObstacles),
  });
  const bounds = [...nodes, ...partitions];
  const width =
    Math.max(
      ...bounds.map((box) => box.x + box.width),
      ...edges.flatMap((edge) => [
        edge.labelX + edge.label.width,
        ...edge.points.map((point) => point[0]),
      ]),
    ) + margin;
  const height =
    Math.max(
      ...bounds.map((box) => box.y + box.height),
      ...edges.flatMap((edge) => [
        edge.labelY + edge.label.height,
        ...edge.points.map((point) => point[1]),
      ]),
    ) + margin;
  return finish({ kind: "architecture", id: chart.id, width, height, nodes, partitions, edges });
}
