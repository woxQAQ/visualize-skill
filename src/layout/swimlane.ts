import type { LaneLayout, LayoutContext, SwimlaneChart, SwimlaneScene } from "../model.ts";
import { wrap } from "../design.ts";
import { fail } from "../diagnostics.ts";
import { finish, nodeBox } from "./common.ts";
import { overlaps, routeRelations, borderObstacles } from "./routing.ts";

const margin = 32;
const padding = 24;

export function layoutSwimlane(chart: SwimlaneChart, ctx: LayoutContext): SwimlaneScene {
  const p = `diagram.${chart.id}`;
  const { headerWidth } = chart;
  if (headerWidth <= 32) {
    fail(
      "LANE_CONTENT_FIT",
      `${p}.headerWidth`,
      "泳道标题栏宽度不足以容纳文字和内边距。",
      "增加 headerWidth；标题左右各保留 16 像素内边距。",
    );
  }
  if (chart.width <= headerWidth + padding * 2) {
    fail(
      "LANE_CONTENT_FIT",
      `${p}.width`,
      "泳道宽度不足以容纳标题栏和内容区。",
      `增加 width 或减小 headerWidth；标题栏占 ${headerWidth} 像素，内容区左右各留 24 像素。`,
    );
  }
  let y = margin;
  const lanes: LaneLayout[] = chart.lanes.map((lane) => {
    const title = wrap(lane.label, headerWidth - 32, `${p}.lanes.${lane.id}.label`, 3);
    if (title.width > headerWidth - 32) {
      fail(
        "LANE_CONTENT_FIT",
        `${p}.headerWidth`,
        `泳道 ${lane.id} 的标题无法放入声明的标题栏宽度。`,
        "增加 headerWidth，为标题文字和左右内边距留出足够空间。",
      );
    }
    if (title.height + 32 > lane.height || lane.height <= padding * 2) {
      fail(
        "LANE_CONTENT_FIT",
        `${p}.lanes.${lane.id}.height`,
        "泳道高度不足以容纳标题或内容区。",
        "增加泳道 height，或缩短泳道名称。",
      );
    }
    const box = {
      id: lane.id,
      x: margin,
      y,
      width: chart.width,
      height: lane.height,
      title,
      headerWidth,
    };
    y += lane.height;
    return box;
  });
  const scene = finish<SwimlaneScene>({
    kind: "swimlane",
    id: chart.id,
    width: chart.width + margin * 2,
    height: y + margin,
    nodes: [],
    lanes,
    edges: [],
  });
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));
  scene.nodes = chart.nodes.map((node) => {
    const lane = laneById.get(node.lane)!;
    const box = nodeBox(
      node,
      ctx,
      lane.x + headerWidth + padding + node.position.x,
      lane.y + padding + node.position.y,
    );
    if (
      box.x + box.width + padding > lane.x + lane.width ||
      box.y + box.height + padding > lane.y + lane.height
    ) {
      fail(
        "LANE_CONTENT_FIT",
        `${p}.nodes.${node.entity}`,
        `节点 ${node.entity} 超出了泳道 ${lane.id} 的内容区域。`,
        "调整泳道 width、headerWidth、height 或节点 position、size；系统保持声明的尺寸。",
      );
    }
    return box;
  });
  for (let i = 0; i < scene.nodes.length; i++) {
    for (let j = i + 1; j < scene.nodes.length; j++) {
      if (overlaps(scene.nodes[i], scene.nodes[j], 12)) {
        fail(
          "NODE_OVERLAP",
          `${p}.nodes.${scene.nodes[j].id}.position`,
          `节点 ${scene.nodes[i].id} 与 ${scene.nodes[j].id} 重叠或间距不足。`,
          "调整节点 position 或 size，至少保留 12 像素间距，并为连线和标签留白。",
        );
      }
    }
  }
  scene.edges = routeRelations(chart, scene.nodes, {
    obstacles: lanes.map((lane) => ({ ...lane, width: headerWidth })),
    labelObstacles: lanes.flatMap(borderObstacles),
    bounds: {
      x: margin + headerWidth,
      y: margin,
      width: chart.width - headerWidth,
      height: y - margin,
    },
  });
  return scene;
}
