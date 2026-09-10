import type { Call, SemanticDocument, Step } from './model.js';
import type { Document } from './sdk.js';
import { context, stylesheet } from './design.js';
import { plainText } from './markdown.js';
import { layoutArchitecture } from './layout/architecture.js';
import { layoutSequence } from './layout/sequence.js';
import { validate } from './validate.js';
import { isDocument } from './sdk.js';
import { fail } from './diagnostics.js';
import { escape } from './markup.js';
import { renderMarkdown } from './render-markdown.js';
import { renderSvg } from './render-svg.js';
import { interactionScript } from './interactions.js';

function entityNotes(semantic: SemanticDocument) {
  const roles = new Map(semantic.roles.map(role => [role.id, role.label]));
  const entities = new Map(semantic.entities.map(entity => [entity.id, entity]));
  const charts = semantic.blocks.filter(block => block.kind === 'diagram').map(block => block.content);
  const link = (id: string) => `<a href="#details-${id}" data-entity-detail="details-${id}">${escape(entities.get(id)!.label)}</a>`;
  const calls = (steps: readonly Step[]): Call[] => steps.flatMap(step => step.kind === 'alternative'
    ? step.branches.flatMap(branch => calls(branch.steps)) : step.kind === 'call' ? [step] : []);
  const notes = semantic.entities.map(entity => {
    const appearances = charts.flatMap(chart => {
      const node = (chart.kind === 'architecture' ? chart.nodes : chart.participants).find(node => node.entity === entity.id);
      if (!node) return [];
      const partitionId = chart.kind === 'architecture' ? chart.nodes.find(item => item.entity === entity.id)?.partition : undefined;
      const partition = chart.kind === 'architecture' ? chart.partitions.find(item => item.id === partitionId) : undefined;
      const related = (chart.kind === 'architecture' ? chart.relations : calls(chart.steps))
        .filter(relation => relation.from === entity.id || relation.to === entity.id);
      return [`
        <section class="entity-context">
          <h3><a href="#diagram-${chart.id}">${escape(chart.title)}</a></h3>
          <dl class="entity-facts">
            <div><dt>角色</dt><dd>${escape(roles.get(node.role))}</dd></div>
            ${partition ? `<div><dt>所属分区</dt><dd>${escape(partition.label)}</dd></div>` : ''}
          </dl>
          ${related.length ? `<table class="entity-relations"><thead><tr><th>方向</th><th>关联节点</th><th>关系</th></tr></thead><tbody>${related.map(relation => {
            const outgoing = relation.from === entity.id;
            const self = relation.from === relation.to;
            const direction = self ? '内部' : outgoing ? '发出' : '接收';
            return `<tr><td>${direction}</td><td>${link(outgoing ? relation.to : relation.from)}</td><td>${escape(relation.label)}</td></tr>`;
          }).join('')}</tbody></table>` : ''}
        </section>
      `];
    });
    return `
      <details>
        <summary>${escape(entity.label)}</summary>
        <article id="details-${entity.id}" tabindex="-1">
          <h2 id="detail-title-${entity.id}">${escape(entity.label)}</h2>
          <dl class="entity-facts"><div><dt>标识</dt><dd><code>${entity.id}</code></dd></div></dl>
          ${entity.tags.length ? `<h3>标签</h3><ul class="entity-tags">${entity.tags.map(tag => `<li data-tag="${tag.id}">${escape(tag.label)}</li>`).join('')}</ul>` : ''}
          ${appearances.join('')}
        </article>
      </details>
    `;
  }).join('');
  return `<section class="entity-notes"><h2>节点资料</h2>${notes}</section>`;
}

export function compile(document: Document) {
  if (!isDocument(document)) {
    fail('INVALID_DOCUMENT', 'export.default', '默认导出必须是 SDK 的 document() 结果。', '使用 export default document().markdown(...).diagram(...)。');
  }
  const semantic = validate(document.toJSON());
  const ctx = context(semantic);
  const scenes = semantic.blocks.filter(block => block.kind === 'diagram')
    .map(block => block.content.kind === 'architecture' ? layoutArchitecture(block.content, ctx) : layoutSequence(block.content, ctx));
  return { semantic, scenes };
}

export function render(document: Document) {
  const { semantic, scenes } = compile(document);
  const ctx = context(semantic);
  const firstHeading = semantic.blocks.flatMap(block => block.kind === 'markdown' ? block.content : [])
    .find(block => block.kind === 'heading');
  const title = firstHeading ? plainText(firstHeading.children)
    : semantic.blocks.find(block => block.kind === 'diagram')?.content.title ?? '可视化报告';
  const single = semantic.blocks.length === 1 && semantic.blocks[0].kind === 'diagram';
  let sceneIndex = 0, headingIndex = 0;
  const nextHeading = () => ++headingIndex;

  const content = semantic.blocks.map(block => {
    if (block.kind === 'markdown') return `<section class="prose">${renderMarkdown(block.content, nextHeading)}</section>`;
    const chart = block.content;
    const roleIds = new Set((chart.kind === 'architecture' ? chart.nodes : chart.participants).map(node => node.role));
    const legend = semantic.roles.filter(role => roleIds.has(role.id)).map(role => {
      const color = ctx.colors.get(role.id)!;
      return `<span><i aria-hidden="true" style="--role-color:${color.ink};--role-fill:${color.fill}"></i>${escape(role.label)}</span>`;
    }).join('');
    return `
      <figure id="diagram-${chart.id}">
        <figcaption>${escape(chart.title)}</figcaption>
        <div class="legend" aria-label="角色图例">${legend}</div>
        <div class="diagram-scroll" tabindex="0" role="region" aria-label="${escape(chart.title)}，宽图可横向滚动">
          ${renderSvg(scenes[sceneIndex++], chart, ctx)}
        </div>
      </figure>
    `;
  }).join('\n');

  const hasEntities = semantic.entities.length > 0;
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="generator" content="visualize-semantic 0.1.0">
    <title>${escape(title)}</title>
    <style>${stylesheet}</style>
  </head>
  <body>
    <main${single ? ' class="single"' : ''}>${content}${hasEntities ? entityNotes(semantic) : ''}</main>
    ${hasEntities ? `
      <dialog id="node-details" class="detail-dialog">
        <form method="dialog"><button type="submit" aria-label="关闭节点详情">关闭</button></form>
        <div data-detail-content></div>
      </dialog>
      <script data-visualize-interaction>${interactionScript}</script>
    ` : ''}
  </body>
</html>
`;
}
