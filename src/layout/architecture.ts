import type {
  ArchitectureChart,
  ArchitectureScene,
  LayoutContext,
  ArchitecturePartitionLayout,
} from "../model.ts";
import { fail } from "../diagnostics.ts";
import { wrap } from "../design.ts";
import { nodeBox, finish } from "./common.ts";
import { routeRelations, overlaps, borderObstacles } from "./routing.ts";

const margin = 32;
const padding = 24;

export function layoutArchitecture(
  chart: ArchitectureChart,
  ctx: LayoutContext,
): ArchitectureScene {
  const partitions: ArchitecturePartitionLayout[] = chart.partitions.map((partition) => {
    const { width, height } = partition.size;
    if (width <= padding * 2)
      fail(
        "PARTITION_CONTENT_FIT",
        `diagram.${chart.id}.partitions.${partition.id}.size`,
        "分区没有足够的内容宽度。",
        "增加分区声明的宽度。",
      );
    const title = wrap(
      partition.label,
      width - padding * 2,
      `diagram.${chart.id}.partitions.${partition.id}.label`,
      2,
    );
    const headerHeight = title.height + 24;
    if (headerHeight + padding * 2 > height)
      fail(
        "PARTITION_CONTENT_FIT",
        `diagram.${chart.id}.partitions.${partition.id}.size`,
        "分区没有足够的内容高度。",
        "增加分区声明的高度。",
      );
    return {
      id: partition.id,
      x: margin + partition.position.x,
      y: margin + partition.position.y,
      width,
      height,
      title,
      headerHeight,
    };
  });
  const partitionById = new Map(partitions.map((partition) => [partition.id, partition]));
  const nodes = chart.nodes.map((node) => {
    const partition = node.partition ? partitionById.get(node.partition)! : undefined;
    const originX = partition ? partition.x + padding : margin;
    const originY = partition ? partition.y + partition.headerHeight + padding : margin;
    const box = nodeBox(node, ctx, originX + node.position.x, originY + node.position.y);
    if (
      partition &&
      (box.x + box.width + padding > partition.x + partition.width ||
        box.y + box.height + padding > partition.y + partition.height)
    ) {
      fail(
        "PARTITION_CONTENT_FIT",
        `diagram.${chart.id}.partitions.${partition.id}.size`,
        `节点 ${node.entity} 超出了分区 ${partition.id} 的内容区域。`,
        "调整分区 size，或节点的 position、size；系统保持声明的尺寸。",
      );
    }
    return box;
  });

  const ungrouped = nodes.filter((_, index) => !chart.nodes[index].partition);
  for (const [index, partition] of partitions.entries()) {
    for (const other of [...partitions.slice(index + 1), ...ungrouped]) {
      if (overlaps(partition, other, 12))
        fail(
          "REGION_OVERLAP",
          `diagram.${chart.id}.partitions.${partition.id}.position`,
          `${partition.id} 与 ${other.id} 重叠或间距不足。`,
          "调整根节点或分区的 position、size，保留至少 12 像素间距。",
        );
    }
  }
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (
        chart.nodes[i].partition === chart.nodes[j].partition &&
        overlaps(nodes[i], nodes[j], 12)
      ) {
        fail(
          "NODE_OVERLAP",
          `diagram.${chart.id}.nodes.${nodes[j].id}.position`,
          `节点 ${nodes[i].id} 与 ${nodes[j].id} 重叠或间距不足。`,
          "调整 position 或 size，给节点及其连线留出至少 12 像素的间距。",
        );
      }
    }
  }
  const edges = routeRelations(chart, nodes, {
    obstacles: partitions.map((partition) => ({
      // Match the painted text block; the router adds its own clearance.
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
