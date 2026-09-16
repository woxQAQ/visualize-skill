import type { Chart, Scene } from "./model.ts";
import type { LayoutContext, NodeLayout, TextLayout } from "./shared/model.ts";
import {
  theme,
  measure,
  nodeDetailsEnabled,
  relationStyles,
  messageStyles,
  messageKindStyles,
} from "./design.ts";
import { escape, number } from "./markup.ts";

function textBlock(
  block: TextLayout,
  x: number,
  y: number,
  { fill = theme.ink, weight = 400 } = {},
) {
  return block.lines
    .map(
      (line, index) => `
    <text x="${number(x)}" y="${number(y + 16 + index * theme.lineHeight)}"
      font-size="${block.size}" font-weight="${weight}" fill="${fill}"
      ${line ? `textLength="${number(measure(line, block.size))}" lengthAdjust="spacingAndGlyphs"` : ""}>${escape(line)}</text>
  `,
    )
    .join("");
}

function nodeMarkup(node: NodeLayout, chart: Chart, ctx: LayoutContext) {
  const entity = ctx.entities.get(node.id)!;
  const color = ctx.colors.get(node.role)!;
  const textX = node.x + node.width / 2;
  const textHeight = node.title.height + (node.detail ? node.detail.height + 6 : 0);
  const textY = node.y + (node.height - textHeight) / 2;
  return `
    <g id="entity-${chart.id}-${node.id}" data-entity="${node.id}" data-role="${node.role}">
      <a class="node-link" text-anchor="middle" ${nodeDetailsEnabled ? `href="#details-${node.id}"` : 'role="group"'} data-entity-detail="details-${node.id}" data-chart="${chart.id}"
        aria-label="${escape(entity.label)}${nodeDetailsEnabled ? "，查看详情" : ""}" tabindex="0">
        <rect class="node-surface" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"
          rx="10" fill="${color.fill}" stroke="${color.ink}" stroke-width="2.5"/>
        ${textBlock(node.title, textX, textY, { weight: 600 })}
        ${node.detail ? textBlock(node.detail, textX, textY + node.title.height + 6, { fill: theme.muted }) : ""}
      </a>
    </g>
  `;
}

function arrowMarker(id: string, { open = false, strokeWidth = 1.5 } = {}) {
  // Use canvas units so a highlighted edge does not enlarge its arrowhead.
  // Padding contains the open arrow's stroke; its solid stem bridges the final
  // dash gap regardless of path length or direction.
  return `
    <marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16"
      viewBox="-2 -2 16 16" refX="10.5" refY="${open ? 6 : 5.25}" orient="auto">
      ${
        open
          ? `<path d="M 0 0 L 10.5 6 L 0 12 M 0 6 H 10.5" fill="none" stroke="context-stroke" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-dasharray="none"/>`
          : `<path d="M 0 0 L 10.5 5.25 L 0 10.5 z" fill="context-stroke"/>`
      }
    </marker>
  `;
}

export function renderSvg(scene: Scene, chart: Chart, ctx: LayoutContext) {
  const callMarker = `arrow-${scene.id}`;
  const openMarker = (width: number) => `open-arrow-${scene.id}-${width}`;
  const styledEdges =
    scene.kind === "sequence"
      ? scene.edges.map((edge) => ({
          ...edge,
          style: { ...messageKindStyles[edge.kind], ...messageStyles[edge.variant] },
        }))
      : scene.edges.map((edge) => ({ ...edge, style: relationStyles[edge.variant] }));
  const edgeMarker = (edge: (typeof styledEdges)[number], width: number) =>
    edge.style.arrow === "open" ? openMarker(width) : callMarker;
  const openWidths = new Set(styledEdges.flatMap(({ style }) => [style.width, style.width + 1]));
  const neighbors = new Map(scene.nodes.map((node) => [node.id, new Set([node.id])]));
  const incidentRelations = new Map(scene.nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of scene.edges) {
    neighbors.get(edge.from)!.add(edge.to);
    neighbors.get(edge.to)!.add(edge.from);
    incidentRelations.get(edge.from)!.add(edge.id);
    incidentRelations.get(edge.to)!.add(edge.id);
  }
  const relationHover = (id: string) =>
    `:is([data-relation-hit="${id}"],[data-relation-label="${id}"]):hover`;
  // The graph is known at render time. Scoped CSS keeps hover and keyboard
  // focus in sync. Membership comes only from direct edges, never from another
  // node's highlighted appearance, so emphasis cannot propagate down a chain.
  const nodeHighlights = scene.nodes
    .map((node) => {
      const triggers = [
        ...[...neighbors.get(node.id)!].map(
          (id) => `[data-entity="${id}"] .node-link:is(:hover,:focus-visible)`,
        ),
        ...[...incidentRelations.get(node.id)!].map(relationHover),
      ].join(",");
      return `
      #diagram-${scene.id} svg:has(${triggers}) [data-entity="${node.id}"] {
        opacity:1;
        --node-elevation:drop-shadow(0 3px 4px var(--node-shadow-color));
      }
    `;
    })
    .join("");
  const highlights = styledEdges
    .map((edge) => {
      const width = edge.style.width + 1;
      const endpoints = [...new Set([edge.from, edge.to])]
        .map((id) => `[data-entity="${id}"] .node-link:is(:hover,:focus-visible)`)
        .join(",");
      const active = `#diagram-${scene.id} svg:has(${endpoints},${relationHover(edge.id)})`;
      return `
      ${active} [data-relation="${edge.id}"] {
        opacity:1;stroke-width:${width};
        marker-end:url(#${edgeMarker(edge, width)});
      }
      ${active} [data-relation-label="${edge.id}"] { opacity:1; }
      ${active} [data-relation-label="${edge.id}"] text { font-weight:600; }
    `;
    })
    .join("");
  const partitions = (scene.kind !== "swimlane" ? scene.partitions : [])
    .map(
      (partition) => `
    <g data-partition="${partition.id}" role="group" aria-label="${escape(partition.title.lines.join(""))}，逻辑分区">
      <rect x="${partition.x}" y="${partition.y}" width="${partition.width}" height="${partition.height}" rx="4"
        fill="${theme.subtle}" stroke="${theme.line}" stroke-dasharray="6 4"/>
      ${textBlock(partition.title, partition.x + 24, partition.y + 12, { fill: theme.muted, weight: 600 })}
    </g>
  `,
    )
    .join("");
  const lanes = (scene.kind === "swimlane" ? scene.lanes : [])
    .map(
      (lane) => `
    <g data-lane="${lane.id}" role="group" aria-label="${escape(lane.title.lines.join(""))}，泳道">
      <rect x="${lane.x}" y="${lane.y}" width="${lane.width}" height="${lane.height}" fill="${theme.surface}" stroke="${theme.line}"/>
      <rect x="${lane.x}" y="${lane.y}" width="${lane.headerWidth}" height="${lane.height}" fill="${theme.subtle}" stroke="${theme.line}"/>
      ${textBlock(lane.title, lane.x + 16, lane.y + (lane.height - lane.title.height) / 2, { weight: 600 })}
    </g>
  `,
    )
    .join("");
  const lifelines = (scene.kind === "sequence" ? scene.lifelines : [])
    .map(
      (line) => `
    <path d="M ${line.x} ${line.y1} V ${line.y2}" stroke="${theme.line}" stroke-dasharray="4 5"/>
  `,
    )
    .join("");
  const activations = (scene.kind === "sequence" ? scene.activations : [])
    .map(
      (bar) => `
    <rect data-activation="${bar.callId}" data-participant="${bar.entity}"
      x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}"
      fill="${theme.surface}" stroke="${theme.ink}" stroke-width="1.2"/>
  `,
    )
    .join("");
  const edges = styledEdges
    .map((edge) => {
      const style = edge.style;
      return `
    <path data-relation="${edge.id}" data-variant="${edge.variant}"${"kind" in edge ? ` data-kind="${edge.kind}"` : ""} d="${edge.path}" fill="none" stroke="${style.ink}" stroke-width="${style.width}"
      stroke-dasharray="${style.dash}" marker-end="url(#${edgeMarker(edge, style.width)})"/>
    <path data-relation-hit="${edge.id}" d="${edge.path}" fill="none" stroke="transparent" stroke-width="12"
      vector-effect="non-scaling-stroke" pointer-events="stroke" aria-hidden="true"/>
  `;
    })
    .join("");
  const labels = styledEdges
    .map(
      (edge) => `
    <g data-relation-label="${edge.id}">
      <rect x="${number(edge.labelX - 3)}" y="${number(edge.labelY - 2)}" width="${number(edge.label.width + 6)}"
        height="${edge.label.height + 4}" fill="${theme.surface}"/>
      ${textBlock(edge.label, edge.labelX, edge.labelY, { fill: edge.style.ink, weight: edge.style.weight })}
    </g>
  `,
    )
    .join("");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}"
      viewBox="0 0 ${scene.width} ${scene.height}" role="group"
      aria-labelledby="svg-title-${scene.id} svg-desc-${scene.id}" style="font-family:${theme.font};color:${theme.ink}">
      <title id="svg-title-${scene.id}">${escape(chart.meta.title)}</title>
      <desc id="svg-desc-${scene.id}">${chart.meta.subtitle === undefined ? "" : `${escape(chart.meta.subtitle)} `}悬停或键盘聚焦节点时强调当前节点、直接相邻节点和相连关系，弱化其余节点与关系。悬停关系线或关系文字时，仅强调当前关系及其起点和终点。${nodeDetailsEnabled ? "点击节点或按 Enter 查看详细内容。" : ""}${scene.kind === "sequence" ? "默认蓝色实线实心箭头表示同步调用，绿色实线开口箭头表示异步消息，橙色虚线开口箭头表示响应。主链路使用紫色加粗，鉴权、权限或策略消息使用红色；这些强调色保留消息原有线型和箭头。生命线上的矩形表示同步执行区间，虚线框表示参与者分区。" : scene.kind === "swimlane" ? "横向泳道表示负责的人或系统，节点表示流程活动，箭头和标签表示流转方向与条件。" : "虚线框表示逻辑分区，箭头表示依赖，关系文字直接标注在线旁。"}</desc>
      <style>@media screen {
        #diagram-${scene.id} svg:has(.node-link:is(:hover,:focus-visible),[data-relation-hit]:hover,[data-relation-label]:hover) :is([data-entity],[data-relation],[data-relation-label]) { opacity:0.45; }
        ${nodeHighlights}${highlights}
      }</style>
      <defs>
        ${arrowMarker(callMarker)}
        ${[...openWidths].map((width) => arrowMarker(openMarker(width), { open: true, strokeWidth: width })).join("")}
      </defs>
      ${partitions}${lanes}${lifelines}${activations}${edges}
      ${scene.nodes.map((node) => nodeMarkup(node, chart, ctx)).join("")}
      ${labels}
    </svg>
  `;
}
