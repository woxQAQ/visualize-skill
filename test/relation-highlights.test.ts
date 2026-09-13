import test from "node:test";
import assert from "node:assert/strict";
import { architecture, compile, entity, render, role, swimlane } from "../src/index.ts";
import { overview } from "../examples/architecture.ts";
import { generation } from "../examples/sequence.ts";
import { expense } from "../examples/swimlane.ts";

function highlights(html: string) {
  return [...html.matchAll(/([^\n]+) \[data-relation="([^"]+)"\] \{([^}]+)\}/g)].map(
    ([, selector, id, declarations]) => ({
      selector: selector.trim(),
      id,
      declarations,
      endpoints: [...selector.matchAll(/\[data-entity="([^"]+)"\]/g)].map((match) => match[1]),
    }),
  );
}

function nodeHighlights(html: string) {
  return [...html.matchAll(/([^\n]+) \[data-entity="([^"]+)"\] \{([^}]+)\}/g)].map(
    ([, selector, id, declarations]) => ({
      selector: selector.trim(),
      id,
      declarations,
      triggers: [...selector.matchAll(/\[data-entity="([^"]+)"\]/g)].map((match) => match[1]),
    }),
  );
}

test("node emphasis includes direct neighbors without propagating through the graph", () => {
  const cases = [
    { chart: overview, active: "sdk", visible: ["skill", "sdk", "coordinator"] },
    { chart: generation, active: "renderer", visible: ["coordinator", "renderer"] },
    { chart: expense, active: "approve", visible: ["submit", "revise", "approve", "pay"] },
  ];
  for (const { chart, active, visible } of cases) {
    const html = render(chart);
    const rules = nodeHighlights(html);
    assert.deepEqual(
      rules.filter((rule) => rule.triggers.includes(active)).map((rule) => rule.id),
      visible,
    );
    for (const rule of rules) {
      assert.equal(new Set(rule.triggers).size, rule.triggers.length);
      assert.ok(rule.triggers.includes(rule.id));
      assert.ok(rule.selector.startsWith(`#diagram-${chart.id} svg:has(`));
      assert.match(rule.declarations, /opacity:1/);
      assert.match(
        rule.declarations,
        /--node-elevation:drop-shadow\(0 3px 4px var\(--node-shadow-color\)\)/,
      );
    }
    assert.ok(
      html.includes(
        `#diagram-${chart.id} svg:has(.node-link:is(:hover,:focus-visible),[data-relation-hit]:hover,[data-relation-label]:hover) :is([data-entity],[data-relation],[data-relation-label]) { opacity:0.45; }`,
      ),
    );
  }
});

test("isolated nodes still emphasize themselves and dim other nodes without any relations", () => {
  const chart = architecture({
    id: "isolated-nodes",
    title: "独立节点",
    nodes: ["first", "second"].map((id, index) => ({
      entity: entity({ id, label: id }),
      role: role({ id: "component", label: "组件" }),
      position: { x: index * 240, y: 0 },
      size: { width: 160, height: 80 },
    })),
    relations: [],
  });
  const html = render(chart);
  assert.deepEqual(
    nodeHighlights(html).map(({ id, triggers }) => ({ id, triggers })),
    [
      { id: "first", triggers: ["first"] },
      { id: "second", triggers: ["second"] },
    ],
  );
  assert.equal(highlights(html).length, 0);
});

test("hovering a relation or its label emphasizes only that relation and its endpoints", () => {
  for (const chart of [overview, generation, expense]) {
    const html = render(chart);
    const nodes = nodeHighlights(html);
    const relations = highlights(html);
    for (const edge of compile(chart).scene.edges) {
      for (const attribute of ["data-relation-hit", "data-relation-label"]) {
        const trigger = `[${attribute}="${edge.id}"]`;
        assert.deepEqual(
          nodes
            .filter((rule) => rule.selector.includes(trigger))
            .map((rule) => rule.id)
            .sort(),
          [...new Set([edge.from, edge.to])].sort(),
        );
        assert.deepEqual(
          relations.filter((rule) => rule.selector.includes(trigger)).map((rule) => rule.id),
          [edge.id],
        );
      }
      const hit = html.match(new RegExp(`<path data-relation-hit="${edge.id}"[^>]+>`))![0];
      assert.ok(hit.includes(`d="${edge.path}"`));
      assert.match(hit, /stroke="transparent" stroke-width="12"/);
      assert.match(hit, /vector-effect="non-scaling-stroke" pointer-events="stroke"/);
      assert.ok(html.indexOf(hit) < html.indexOf('<g id="entity-'));
    }
  }
});

test("every diagram colors relations by their source and highlights them from either endpoint", () => {
  const cases = [
    {
      chart: overview,
      relations: { guides: ["skill", "sdk"], checks: ["coordinator", "validator"] },
    },
    {
      chart: generation,
      relations: {
        check: ["coordinator", "validator"],
        checked: ["validator", "coordinator"],
        diagnostic: ["coordinator", "sdk"],
      },
    },
    {
      chart: expense,
      relations: {
        "request-review": ["submit", "approve"],
        "request-changes": ["approve", "revise"],
        resubmit: ["revise", "approve"],
      },
    },
  ];
  for (const { chart, relations } of cases) {
    const html = render(chart);
    const rules = highlights(html);
    const paths = [...html.matchAll(/<path data-relation="([^"]+)"/g)].map((match) => match[1]);
    assert.deepEqual(
      rules.map((rule) => rule.id),
      paths,
    );
    for (const [id, endpoints] of Object.entries(relations)) {
      const rule = rules.find((rule) => rule.id === id)!;
      assert.ok(rule);
      assert.deepEqual(rule.endpoints, endpoints);
      assert.ok(rule.selector.startsWith(`#diagram-${chart.id} svg:has(`));
      assert.equal(
        (rule.selector.match(/:is\(:hover,:focus-visible\)/g) ?? []).length,
        endpoints.length,
      );
      assert.match(rule.declarations, /stroke-width:2.5/);
      assert.doesNotMatch(rule.declarations, /\bstroke:/);
      assert.match(rule.declarations, /opacity:1/);
      assert.ok(html.includes(`${rule.selector} [data-relation-label="${id}"] { opacity:1; }`));
      assert.ok(
        html.includes(`${rule.selector} [data-relation-label="${id}"] text { font-weight:600; }`),
      );
      assert.ok(html.includes(`<g data-relation-label="${id}">`));
    }
    const nodeColors = new Map(
      [
        ...html.matchAll(
          /<g[^>]*data-entity="([^"]+)"[^]*?<rect class="node-surface"[^>]*stroke="([^"]+)"/g,
        ),
      ].map(([, id, color]) => [id, color]),
    );
    for (const edge of compile(chart).scene.edges) {
      const color = nodeColors.get(edge.from)!;
      assert.ok(color);
      const path = html.match(new RegExp(`<path data-relation="${edge.id}"[^>]+>`))![0];
      const label = html.match(new RegExp(`<g data-relation-label="${edge.id}"[^]*?</g>`))![0];
      assert.ok(path.includes(`stroke="${color}"`));
      for (const [, fill] of label.matchAll(/<text[^>]*fill="([^"]+)"/g)) assert.equal(fill, color);
    }
    assert.match(html, /<style>@media screen \{/);
    assert.equal((html.match(/<script\b/g) ?? []).length, 1);
  }
});

test("sequence self calls and returns retain their arrow and dashed-line semantics when highlighted", () => {
  const html = render(generation);
  const rules = highlights(html);
  const self = rules.find((rule) => rule.id === "assemble-properties")!;
  assert.deepEqual(self.endpoints, ["renderer"]);
  assert.match(self.declarations, /marker-end:url\(#arrow-generation-sequence\)/);
  const reply = rules.find((rule) => rule.id === "properties-ready")!;
  assert.deepEqual(reply.endpoints, ["renderer"]);
  assert.match(reply.declarations, /marker-end:url\(#highlight-return-arrow-generation-sequence\)/);
  assert.match(
    html,
    /<path data-relation="properties-ready"[^>]*stroke-dasharray="5 4"[^>]*marker-end="url\(#return-arrow-generation-sequence\)"/,
  );
  assert.match(
    html,
    /<marker id="highlight-return-arrow-generation-sequence"[^>]*>\s*<path[^>]*fill="none" stroke="context-stroke"/,
  );
  assert.ok(rules.every((rule) => !rule.declarations.includes("stroke-dasharray")));
});

test("return arrow geometry is fixed, padded and continuously connected in both highlight states", () => {
  const html = render(generation);
  const markers = new Map(
    [...html.matchAll(/<marker id="([^"]+)"([^]*?)<\/marker>/g)].map(([, id, content]) => [
      id,
      content,
    ]),
  );
  const readAttribute = (content: string, name: string) =>
    content.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];
  const normal = markers.get("return-arrow-generation-sequence")!;
  const highlighted = markers.get("highlight-return-arrow-generation-sequence")!;
  for (const content of markers.values())
    assert.equal(readAttribute(content, "markerUnits"), "userSpaceOnUse");
  for (const attribute of ["markerWidth", "markerHeight", "viewBox", "refX", "refY", "d"]) {
    assert.equal(readAttribute(normal, attribute), readAttribute(highlighted, attribute));
  }
  for (const content of [normal, highlighted]) {
    const [x, y, width, height] = readAttribute(content, "viewBox")!.split(" ").map(Number);
    const halfStroke = Number(readAttribute(content, "stroke-width")) / 2;
    assert.ok(x <= -halfStroke && y <= -halfStroke);
    assert.ok(x + width >= 10.5 + halfStroke && y + height >= 12 + halfStroke);
    assert.equal(readAttribute(content, "stroke-linejoin"), "round");
    assert.equal(readAttribute(content, "stroke-dasharray"), "none");
    assert.equal(readAttribute(content, "refX"), "10.5");
    assert.equal(readAttribute(content, "refY"), "6");
    assert.match(readAttribute(content, "d")!, /M 0 6 H 10\.5$/);
  }
  assert.equal(readAttribute(normal, "stroke-width"), "1.5");
  assert.equal(readAttribute(highlighted, "stroke-width"), "2.5");
});

test("highlight selectors remain local when charts reuse entities and relation identifiers", () => {
  const copy = swimlane({
    id: "another-flow",
    title: expense.title,
    width: expense.width,
    headerWidth: expense.headerWidth,
    lanes: expense.lanes,
    nodes: expense.nodes,
    relations: expense.relations,
  });
  const html = [render(expense), render(copy)].join("\n");
  const figures = [...html.matchAll(/<figure id="diagram-([^"]+)"[^]*?<\/figure>/g)];
  assert.equal(figures.length, 2);
  for (const [figure, id] of figures) {
    const rules = highlights(figure);
    assert.ok(
      nodeHighlights(figure).every((rule) => rule.selector.startsWith(`#diagram-${id} svg:has(`)),
    );
    assert.equal(rules.length, 5);
    assert.ok(rules.every((rule) => rule.selector.startsWith(`#diagram-${id} svg:has(`)));
    const markerIds = new Set(
      [...figure.matchAll(/<marker id="([^"]+)"/g)].map((match) => match[1]),
    );
    for (const [, marker] of figure.matchAll(/url\(#([^)]+)\)/g)) assert.ok(markerIds.has(marker));
    const incoming = rules
      .filter((rule) => rule.endpoints.includes("approve"))
      .map((rule) => rule.id);
    assert.deepEqual(incoming, ["request-review", "request-changes", "resubmit", "approved"]);
    assert.ok(!incoming.includes("paid"));
  }
});
