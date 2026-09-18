import type { Diagnostic } from "./diagnostics.ts";
import type { Scene } from "./model.ts";
import type { RelationSide } from "./types.ts";
import type { NodeLayout, Point, Rect } from "./shared/model.ts";
import { crosses } from "./shared/routing.ts";

/** Center offsets within this distance read as misaligned to the eye; exact zero is alignment. */
const NEAR_MISS_LIMIT = 16;
/** Minimum clearance between a label background and any bend before the pairing reads as cramped. */
const LABEL_BEND_CLEARANCE = 6;

function centerX(box: Rect) {
  return box.x + box.width / 2;
}
function centerY(box: Rect) {
  return box.y + box.height / 2;
}

/** Label background extends 3 pixels around the text block, matching the routed placement. */
function labelBackground(edge: {
  labelX: number;
  labelY: number;
  label: { width: number; height: number };
}): Rect {
  return {
    x: edge.labelX - 3,
    y: edge.labelY - 2,
    width: edge.label.width + 6,
    height: edge.label.height + 4,
  };
}

function pointRectDistance(point: readonly [number, number], box: Rect) {
  const dx = Math.max(box.x - point[0], 0, point[0] - (box.x + box.width));
  const dy = Math.max(box.y - point[1], 0, point[1] - (box.y + box.height));
  return Math.hypot(dx, dy);
}

/**
 * Judge the computed layout the way the review checklist does, so agents correct geometry from
 * data instead of discovering defects in screenshots. Checks are conservative: aligned centers
 * with a clear corridor must connect straight, nearly aligned centers are reported, and labels
 * must keep distance from bends. Sequence grids are fixed by the layout and need no review here.
 */
export function computeWarnings(scene: Scene): Diagnostic[] {
  if (scene.kind === "sequence") return [];
  const warnings: Diagnostic[] = [];
  const nodes = new Map<string, NodeLayout>(scene.nodes.map((node) => [node.id, node]));
  const chartPath = `diagram.${scene.id}`;
  // The router treats partition titles as obstacles; corridors must account for them too.
  const titleObstacles: Rect[] =
    scene.kind === "architecture"
      ? scene.partitions.map((partition) => ({
          x: partition.x + 24,
          y: partition.y + 12,
          width: partition.title.width,
          height: partition.title.height,
        }))
      : [];

  for (const edge of scene.edges) {
    if (edge.from === edge.to) continue;
    const a = nodes.get(edge.from)!;
    const b = nodes.get(edge.to)!;
    const dcx = Math.abs(centerX(a) - centerX(b));
    const dcy = Math.abs(centerY(a) - centerY(b));
    const horizontal = dcx > dcy;
    // Sides declared away from the facing pair make bends intentional, not defects.
    const facing: [RelationSide, RelationSide] = horizontal
      ? centerX(a) <= centerX(b)
        ? ["right", "left"]
        : ["left", "right"]
      : centerY(a) <= centerY(b)
        ? ["bottom", "top"]
        : ["top", "bottom"];
    const detoursByChoice =
      (edge.fromSide !== undefined && edge.fromSide !== facing[0]) ||
      (edge.toSide !== undefined && edge.toSide !== facing[1]);
    if (detoursByChoice) continue;
    if (horizontal && dcy > 0 && dcy <= NEAR_MISS_LIMIT) {
      warnings.push({
        code: "NEAR_MISS_ALIGNMENT",
        path: `${chartPath}.relations.${edge.id}`,
        message: `节点 ${edge.from} 与 ${edge.to} 的水平中心相差 ${dcy} 像素，连线被迫折弯。`,
        hint: `若两者应水平直连，调整 position 使 cy 相等（${centerY(a)} 与 ${centerY(b)}）；局部修正量 = 期望绝对坐标 - origin。`,
      });
    }
    if (!horizontal && dcx > 0 && dcx <= NEAR_MISS_LIMIT) {
      warnings.push({
        code: "NEAR_MISS_ALIGNMENT",
        path: `${chartPath}.relations.${edge.id}`,
        message: `节点 ${edge.from} 与 ${edge.to} 的垂直中心相差 ${dcx} 像素，连线被迫折弯。`,
        hint: `若两者应垂直直连，调整 position 使 cx 相等（${centerX(a)} 与 ${centerX(b)}）；局部修正量 = 期望绝对坐标 - origin。`,
      });
    }
    const aligned = dcx === 0 || dcy === 0;
    if (aligned && edge.points.length > 2) {
      const left = centerX(a) <= centerX(b) ? a : b;
      const right = left === a ? b : a;
      const top = centerY(a) <= centerY(b) ? a : b;
      const bottom = top === a ? b : a;
      const corridor: [Point, Point] =
        dcy === 0
          ? [
              [left.x + left.width, centerY(left)],
              [right.x, centerY(right)],
            ]
          : [
              [centerX(top), top.y + top.height],
              [centerX(bottom), bottom.y],
            ];
      const blocked = [
        ...scene.nodes.filter((node) => node.id !== a.id && node.id !== b.id),
        ...titleObstacles,
      ].some((obstacle) => crosses(corridor[0], corridor[1], obstacle, 8));
      if (!blocked) {
        warnings.push({
          code: "AVOIDABLE_BEND",
          path: `${chartPath}.relations.${edge.id}`,
          message: `${edge.from} 与 ${edge.to} 中心已对齐且中间无节点障碍，但连线有 ${edge.points.length - 2} 处折弯。`,
          hint: "检查沿线是否留有可避开的空白；调整相关节点的 position 或连接边，恢复直连。",
        });
      }
    }
  }

  const bends = scene.edges.flatMap((edge) =>
    edge.points.slice(1, -1).map((point) => ({ edge: edge.id, point })),
  );
  for (const edge of scene.edges) {
    const background = labelBackground(edge);
    const nearest = bends.reduce(
      (min, bend) => Math.min(min, pointRectDistance(bend.point, background)),
      Infinity,
    );
    if (nearest < LABEL_BEND_CLEARANCE) {
      warnings.push({
        code: "LABEL_CONGESTION",
        path: `${chartPath}.relations.${edge.id}.label`,
        message: `关系 ${edge.id} 的标签距最近的拐点只有 ${nearest.toFixed(1)} 像素，归属难以辨认。`,
        hint: "调整节点或分区的 position、关系连接边，或缩短标签措辞，为标签留出空白。",
      });
    }
  }
  return warnings;
}
