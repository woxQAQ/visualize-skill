// Compile-only checks: invalid declarations must fail before rendering.
import { architecture, document, entity, role, sequence } from '@visualize/semantic';
import type { SemanticDocument, Step } from '@visualize/semantic';

const item = entity({ id: 'item', label: '对象', tags: [{ id: 'public', label: '公开' }] });
const worker = role({ id: 'worker', label: '处理者' });
const size = { width: 220, height: 88 };

architecture({ id: 'valid', title: '有效声明', nodes: [{ entity: item, role: worker, size, position: { x: 0, y: 0 } }], relations: [] });
// @ts-expect-error Architecture nodes require an explicit size.
architecture({ id: 'missing-size', title: '缺少尺寸', nodes: [{ entity: item, role: worker, position: { x: 0, y: 0 } }], relations: [] });
// @ts-expect-error Sequence participants require an explicit size too.
sequence({ id: 'missing-size', title: '缺少尺寸', participants: [{ entity: item, role: worker }], steps: [] });
// @ts-expect-error A tag is a named classification record, not arbitrary text.
entity({ id: 'bad-tags', label: '错误标签', tags: ['正文'] });
// @ts-expect-error A node has no Markdown details field.
entity({ id: 'bad-details', label: '错误正文', details: '# 正文' });
// @ts-expect-error Shared entity tags cannot be mutated after declaration.
item.tags.push({ id: 'new', label: '新标签' });
// @ts-expect-error References use identifiers, not numeric indices.
sequence({ id: 'bad-reply', title: '错误返回', participants: [{ entity: item, role: worker, size }], steps: [{ id: 'return', from: item, to: item, label: '返回', replyTo: 1 }] });
// @ts-expect-error Markdown input must be text.
document().markdown({ description: '正文' });

function inspectStep(step: Step): string {
  if (step.kind === 'alternative') return step.branches[0].label;
  if (step.kind === 'return') return step.replyTo;
  // @ts-expect-error A call cannot be mistaken for a return.
  return step.replyTo;
}
function inspectDocument(value: SemanticDocument): void {
  // @ts-expect-error The serialized semantic model is immutable too.
  value.blocks.push({ kind: 'markdown', content: [] });
}
void inspectStep;
void inspectDocument;

// @ts-expect-error Entity ownership cannot substitute for logical partition membership.
architecture({ id: 'bad-parent', title: '错误归属', nodes: [{ entity: item, role: worker, size, position: { x: 0, y: 0 }, parent: item }], relations: [] });
// @ts-expect-error A partition is identified by its local identifier, not an entity object.
architecture({ id: 'bad-partition', title: '错误分区', nodes: [{ entity: item, role: worker, size, position: { x: 0, y: 0 }, partition: item }], relations: [] });
