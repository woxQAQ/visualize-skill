import type { Chart, LayoutContext, NodeLayout, Scene, TextLayout } from './model.ts';
import { theme, measure } from './design.ts';
import { escape, number } from './markup.ts';

function textBlock(block: TextLayout, x: number, y: number, { fill = theme.ink, weight = 400 } = {}) {
  return block.lines.map((line, index) => `
    <text x="${number(x)}" y="${number(y + 16 + index * theme.lineHeight)}"
      font-size="${block.size}" font-weight="${weight}" fill="${fill}"
      ${line ? `textLength="${number(measure(line, block.size))}" lengthAdjust="spacingAndGlyphs"` : ''}>${escape(line)}</text>
  `).join('');
}

function frames(scene: Scene) {
  return (scene.kind === 'sequence' ? scene.fragments : []).map(frame => `
    <g data-fragment="${frame.id}">
      <rect x="${frame.x}" y="${frame.y}" width="${frame.width}" height="${frame.height}"
        fill="none" stroke="${theme.line}"/>
      <path d="M ${frame.x} ${frame.y} h 48 v 17 l -9 9 h -39 z" fill="#f4f5f6" stroke="${theme.line}"/>
      <text x="${frame.x + 10}" y="${frame.y + 18}" font-size="12" font-weight="600">alt</text>
      ${frame.branches.map((branch, index) => `
        ${index ? `<path d="M ${frame.x} ${branch.y - 8} H ${frame.x + frame.width}" stroke="${theme.line}" stroke-dasharray="5 4"/>` : ''}
        <rect x="${frame.x + 10}" y="${branch.y - 1}" width="${branch.label.width + 8}" height="${branch.label.height + 2}" fill="white"/>
        ${textBlock(branch.label, frame.x + 14, branch.y, { fill: theme.muted })}
      `).join('')}
    </g>
  `).join('');
}

function nodeMarkup(node: NodeLayout, chart: Chart, ctx: LayoutContext) {
  const entity = ctx.entities.get(node.id)!;
  const color = ctx.colors.get(node.role)!;
  const textX = node.x + node.width / 2;
  const textHeight = node.title.height + (node.detail ? node.detail.height + 6 : 0);
  const textY = node.y + (node.height - textHeight) / 2;
  return `
    <g id="entity-${chart.id}-${node.id}" data-entity="${node.id}" data-role="${node.role}">
      <a class="node-link" text-anchor="middle" href="#details-${node.id}" data-entity-detail="details-${node.id}" data-chart="${chart.id}"
        aria-label="${escape(entity.label)}，查看详情" tabindex="0" style="--node-hover-fill:${color.fill}">
        <rect class="node-surface" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"
          rx="4" fill="${color.fill}" stroke="${color.ink}"/>
        ${textBlock(node.title, textX, textY, { weight: 600 })}
        ${node.detail ? textBlock(node.detail, textX, textY + node.title.height + 6, { fill: theme.muted }) : ''}
      </a>
    </g>
  `;
}

function arrowMarker(id: string, color: string, { returning = false, strokeWidth = 1.5 } = {}) {
  // Use canvas units so a highlighted edge does not enlarge its arrowhead.
  // Padding contains the open arrow's stroke; its solid stem bridges the final
  // dash gap regardless of path length or direction.
  return `
    <marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16"
      viewBox="-2 -2 16 16" refX="10.5" refY="${returning ? 6 : 5.25}" orient="auto">
      ${returning
        ? `<path d="M 0 0 L 10.5 6 L 0 12 M 0 6 H 10.5" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linejoin="round" stroke-dasharray="none"/>`
        : `<path d="M 0 0 L 10.5 5.25 L 0 10.5 z" fill="${color}"/>`}
    </marker>
  `;
}

export function renderSvg(scene: Scene, chart: Chart, ctx: LayoutContext) {
  const callMarker = `arrow-${scene.id}`;
  const returnMarker = `return-arrow-${scene.id}`;
  const highlightCallMarker = `highlight-arrow-${scene.id}`;
  const highlightReturnMarker = `highlight-return-arrow-${scene.id}`;
  const highlight = theme.palette[0].ink;
  // The graph is known at render time. Scoped CSS keeps hover and keyboard
  // focus in sync without storing transient interaction state in JavaScript.
  const highlights = scene.edges.map(edge => {
    const endpoints = [...new Set([edge.from, edge.to])]
      .map(id => `[data-entity="${id}"] .node-link:is(:hover,:focus-visible)`).join(',');
    const active = `#diagram-${scene.id} svg:has(${endpoints})`;
    return `
      ${active} [data-relation="${edge.id}"] {
        stroke:${highlight};stroke-width:2.5;
        marker-end:url(#${edge.dashed ? highlightReturnMarker : highlightCallMarker});
      }
      ${active} [data-relation-label="${edge.id}"] text { fill:${highlight};font-weight:600; }
    `;
  }).join('');
  const partitions = (scene.kind === 'architecture' ? scene.partitions : []).map(partition => `
    <g data-partition="${partition.id}" role="group" aria-label="${escape(partition.title.lines.join(''))}，逻辑分区">
      <rect x="${partition.x}" y="${partition.y}" width="${partition.width}" height="${partition.height}" rx="4"
        fill="#fafbfc" stroke="${theme.line}" stroke-dasharray="6 4"/>
      ${textBlock(partition.title, partition.x + 24, partition.y + 12, { fill: theme.muted, weight: 600 })}
    </g>
  `).join('');
  const lanes = (scene.kind === 'swimlane' ? scene.lanes : []).map(lane => `
    <g data-lane="${lane.id}" role="group" aria-label="${escape(lane.title.lines.join(''))}，泳道">
      <rect x="${lane.x}" y="${lane.y}" width="${lane.width}" height="${lane.height}" fill="white" stroke="${theme.line}"/>
      <rect x="${lane.x}" y="${lane.y}" width="${lane.headerWidth}" height="${lane.height}" fill="#f4f5f6" stroke="${theme.line}"/>
      ${textBlock(lane.title, lane.x + 16, lane.y + (lane.height - lane.title.height) / 2, { weight: 600 })}
    </g>
  `).join('');
  const lifelines = (scene.kind === 'sequence' ? scene.lifelines : []).map(line => `
    <path d="M ${line.x} ${line.y1} V ${line.y2}" stroke="${theme.line}" stroke-dasharray="4 5"/>
  `).join('');
  const activations = (scene.kind === 'sequence' ? scene.activations : []).map(bar => `
    <rect data-activation="${bar.callId}" data-participant="${bar.entity}"
      x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}"
      fill="white" stroke="${theme.ink}" stroke-width="1.2"/>
  `).join('');
  const edges = scene.edges.map(edge => `
    <path data-relation="${edge.id}" d="${edge.path}" fill="none" stroke="${theme.line}" stroke-width="1.5"
      ${edge.dashed ? 'stroke-dasharray="5 4"' : ''} marker-end="url(#${edge.dashed ? returnMarker : callMarker})"/>
  `).join('');
  const labels = scene.edges.map(edge => `
    <g data-relation-label="${edge.id}">
      <rect x="${number(edge.labelX - 3)}" y="${number(edge.labelY - 2)}" width="${number(edge.label.width + 6)}"
        height="${edge.label.height + 4}" fill="white"/>
      ${textBlock(edge.label, edge.labelX, edge.labelY)}
    </g>
  `).join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}"
      viewBox="0 0 ${scene.width} ${scene.height}" role="group"
      aria-labelledby="svg-title-${scene.id} svg-desc-${scene.id}" style="font-family:${theme.font};color:${theme.ink}">
      <title id="svg-title-${scene.id}">${escape(chart.title)}</title>
      <desc id="svg-desc-${scene.id}">悬停或键盘聚焦节点时高亮相连关系，点击节点或按 Enter 查看详细内容。${scene.kind === 'sequence' ? '实线表示同步调用，虚线表示返回，生命线上的矩形表示执行区间。' : scene.kind === 'swimlane' ? '横向泳道表示负责的人或系统，节点表示流程活动，箭头和标签表示流转方向与条件。' : '虚线框表示逻辑分区，箭头表示依赖，关系文字直接标注在线旁。'}</desc>
      ${highlights ? `<style>@media screen {${highlights}}</style>` : ''}
      <defs>
        ${arrowMarker(callMarker, theme.line)}
        ${arrowMarker(returnMarker, theme.line, { returning: true })}
        ${arrowMarker(highlightCallMarker, highlight)}
        ${arrowMarker(highlightReturnMarker, highlight, { returning: true, strokeWidth: 2.5 })}
      </defs>
      ${partitions}${lanes}${lifelines}${frames(scene)}${activations}${edges}
      ${scene.nodes.map(node => nodeMarkup(node, chart, ctx)).join('')}
      ${labels}
    </svg>
  `;
}
