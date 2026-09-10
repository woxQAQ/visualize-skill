import type { ArchitectureOptions, EntityInput, Partition, StepInput } from '@visualize/semantic';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as sdk from '@visualize/semantic';
import { document, entity, role, architecture, sequence, compile, render, DiagnosticError } from '@visualize/semantic';
import report, { overview, generation } from '../examples/self-explanation.ts';
import { wrap, measure } from '../dist/design.js';

const worker = role({ id: 'worker', label: '处理者' });
const a = entity({ id: 'a', label: '服务 A' });
const b = entity({ id: 'b', label: '服务 B' });
const c = entity({ id: 'c', label: '服务 C' });
const appearance = (entity: EntityInput, x = 0, y = 0, partition?: string) => ({ entity, role: worker, position: { x, y }, size: { width: 220, height: 88 }, ...(partition ? { partition } : {}) });
const nodes = [appearance(a), appearance(b, 340)];
const participants = [a, b, c].map(entity => ({ entity, role: worker, size: { width: 160, height: 56 } }));
const relation = { id: 'request', from: a, to: b, label: '发送请求' };
const returned = { id: 'response', from: b, to: a, label: '返回结果', replyTo: 'request' };
const chart = (options: Partial<ArchitectureOptions> = {}) => architecture({ id: 'architecture', title: '架构', nodes, relations: [relation], ...options });
const timeline = (steps: readonly StepInput[]) => sequence({ id: 'sequence', title: '时序', participants, steps });
const hasCode = (code: string) => (error: unknown) => error instanceof DiagnosticError && error.diagnostics.some(d => d.code === code && d.path && d.hint);

test('self explanation uses architecture and sequence with serializable shared tags', () => {
  const { semantic, scenes } = compile(report);
  assert.deepEqual(scenes.map(scene => scene.kind), ['architecture', 'sequence']);
  assert.equal(semantic.entities.filter(entity => entity.id === 'sdk').length, 1);
  assert.ok(semantic.entities.find(entity => entity.id === 'skill')!.tags.length > 0);
  assert.deepEqual(JSON.parse(JSON.stringify(semantic)), semantic);
  assert.deepEqual(Object.keys(sdk).sort(), ['DiagnosticError', 'architecture', 'compile', 'document', 'entity', 'render', 'role', 'sequence'].sort());
  for (const scene of scenes) {
    for (const node of scene.nodes) {
      assert.ok(node.x >= 0 && node.y >= 0);
      assert.ok(node.x + node.width <= scene.width);
      assert.ok(node.y + node.height <= scene.height);
      assert.ok(node.title.width <= node.width - 32 + 0.001);
    }
    for (const edge of scene.edges) assert.ok(edge.labelX + edge.label.width <= scene.width);
  }
});

test('chain branches are independent and diagram creation does not append content', () => {
  const base = document().markdown('# 标题');
  const unused = chart();
  const left = base.diagram(unused);
  const right = base.markdown('另外一段');
  assert.equal(base.toJSON().blocks.length, 1);
  assert.equal(left.toJSON().blocks[1].kind, 'diagram');
  assert.equal(right.toJSON().blocks[1].kind, 'markdown');
  assert.throws(() => { Object.defineProperty(left.toJSON().blocks, '0', { value: {} }); }, TypeError);
});

test('single diagram retains the same geometry and interactive node articles', () => {
  const single = document().diagram(overview);
  assert.deepEqual(compile(single).scenes[0], compile(report).scenes[0]);
  const html = render(single);
  assert.match(html, /<main class="single">/);
  assert.match(html, /id="details-skill"/);
  assert.match(html, /<dialog id="node-details"/);
});

test('output is deterministic and only contains the owned interaction script', () => {
  const html = render(report);
  assert.equal(html, render(report));
  assert.doesNotMatch(html, /<link|<iframe|<img|\bsrc=/i);
  assert.equal((html.match(/<script\b/g) ?? []).length, 1);
  assert.match(html, /<script data-visualize-interaction>/);
  assert.equal((html.match(/<svg /g) ?? []).length, 2);
  assert.doesNotMatch(html, /查看对象与关系的文字说明/);
});

test('all fragment links resolve and each shared detail article occurs only once', () => {
  const html = render(report);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size);
  for (const [, id] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(id), id);
  assert.equal((html.match(/id="details-sdk"/g) ?? []).length, 1);
  assert.ok((html.match(/data-entity-detail="details-sdk"/g) ?? []).length >= 2);
});

test('detail links locate related nodes in their chart and shared nodes across charts', () => {
  const html = render(report);
  for (const id of ['system-architecture', 'generation-sequence']) {
    assert.match(html, new RegExp(`data-entity-detail="details-sdk" data-chart="${id}"`));
    assert.match(html, new RegExp(`<section class="entity-context" data-detail-chart="${id}">`));
    assert.match(html, new RegExp(`href="#entity-${id}-sdk" data-locate-node="entity-${id}-sdk"`));
  }
  assert.doesNotMatch(html, /<h3><a href="#diagram-/);
  assert.doesNotMatch(html, /data-detail-back/);
  const articles = [...html.matchAll(/<article id="details-[^]*?<\/article>/g)];
  for (const [article] of articles) {
    assert.doesNotMatch(article, /data-entity-detail=/);
    for (const [, chartId, section] of article.matchAll(/data-detail-chart="([^"]+)"([^]*?)<\/section>/g)) {
      for (const [, target] of section.matchAll(/data-locate-node="([^"]+)"/g)) {
        assert.ok(target.startsWith(`entity-${chartId}-`), target);
      }
    }
  }
  assert.match(html, /href="#entity-system-architecture-layout" data-locate-node="entity-system-architecture-layout" title="在当前图中定位此节点">图表布局<\/a>/);
  const selfRelation = render(document().diagram(timeline([
    { id: 'self', from: a, to: a, label: '内部处理' },
    { id: 'done', from: a, to: a, label: '完成', replyTo: 'self' },
  ])));
  assert.match(selfRelation, /<td>内部<\/td><td>服务 A<\/td>/);
});

test('tags render as structured properties without changing geometry or parsing Markdown', () => {
  const detailed = entity({ id: 'a', label: '服务 A', tags: [{ id: 'public', label: '**公开接口**' }, { id: 'safe', label: '<b>文字</b>' }] });
  const first = compile(document().diagram(chart())).scenes[0];
  const tagged = document().diagram(chart({ nodes: [appearance(detailed), appearance(b, 340)] }));
  const second = compile(tagged).scenes[0];
  assert.deepEqual(first, second);
  const html = render(tagged);
  assert.match(html, /<li data-tag="public">\*\*公开接口\*\*<\/li>/);
  assert.match(html, /&lt;b&gt;文字&lt;\/b&gt;/);
  assert.match(html, /<dt>角色<\/dt><dd>处理者<\/dd>/);
  assert.match(html, /<td>发出<\/td>/);
  assert.match(html, /<td>发送请求<\/td>/);
  assert.doesNotMatch(html, /<text[^>]*>查看详情/);
  assert.doesNotMatch(html, /detail-affordance/);
});

test('node properties reject arbitrary bodies and enforce short classification labels', () => {
  for (const field of ['details', 'metadata', 'body']) {
    assert.throws(() => entity({ id: 'bad', label: '错误', [field]: { description: '# 正文' } }), hasCode('UNKNOWN_FIELD'));
  }
  const tag = { id: 'public', label: '公开接口' };
  assert.throws(() => entity({ id: 'bad', label: '错误', tags: [tag, tag] }), hasCode('DUPLICATE_TAG'));
  // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
  assert.throws(() => entity({ id: 'bad', label: '错误', tags: [{ ...tag, description: '正文' }] }), hasCode('UNKNOWN_FIELD'));
  assert.throws(() => entity({ id: 'bad', label: '错误', tags: [{ ...tag, label: '字'.repeat(25) }] }), hasCode('INVALID_SHORT_TEXT'));
  assert.throws(() => entity({ id: 'bad', label: '错误', tags: Array.from({ length: 9 }, (_, i) => ({ id: `tag-${i}`, label: '标签' })) }), hasCode('TAG_CAPACITY'));
  for (const description of ['字'.repeat(81), '第一行\n第二行']) {
    assert.throws(() => entity({ id: 'bad', label: '错误', description }), hasCode('INVALID_SHORT_TEXT'));
  }
});

test('shared entity and tag identifiers cannot have conflicting definitions', () => {
  const revised = entity({ id: 'a', label: '服务 A', tags: [{ id: 'public', label: '公开接口' }] });
  const second = chart({ id: 'second', nodes: [appearance(revised)], relations: [] });
  assert.throws(() => compile(document().diagram(chart()).diagram(second)), hasCode('IDENTITY_CONFLICT'));
  const conflicting = entity({ id: 'b', label: '服务 B', tags: [{ id: 'public', label: '内部接口' }] });
  assert.throws(() => compile(document().diagram(chart({ nodes: [appearance(revised), appearance(conflicting, 340)] }))), hasCode('TAG_IDENTITY_CONFLICT'));
});

test('partitions are logical regions with explicit geometry, not entities', () => {
  const partition: Partition = { id: 'zone', label: '逻辑区域', position: { x: 80, y: 100 }, size: { width: 400, height: 300 } };
  const grouped = chart({ partitions: [partition], nodes: [appearance(b, 40, 60, 'zone')], relations: [] });
  const doc = document().diagram(grouped);
  const { semantic, scenes } = compile(doc);
  assert.deepEqual(semantic.entities.map(entity => entity.id), ['b']);
  const scene = scenes[0];
  assert.ok(scene.kind === 'architecture');
  const [region] = scene.partitions;
  const [child] = scene.nodes;
  assert.deepEqual([region.x, region.y, region.width, region.height], [112, 132, 400, 300]);
  assert.equal(child.x, region.x + 24 + 40);
  assert.equal(child.y, region.y + region.headerHeight + 24 + 60);
  const html = render(doc);
  assert.match(html, /data-partition="zone"/);
  assert.match(html, /<dt>所属分区<\/dt><dd>逻辑区域<\/dd>/);
  assert.doesNotMatch(html, /data-entity="zone"|details-zone/);
  assert.throws(() => compile(doc.markdown('[区域](entity:zone)')), hasCode('UNKNOWN_REFERENCE'));
});

test('invalid coordinates and overlapping siblings produce actionable diagnostics', () => {
  for (const position of [{ x: -1, y: 0 }, { x: NaN, y: 1 }, { x: Infinity, y: 0 }, { x: 0 }]) {
    // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
    assert.throws(() => chart({ nodes: [{ ...appearance(a), position }], relations: [] }), hasCode('INVALID_POSITION'));
  }
  assert.throws(() => compile(document().diagram(chart({ nodes: [appearance(a), appearance(b, 100)] }))), hasCode('NODE_OVERLAP'));
});

test('position is local to architecture and does not expose arbitrary visual styles', () => {
  // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
  assert.throws(() => entity({ id: 'a', label: 'A', color: 'red' }), hasCode('UNKNOWN_FIELD'));
  // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
  assert.throws(() => chart({ nodes: [{ ...appearance(a), width: 500 }] }), hasCode('UNKNOWN_FIELD'));
  assert.throws(() => sequence({ id: 'bad', title: '错误', participants: [appearance(a)], steps: [] }), hasCode('UNKNOWN_FIELD'));
  // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
  assert.throws(() => document().diagram({ kind: 'architecture' }), hasCode('INVALID_DIAGRAM'));
  // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
  assert.throws(() => render({ blocks: [] }), hasCode('INVALID_DOCUMENT'));
});

test('declared width and height are preserved for architecture and sequence appearances', () => {
  const size = { width: 260, height: 100 };
  const arch = chart({ nodes: [{ ...appearance(a), size }], relations: [] });
  const seq = sequence({ id: 'sequence', title: '不同尺寸', participants: [
    { ...participants[0], size }, { ...participants[1], size: { width: 180, height: 60 } }
  ], steps: [relation, returned] });
  const { semantic, scenes } = compile(document().diagram(arch).diagram(seq));
  const firstBlock = semantic.blocks[0];
  assert.ok(firstBlock.kind === 'diagram' && firstBlock.content.kind === 'architecture');
  for (const scene of scenes) {
    assert.equal(scene.nodes[0].width, 260);
    assert.equal(scene.nodes[0].height, 100);
  }
  assert.deepEqual(firstBlock.content.nodes[0].size, size);
  assert.ok(scenes[1].kind === 'sequence');
  assert.equal(scenes[1].nodes[1].x, scenes[1].nodes[0].x + 260 + 40);
  assert.equal(scenes[1].nodes[1].height, 60);
  assert.ok(scenes[1].edges[0].labelY > scenes[1].nodes[0].y + 100);
  assert.equal(scenes[1].lifelines[1].y1, scenes[1].nodes[1].y + 60);
});

test('invalid sizes and content that cannot fit are diagnosed without resizing', () => {
  for (const size of [{ width: 0, height: 88 }, { width: -1, height: 88 }, { width: NaN, height: 88 }, { width: 220, height: Infinity }, { width: 220 }]) {
    // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
    assert.throws(() => chart({ nodes: [{ ...appearance(a), size }], relations: [] }), hasCode('INVALID_SIZE'));
    // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
    assert.throws(() => sequence({ id: 'bad', title: '错误', participants: [{ ...participants[0], size }], steps: [relation] }), hasCode('INVALID_SIZE'));
  }
  // @ts-expect-error Deliberately invalid input also exercises the JavaScript runtime boundary.
  assert.throws(() => chart({ nodes: [{ ...appearance(a), size: undefined }], relations: [] }), hasCode('INVALID_OBJECT'));
  for (const size of [{ width: 32, height: 88 }, { width: 220, height: 20 }]) {
    assert.throws(() => compile(document().diagram(chart({ nodes: [{ ...appearance(a), size }], relations: [] }))), hasCode('NODE_CONTENT_FIT'));
  }
  assert.throws(() => compile(document().diagram(chart({ partitions: [{ id: 'small', label: '区域', position: { x: 0, y: 0 }, size: { width: 220, height: 88 } }], nodes: [appearance(a, 0, 0, 'small')], relations: [] }))), hasCode('PARTITION_CONTENT_FIT'));
});

test('single participant self calls keep labels and loops within the canvas', () => {
  const seq = sequence({ id: 'self', title: '内部处理', participants: [participants[0]], steps: [
    { id: 'call', from: a, to: a, label: '处理' },
    { id: 'return', from: a, to: a, label: '完成', replyTo: 'call' }
  ] });
  const scene = compile(document().diagram(seq)).scenes[0];
  assert.ok(scene.kind === 'sequence');
  for (const edge of scene.edges) {
    assert.ok(edge.labelX + edge.label.width <= scene.width);
    assert.ok(edge.points.every(([x]) => x <= scene.width));
  }
});

test('same entity can assume different local roles and positions', () => {
  const caller = role({ id: 'caller', label: '调用方' });
  const second = chart({ id: 'second', nodes: [{ ...appearance(a, 100, 50), role: caller }], relations: [] });
  const result = compile(document().diagram(chart()).diagram(second));
  assert.equal(result.semantic.entities.length, 2);
  assert.equal(result.scenes[0].nodes[0].role, 'worker');
  assert.equal(result.scenes[1].nodes[0].role, 'caller');
  assert.equal(result.scenes[1].nodes[0].x - result.scenes[0].nodes[0].x, 100);
});

test('missing endpoints are diagnosed together before layout', () => {
  const invalid = chart({ relations: [{ id: 'bad', from: 'missing-a', to: 'missing-b', label: '请求' }] });
  assert.throws(() => compile(document().diagram(invalid)), error => error instanceof DiagnosticError && error.diagnostics.filter(d => d.code === 'UNKNOWN_ENDPOINT').length === 2);
});

test('partition membership is validated while dependency cycles remain valid', () => {
  assert.throws(() => compile(document().diagram(chart({ nodes: [appearance(a, 0, 0, 'missing')], relations: [] }))), hasCode('UNKNOWN_PARTITION'));
  const zone: Partition = { id: 'zone', label: '区域', position: { x: 0, y: 0 }, size: { width: 640, height: 240 } };
  const grouped = { partitions: [zone], nodes: [appearance(a, 0, 0, 'zone'), appearance(b, 340, 0, 'zone')] };
  assert.throws(() => compile(document().diagram(chart({ ...grouped, partitions: [zone, zone] }))), hasCode('DUPLICATE_PARTITION'));
  assert.throws(() => compile(document().diagram(chart({ partitions: [zone] }))), hasCode('EMPTY_PARTITION'));
  assert.throws(() => compile(document().diagram(chart({ ...grouped, relations: [{ ...relation, to: 'zone' }] }))), hasCode('UNKNOWN_ENDPOINT'));
  // @ts-expect-error Entities cannot contain other entities.
  assert.throws(() => chart({ nodes: [{ ...appearance(a), parent: b }] }), hasCode('UNKNOWN_FIELD'));
  const scene = compile(document().diagram(chart({ ...grouped, relations: [relation, { id: 'back', from: b, to: a, label: '反馈' }] }))).scenes[0];
  assert.equal(scene.edges.length, 2);
  assert.notEqual(scene.edges[0].path, scene.edges[1].path);
});

test('partitions cannot overlap each other or ungrouped nodes', () => {
  const zone: Partition = { id: 'zone', label: '区域', position: { x: 0, y: 0 }, size: { width: 400, height: 240 } };
  assert.throws(() => compile(document().diagram(chart({ partitions: [zone], nodes: [appearance(a, 0, 0, 'zone'), appearance(b, 300)], relations: [] }))), hasCode('REGION_OVERLAP'));
  const second = { ...zone, id: 'second', position: { x: 380, y: 0 } };
  assert.throws(() => compile(document().diagram(chart({ partitions: [zone, second], nodes: [appearance(a, 0, 0, 'zone'), appearance(b, 0, 0, 'second')], relations: [] }))), hasCode('REGION_OVERLAP'));
});

test('duplicate diagrams, nodes and relations are rejected', () => {
  assert.throws(() => compile(document().diagram(chart()).diagram(chart())), hasCode('DUPLICATE_DIAGRAM'));
  assert.throws(() => compile(document().diagram(chart({ nodes: [...nodes, nodes[0]] }))), hasCode('DUPLICATE_NODE'));
  assert.throws(() => compile(document().diagram(chart({ relations: [relation, relation] }))), hasCode('DUPLICATE_RELATION'));
});

test('architecture uses orthogonal connections with labels directly beside their segments', () => {
  const scene = compile(document().diagram(overview)).scenes[0];
  for (const edge of scene.edges) {
    assert.ok(!('number' in edge));
    for (let i = 1; i < edge.points.length; i++) {
      assert.ok(edge.points[i - 1][0] === edge.points[i][0] || edge.points[i - 1][1] === edge.points[i][1]);
    }
    assert.ok(edge.points.slice(1).some((b, i) => {
      const a = edge.points[i];
      return a[1] === b[1]
        ? Math.min(Math.abs(edge.labelY - a[1]), Math.abs(edge.labelY + edge.label.height - a[1])) <= 10
        : Math.min(Math.abs(edge.labelX - a[0]), Math.abs(edge.labelX + edge.label.width - a[0])) <= 12;
    }));
  }
});

test('an execution bar begins on call arrival and ends on its return', () => {
  const scene = compile(document().diagram(timeline([relation, returned]))).scenes[0];
  assert.ok(scene.kind === 'sequence');
  const [call, response] = scene.edges;
  const [bar] = scene.activations;
  assert.equal(bar.callId, 'request');
  assert.equal(bar.entity, 'b');
  assert.equal(bar.y, call.arrivalY);
  assert.equal(bar.y + bar.height, response.lineY);
  assert.equal(call.points.at(-1)![0], bar.x);
  assert.equal(response.points[0][0], bar.x);
});

test('nested synchronous calls have lifetimes contained by the outer execution', () => {
  const steps = [relation,
    { id: 'inner', from: b, to: c, label: '调用 C' },
    { id: 'inner-result', from: c, to: b, label: '返回 C', replyTo: 'inner' },
    returned];
  const scene = compile(document().diagram(timeline(steps))).scenes[0];
  assert.ok(scene.kind === 'sequence');
  const [outer, inner] = scene.activations;
  assert.ok(outer.y < inner.y);
  assert.ok(outer.y + outer.height > inner.y + inner.height);
});

test('self calls create a separately offset execution bar', () => {
  const steps = [relation,
    { id: 'self', from: b, to: b, label: '内部执行' },
    { id: 'self-result', from: b, to: b, label: '内部返回', replyTo: 'self' },
    returned];
  const scene = compile(document().diagram(timeline(steps))).scenes[0];
  assert.ok(scene.kind === 'sequence');
  assert.equal(scene.activations[1].x, scene.activations[0].x + 7);
  assert.equal(scene.activations[1].y, scene.edges[1].arrivalY);
});

test('missing returns, blocked callers and incorrect return ordering are rejected', () => {
  assert.throws(() => compile(document().diagram(timeline([relation]))), hasCode('UNFINISHED_CALL'));
  assert.throws(() => compile(document().diagram(timeline([relation, { id: 'blocked', from: a, to: c, label: '提前调用' }]))), hasCode('CALL_WHILE_BLOCKED'));
  assert.throws(() => compile(document().diagram(timeline([relation, { id: 'inner', from: b, to: c, label: '内层' }, returned]))), hasCode('RETURN_ORDER'));
  assert.throws(() => compile(document().diagram(timeline([{ ...relation, replyTo: 'future' }]))), hasCode('UNKNOWN_REPLY'));
  assert.throws(() => compile(document().diagram(timeline([relation, { ...relation, id: 'wrong', replyTo: 'request' }]))), hasCode('REPLY_DIRECTION'));
});

test('mutually exclusive returns close branch-specific execution segments', () => {
  const scene = compile(document().diagram(generation)).scenes[0];
  assert.ok(scene.kind === 'sequence');
  const calls = scene.activations.filter(bar => bar.callId === 'submit');
  assert.equal(calls.length, 3);
  const success = scene.edges.find(edge => edge.id === 'built')!;
  const failure = scene.edges.find(edge => edge.id === 'diagnostic')!;
  assert.equal(calls[1].y + calls[1].height, success.lineY);
  assert.equal(calls[2].y + calls[2].height, failure.lineY);
  assert.ok(calls[2].y > calls[1].y + calls[1].height);
});

test('branches must converge on the same call state and cannot use sibling calls', () => {
  const mismatch: StepInput = { id: 'condition', kind: 'alternative', branches: [
    { label: '结束', steps: [returned] },
    { label: '未结束', steps: [{ id: 'work', from: b, to: b, label: '内部处理' }] }
  ] };
  assert.throws(() => compile(document().diagram(timeline([relation, mismatch]))), hasCode('BRANCH_EXECUTION_MISMATCH'));
  const sibling: StepInput = { id: 'condition', kind: 'alternative', branches: [
    { label: '调用', steps: [relation, returned] },
    { label: '另一分支', steps: [{ ...returned, id: 'sibling-return' }] }
  ] };
  assert.throws(() => compile(document().diagram(timeline([sibling]))), hasCode('UNKNOWN_REPLY'));
});

test('nested alternatives preserve the active outer call until a shared return', () => {
  const pair = (id: string): StepInput[] => [{ id, from: b, to: b, label: '处理' }, { id: `${id}-result`, from: b, to: b, label: '完成', replyTo: id }];
  const nested: StepInput = { id: 'nested', kind: 'alternative', branches: [
    { label: '有缓存', steps: pair('hit') }, { label: '无缓存', steps: pair('miss') }
  ] };
  const outer: StepInput = { id: 'outer', kind: 'alternative', branches: [
    { label: '允许', steps: [nested] }, { label: '拒绝', steps: pair('reject') }
  ] };
  const scene = compile(document().diagram(timeline([relation, outer, returned]))).scenes[0];
  assert.ok(scene.kind === 'sequence');
  assert.equal(scene.fragments.length, 2);
  assert.ok(scene.activations.every(bar => bar.height > 0 && bar.y + bar.height <= scene.height));
  assert.equal(scene.activations.filter(bar => bar.callId === 'request').at(-1)!.y + scene.activations.filter(bar => bar.callId === 'request').at(-1)!.height, scene.edges.at(-1)!.lineY);
});

test('capacity diagnostics preserve content instead of shrinking or truncating it', () => {
  const many = Array.from({ length: 13 }, (_, i) => appearance(entity({ id: `object-${i}`, label: `对象 ${i}` }), i * 340));
  assert.throws(() => compile(document().diagram(chart({ nodes: many, relations: [] }))), hasCode('NODE_CAPACITY'));
  const long = entity({ id: 'long', label: '过长的名称'.repeat(100) });
  assert.throws(() => compile(document().diagram(chart({ nodes: [appearance(long)], relations: [] }))), hasCode('LABEL_CAPACITY'));
  assert.throws(() => compile(document()), hasCode('EMPTY_DOCUMENT'));
});

test('Markdown supports structured text and escapes code', () => {
  const doc = document().markdown('# 标题\n\n一个 **重点**，一个 *强调* 与 `x < y`。\n\n3. 第三项\n4. 第四项\n\n```html\n<script>alert(1)</script>\n```');
  const html = render(doc);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /<em>强调<\/em>/);
  assert.match(html, /<ol start="3">/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('Markdown rejects unsafe links and raw HTML with source locations', () => {
  assert.throws(() => document().markdown('<div>内容</div>'), hasCode('MARKDOWN_HTML'));
  assert.throws(() => document().markdown('[点这里](javascript:alert)'), hasCode('MARKDOWN_LINK'));
  assert.throws(() => document().markdown('![图片](https://example.com/a.png)'), hasCode('MARKDOWN_IMAGE'));
  assert.throws(() => document().markdown('[点这里](jav&#x61;script:alert)'), hasCode('MARKDOWN_LINK'));
  assert.throws(() => document().markdown('[点这里][unsafe]\n\n[unsafe]: javascript:alert'), hasCode('MARKDOWN_LINK'));
  assert.throws(() => document().markdown('第一行\n\n> <script>坏内容</script>'), error => error instanceof DiagnosticError && error.diagnostics[0].path === 'blocks[0].markdown.line[3]');
  assert.throws(() => render(document().markdown('[未知](entity:missing)')), hasCode('UNKNOWN_REFERENCE'));
  assert.throws(() => document().markdown('[错误](entity:a:extra)'), hasCode('MARKDOWN_LINK'));
  assert.throws(() => document().markdown('[错误](ENTITY:a)'), hasCode('MARKDOWN_LINK'));
  assert.throws(() => document().markdown('第一块').markdown('<div>第二块</div>'), error => error instanceof DiagnosticError && error.diagnostics[0].path === 'blocks[1].markdown.line[1]');
});

test('Markdown parses nested formatting, references and escaped entities', () => {
  const html = render(document().markdown('标题\n====\n\n**加粗里的 _强调_**，``a ` b``，&lt;b&gt; 与 &amp;。\n\n[**引用**][page]\n\n[page]: https://example.com/a_(b) "说明"'));
  assert.match(html, /<h1[^>]*>标题<\/h1>/);
  assert.match(html, /<strong>加粗里的 <em>强调<\/em><\/strong>/);
  assert.match(html, /<code>a ` b<\/code>/);
  assert.match(html, /&lt;b&gt; 与 &amp;/);
  assert.doesNotMatch(html, /&amp;lt;/);
  assert.match(html, /href="https:\/\/example.com\/a_\(b\)" title="说明"><strong>引用<\/strong>/);
});

test('Markdown lists, quotes and code blocks preserve nested structure', () => {
  const html = render(document().markdown('- 一级\n  - 二级\n\n> 引用\n>\n> 第二段\n\n---\n\n~~~js\nconst x = 1;\n~~~\n\n```txt\n到文件末尾'));
  assert.match(html, /<ul><li>一级\n<ul><li>二级<\/li><\/ul><\/li><\/ul>/);
  assert.match(html, /<blockquote><p>引用<\/p>\n<p>第二段<\/p><\/blockquote>/);
  assert.match(html, /<hr>/);
  assert.match(html, /data-language="js">const x = 1;/);
  assert.match(html, /data-language="txt">到文件末尾/);
  assert.throws(() => render(document().markdown('> - [未知对象](entity:missing)')), hasCode('UNKNOWN_REFERENCE'));
});

test('untrusted node labels remain text and cannot introduce scripts', () => {
  const literal = entity({ id: 'literal', label: '<script>alert(1)</script>' });
  const html = render(document().diagram(chart({ nodes: [appearance(literal)], relations: [] })));
  assert.equal((html.match(/<script\b/g) ?? []).length, 1);
  assert.match(html, /&lt;script&gt;/);
  assert.throws(() => entity({ id: 'bad', label: '不可\u0000显示' }), hasCode('INVALID_TEXT'));
});

test('fixed text advances retain complete Unicode graphemes', () => {
  const text = '架构👩‍💻é';
  const result = wrap(text, 28, 'test');
  assert.equal(result.lines.join(''), text);
  assert.ok(result.lines.every(line => measure(line) <= 28));
  assert.ok(result.lines.some(line => line.includes('👩‍💻')));
});
