import type { LaneLayout, SwimlaneChart, SwimlaneScene } from "./model.ts";
import type { LayoutContext } from "../shared/model.ts";
import { wrap, measure } from "../design.ts";
import { fail } from "../diagnostics.ts";
import { finish, nodeBox } from "../shared/layout.ts";
import { dependencyLevels, placeBoxes } from "../shared/placement.ts";
import { overlaps, routeRelations, borderObstacles } from "../shared/routing.ts";

const margin = 32;
const padding = 48;

export function layoutSwimlane(chart: SwimlaneChart, ctx: LayoutContext): SwimlaneScene {
  const p = `diagram.${chart.id}`;
  const headerWidth = Math.ceil(
    Math.max(96, Math.min(176, Math.max(...chart.lanes.map((lane) => measure(lane.label))) + 32)),
  );
  const measured = new Map(chart.nodes.map((node) => [node.entity, nodeBox(node, ctx, 0, 0)]));
  const levels = dependencyLevels(
    chart.nodes.map((node) => node.entity),
    chart.relations,
  );
  const laneBoxes = new Map(
    chart.lanes.map((lane) => [
      lane.id,
      placeBoxes(
        chart.nodes
          .filter((node) => node.lane === lane.id)
          .map((node) => ({
            ...measured.get(node.entity)!,
            position: node.position,
            align: node.align,
          })),
        levels,
        {
          horizontal: true,
          maxWidth: 1280 - margin * 2 - headerWidth - padding * 2,
          columnWidth: Math.max(...[...measured.values()].map((box) => box.width)) + 80,
          rowHeight: Math.max(...[...measured.values()].map((box) => box.height)) + 80,
        },
      ),
    ]),
  );
  const width =
    headerWidth +
    padding * 2 +
    Math.max(
      ...[...laneBoxes.values()].flatMap((boxes) =>
        [...boxes.values()].map((box) => box.x + box.width),
      ),
    );
  let y = margin;
  const lanes: LaneLayout[] = chart.lanes.map((lane) => {
    const title = wrap(lane.label, headerWidth - 32, `${p}.lanes.${lane.id}.label`, 6);
    const height = Math.max(
      title.height + 32,
      padding * 2 +
        Math.max(...[...laneBoxes.get(lane.id)!.values()].map((box) => box.y + box.height)),
    );
    const box = { id: lane.id, x: margin, y, width, height, title, headerWidth };
    y += height;
    return box;
  });
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  const nodes = chart.nodes.map((node) => {
    const lane = laneById.get(node.lane)!;
    const box = laneBoxes.get(node.lane)!.get(node.entity)!;
    if (box.x < 0 || box.y < 0)
      fail(
        "ALIGNMENT_RANGE",
        `${p}.nodes.${node.entity}.align`,
        `节点 ${node.entity} 对齐后越出泳道内容原点。`,
        "对齐目标的中心离泳道边缘太近，放不下此节点；改用 position 或调整对齐目标。",
      );
    const origin: [number, number] = [lane.x + headerWidth + padding, lane.y + padding];
    return {
      ...measured.get(node.entity)!,
      origin,
      x: origin[0] + box.x,
      y: origin[1] + box.y,
    };
  });
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (overlaps(nodes[i], nodes[j], 12))
        fail(
          "NODE_OVERLAP",
          `${p}.nodes.${nodes[j].id}.position`,
          `节点 ${nodes[i].id} 与 ${nodes[j].id} 重叠或间距不足。`,
          "调整 position，或省略该字段恢复自动布局；至少保留 12 像素间距。",
        );
    }
  }
  const edges = routeRelations(chart, nodes, {
    obstacles: lanes.map((lane) => ({ ...lane, width: headerWidth })),
    labelObstacles: lanes.flatMap(borderObstacles),
    bounds: { x: margin + headerWidth, y: margin, width: width - headerWidth, height: y - margin },
  });
  return finish({
    kind: "swimlane",
    id: chart.id,
    width: width + margin * 2,
    height: y + margin,
    nodes,
    lanes,
    edges,
  });
}
