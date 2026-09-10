import test from 'node:test';
import assert from 'node:assert/strict';
import { document, render, swimlane } from '../src/index.ts';
import { overview, generation } from '../examples/self-explanation.ts';
import { expense } from '../examples/swimlane.ts';

function highlights(html: string) {
  return [...html.matchAll(/([^\n]+) \[data-relation="([^"]+)"\] \{([^}]+)\}/g)].map(([, selector, id, declarations]) => ({
    selector: selector.trim(), id, declarations,
    endpoints: [...selector.matchAll(/\[data-entity="([^"]+)"\]/g)].map(match => match[1])
  }));
}

test('every diagram highlights direct incoming and outgoing relations from either endpoint', () => {
  const cases = [
    { chart: overview, relations: { guides: ['skill', 'sdk'], checks: ['coordinator', 'validator'] } },
    { chart: generation, relations: { check: ['coordinator', 'validator'], checked: ['validator', 'coordinator'], diagnostic: ['coordinator', 'sdk'] } },
    { chart: expense, relations: { 'request-review': ['submit', 'approve'], 'request-changes': ['approve', 'revise'], resubmit: ['revise', 'approve'] } }
  ];
  for (const { chart, relations } of cases) {
    const html = render(document().diagram(chart));
    const rules = highlights(html);
    const paths = [...html.matchAll(/<path data-relation="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(rules.map(rule => rule.id), paths);
    for (const [id, endpoints] of Object.entries(relations)) {
      const rule = rules.find(rule => rule.id === id)!;
      assert.ok(rule);
      assert.deepEqual(rule.endpoints, endpoints);
      assert.ok(rule.selector.startsWith(`#diagram-${chart.id} svg:has(`));
      assert.equal((rule.selector.match(/:is\(:hover,:focus-visible\)/g) ?? []).length, endpoints.length);
      assert.match(rule.declarations, /stroke:#285c88;stroke-width:2.5/);
      assert.ok(html.includes(`${rule.selector} [data-relation-label="${id}"] text { fill:#285c88;font-weight:600; }`));
      assert.ok(html.includes(`<g data-relation-label="${id}">`));
    }
    assert.match(html, /<style>@media screen \{/);
    assert.equal((html.match(/<script\b/g) ?? []).length, 1);
  }
});

test('sequence self calls and returns retain their arrow and dashed-line semantics when highlighted', () => {
  const html = render(document().diagram(generation));
  const rules = highlights(html);
  const self = rules.find(rule => rule.id === 'assemble-properties')!;
  assert.deepEqual(self.endpoints, ['renderer']);
  assert.match(self.declarations, /marker-end:url\(#highlight-arrow-generation-sequence\)/);
  const reply = rules.find(rule => rule.id === 'properties-ready')!;
  assert.deepEqual(reply.endpoints, ['renderer']);
  assert.match(reply.declarations, /marker-end:url\(#highlight-return-arrow-generation-sequence\)/);
  assert.match(html, /<path data-relation="properties-ready"[^>]*stroke-dasharray="5 4"[^>]*marker-end="url\(#return-arrow-generation-sequence\)"/);
  assert.match(html, /<marker id="highlight-return-arrow-generation-sequence"[^>]*>\s*<path[^>]*fill="none" stroke="#285c88"/);
  assert.ok(rules.every(rule => !rule.declarations.includes('stroke-dasharray')));
});

test('return arrow geometry is fixed, padded and continuously connected in both highlight states', () => {
  const html = render(document().diagram(generation));
  const markers = new Map([...html.matchAll(/<marker id="([^"]+)"([^]*?)<\/marker>/g)].map(([, id, content]) => [id, content]));
  const readAttribute = (content: string, name: string) => content.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  const normal = markers.get('return-arrow-generation-sequence')!;
  const highlighted = markers.get('highlight-return-arrow-generation-sequence')!;
  for (const content of markers.values()) assert.equal(readAttribute(content, 'markerUnits'), 'userSpaceOnUse');
  for (const attribute of ['markerWidth', 'markerHeight', 'viewBox', 'refX', 'refY', 'd']) {
    assert.equal(readAttribute(normal, attribute), readAttribute(highlighted, attribute));
  }
  for (const content of [normal, highlighted]) {
    const [x, y, width, height] = readAttribute(content, 'viewBox')!.split(' ').map(Number);
    const halfStroke = Number(readAttribute(content, 'stroke-width')) / 2;
    assert.ok(x <= -halfStroke && y <= -halfStroke);
    assert.ok(x + width >= 10.5 + halfStroke && y + height >= 12 + halfStroke);
    assert.equal(readAttribute(content, 'stroke-linejoin'), 'round');
    assert.equal(readAttribute(content, 'stroke-dasharray'), 'none');
    assert.equal(readAttribute(content, 'refX'), '10.5');
    assert.equal(readAttribute(content, 'refY'), '6');
    assert.match(readAttribute(content, 'd')!, /M 0 6 H 10\.5$/);
  }
  assert.equal(readAttribute(normal, 'stroke-width'), '1.5');
  assert.equal(readAttribute(highlighted, 'stroke-width'), '2.5');
});

test('highlight selectors remain local when charts reuse entities and relation identifiers', () => {
  const copy = swimlane({
    id: 'another-flow', title: expense.title, width: expense.width, headerWidth: expense.headerWidth,
    lanes: expense.lanes, nodes: expense.nodes, relations: expense.relations
  });
  const html = render(document().diagram(expense).diagram(copy));
  const figures = [...html.matchAll(/<figure id="diagram-([^"]+)"[^]*?<\/figure>/g)];
  assert.equal(figures.length, 2);
  for (const [figure, id] of figures) {
    const rules = highlights(figure);
    assert.equal(rules.length, 5);
    assert.ok(rules.every(rule => rule.selector.startsWith(`#diagram-${id} svg:has(`)));
    const markerIds = new Set([...figure.matchAll(/<marker id="([^"]+)"/g)].map(match => match[1]));
    for (const [, marker] of figure.matchAll(/url\(#([^)]+)\)/g)) assert.ok(markerIds.has(marker));
    const incoming = rules.filter(rule => rule.endpoints.includes('approve')).map(rule => rule.id);
    assert.deepEqual(incoming, ['request-review', 'request-changes', 'resubmit', 'approved']);
    assert.ok(!incoming.includes('paid'));
  }
});
