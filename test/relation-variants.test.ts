import test from "node:test";
import assert from "node:assert/strict";
import {
  architecture,
  compile,
  DiagnosticError,
  entity,
  render,
  role,
  sequence,
  swimlane,
} from "../src/index.ts";
import type { RelationVariant } from "../src/index.ts";

const caller = entity({ id: "caller", label: "调用方" });
const service = entity({ id: "service", label: "服务" });
const component = role({ id: "component", label: "组件" });
const nodes = [caller, service].map((entity, index) => ({
  entity,
  role: component,
  size: { width: 180, height: 72 },
  position: { x: index * 400, y: 0 },
}));
const variants = ["default", "emphasis", "security", "dashed", "external"] as const;
const presets = {
  default: { color: 1, width: 1.5, dash: "none", weight: 400 },
  emphasis: { color: 5, width: 2.5, dash: "none", weight: 600 },
  security: { color: 2, width: 1.5, dash: "none", weight: 400 },
  dashed: { color: 1, width: 1.5, dash: "5 4", weight: 400 },
  external: { color: 3, width: 1.5, dash: "8 3 2 3", weight: 400 },
};

function chart(kind: "architecture" | "sequence" | "swimlane", variant?: RelationVariant) {
  const request = { id: "request", from: caller, to: service, label: "请求", variant };
  const base = { id: "variants", title: "关系样式" };
  if (kind === "sequence")
    return sequence({
      ...base,
      participants: nodes.map(({ entity, role, size }) => ({ entity, role, size })),
      steps: [
        request,
        { id: "response", from: service, to: caller, label: "响应", replyTo: "request", variant },
      ],
    });
  if (kind === "swimlane")
    return swimlane({
      ...base,
      width: 800,
      lanes: [{ id: "work", label: "处理", height: 180 }],
      nodes: nodes.map((node) => ({ ...node, lane: "work" })),
      relations: [request],
    });
  return architecture({ ...base, nodes, relations: [request] });
}

const path = (html: string, id: string) =>
  html.match(new RegExp(`<path data-relation="${id}"[^>]+>`))![0];
const attr = (markup: string, name: string) =>
  markup.match(new RegExp(`\\b${name}="([^"]+)"`))?.[1];

test("relation presets survive normalization and layout in all diagram types", () => {
  for (const kind of ["architecture", "sequence", "swimlane"] as const) {
    assert.deepEqual(compile(chart(kind)), compile(chart(kind, "default")));
    for (const variant of variants) {
      const diagram = chart(kind, variant);
      const { semantic, scene } = compile(diagram);
      const relations =
        semantic.chart.kind === "sequence" ? semantic.chart.steps : semantic.chart.relations;
      for (const relation of relations) {
        assert.ok("variant" in relation);
        assert.equal(relation.variant, variant);
        assert.ok(Object.isFrozen(relation));
      }
      assert.ok(scene.edges.every((edge) => edge.variant === variant));
      const html = render(diagram);
      const preset = presets[variant];
      for (const edge of scene.edges) {
        const markup = path(html, edge.id);
        assert.equal(attr(markup, "stroke"), `var(--viz-series-${preset.color})`);
        assert.equal(attr(markup, "stroke-width"), String(preset.width));
        assert.equal(attr(markup, "stroke-dasharray"), edge.returning ? "5 4" : preset.dash);
        const label = html.match(new RegExp(`<g data-relation-label="${edge.id}">[^]*?</g>`))![0];
        assert.equal(attr(label, "font-weight"), String(preset.weight));
        assert.equal(
          label.match(/<text[^>]*fill="([^"]+)"/)![1],
          `var(--viz-series-${preset.color})`,
        );
        const highlight = html.match(
          new RegExp(`\\[data-relation="${edge.id}"\\] \\{([^}]+)\\}`),
        )![1];
        assert.ok(highlight.includes(`stroke-width:${preset.width + 1}`));
        assert.ok(!highlight.includes("stroke-dasharray"));
        assert.ok(!highlight.includes("stroke:"));
      }
    }
  }
});

test("dashed and external calls remain calls while return arrows retain their semantic shape", () => {
  for (const variant of variants) {
    const { scene } = compile(chart("sequence", variant));
    assert.equal(scene.kind, "sequence");
    if (scene.kind !== "sequence") return;
    assert.equal(scene.activations.length, 1);
    assert.equal(scene.edges[0].returning, false);
    assert.equal(scene.edges[1].returning, true);
    const html = render(chart("sequence", variant));
    assert.equal(attr(path(html, "request"), "marker-end"), "url(#arrow-variants)");
    const width = presets[variant].width;
    assert.equal(
      attr(path(html, "response"), "marker-end"),
      `url(#return-arrow-variants-${width})`,
    );
    for (const stroke of [width, width + 1]) {
      const marker = html.match(
        new RegExp(`<marker id="return-arrow-variants-${stroke}"[^]*?</marker>`),
      )![0];
      assert.match(marker, /fill="none" stroke="context-stroke"/);
      assert.equal(attr(marker, "stroke-width"), String(stroke));
      assert.equal(attr(marker, "markerUnits"), "userSpaceOnUse");
    }
  }
});

test("invalid relation variants fail with a field-specific diagnostic", () => {
  for (const kind of ["architecture", "sequence", "swimlane"] as const) {
    for (const invalid of ["", "unknown", "__proto__", "constructor", "red", null, 1, {}]) {
      assert.throws(
        () => chart(kind, invalid as RelationVariant),
        (error: unknown) =>
          error instanceof DiagnosticError &&
          error.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "INVALID_RELATION_VARIANT" &&
              diagnostic.path ===
                `${kind}.${kind === "sequence" ? "steps" : "relations"}[0].variant`,
          ),
      );
    }
  }
});

test("branch messages accept independent presets without changing reply pairing", () => {
  const diagram = sequence({
    id: "branches",
    title: "条件返回",
    participants: nodes.map(({ entity, role, size }) => ({ entity, role, size })),
    steps: [
      { id: "request", from: caller, to: service, label: "授权", variant: "security" },
      {
        id: "result",
        kind: "alternative",
        branches: [
          {
            label: "允许",
            steps: [
              {
                id: "allowed",
                from: service,
                to: caller,
                label: "通过",
                replyTo: "request",
                variant: "emphasis",
              },
            ],
          },
          {
            label: "拒绝",
            steps: [
              {
                id: "denied",
                from: service,
                to: caller,
                label: "拒绝",
                replyTo: "request",
                variant: "external",
              },
            ],
          },
        ],
      },
    ],
  });
  assert.deepEqual(
    compile(diagram).scene.edges.map(({ variant }) => variant),
    ["security", "emphasis", "external"],
  );
  const html = render(diagram);
  assert.equal(attr(path(html, "allowed"), "stroke-dasharray"), "5 4");
  assert.equal(attr(path(html, "denied"), "stroke-dasharray"), "5 4");
});
