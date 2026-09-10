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
        aria-label="${escape(entity.label)}，查看详情" tabindex="0" style="--node-color:${color.ink};--node-hover-fill:${color.fill}">
        <rect class="node-surface" x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}"
          rx="4" fill="${color.fill}" stroke="${color.ink}"/>
        ${textBlock(node.title, textX, textY, { weight: 600 })}
        ${node.detail ? textBlock(node.detail, textX, textY + node.title.height + 6, { fill: theme.muted }) : ''}
      </a>
    </g>
  `;
}

export function renderSvg(scene: Scene, chart: Chart, ctx: LayoutContext) {
  const callMarker = `arrow-${scene.id}`;
  const returnMarker = `return-arrow-${scene.id}`;
  const backgrounds = (scene.kind === 'architecture' ? scene.partitions : []).map(partition => `
    <g data-partition="${partition.id}" role="group" aria-label="${escape(partition.title.lines.join(''))}，逻辑分区">
      <rect x="${partition.x}" y="${partition.y}" width="${partition.width}" height="${partition.height}" rx="4"
        fill="#fafbfc" stroke="${theme.line}" stroke-dasharray="6 4"/>
      ${textBlock(partition.title, partition.x + 24, partition.y + 12, { fill: theme.muted, weight: 600 })}
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
    <rect x="${number(edge.labelX - 3)}" y="${number(edge.labelY - 2)}" width="${number(edge.label.width + 6)}"
      height="${edge.label.height + 4}" fill="white"/>
    ${textBlock(edge.label, edge.labelX, edge.labelY)}
  `).join('');

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}"
      viewBox="0 0 ${scene.width} ${scene.height}" role="group"
      aria-labelledby="svg-title-${scene.id} svg-desc-${scene.id}" style="font-family:${theme.font};color:${theme.ink}">
      <title id="svg-title-${scene.id}">${escape(chart.title)}</title>
      <desc id="svg-desc-${scene.id}">点击节点或按 Enter 查看详细内容。${scene.kind === 'sequence' ? '实线表示同步调用，虚线表示返回，生命线上的矩形表示执行区间。' : '虚线框表示逻辑分区，箭头表示依赖，关系文字直接标注在线旁。'}</desc>
      <defs>
        <marker id="${callMarker}" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto">
          <path d="M 0 0 L 7 3.5 L 0 7 z" fill="${theme.line}"/>
        </marker>
        <marker id="${returnMarker}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M 0 0 L 7 4 L 0 8" fill="none" stroke="${theme.line}"/>
        </marker>
      </defs>
      ${backgrounds}${lifelines}${frames(scene)}${activations}${edges}
      ${scene.nodes.map(node => nodeMarkup(node, chart, ctx)).join('')}
      ${labels}
    </svg>
  `;
}
