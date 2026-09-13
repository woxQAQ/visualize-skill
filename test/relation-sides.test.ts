import test from "node:test";
import assert from "node:assert/strict";
import {
  architecture,
  compile,
  DiagnosticError,
  entity,
  role,
  sequence,
  swimlane,
} from "../src/index.ts";
import type { NodeLayout, Point, RelationInput, RelationSide, StepInput } from "../src/model.ts";

const component = role({ id: "component", label: "组件" });
const nodes = [
  { id: "a", x: 120, y: 120 },
  { id: "b", x: 580, y: 340 },
].map(({ id, x, y }) => ({
  entity: entity({ id, label: id }),
  role: component,
  position: { x, y },
  size: { width: 160, height: 80 },
}));
const request = { id: "request", from: "a", to: "b", label: "请求" };
const sides: RelationSide[] = ["top", "right", "bottom", "left"];

function chart(
  kind: "architecture" | "swimlane",
  relations: readonly RelationInput[],
  appearances = nodes,
) {
  const base = { id: "sides", title: "连接边", relations };
  return kind === "architecture"
    ? architecture({ ...base, nodes: appearances })
    : swimlane({
        ...base,
        width: 1150,
        headerWidth: 80,
        lanes: [{ id: "work", label: "处理", height: 850 }],
        nodes: appearances.map((node) => ({ ...node, lane: "work" })),
      });
}

function assertSide(node: NodeLayout, point: Point, outside: Point, side: RelationSide) {
  const ports: Record<RelationSide, Point> = {
    top: [node.x + node.width / 2, node.y],
    right: [node.x + node.width, node.y + node.height / 2],
    bottom: [node.x + node.width / 2, node.y + node.height],
    left: [node.x, node.y + node.height / 2],
  };
  assert.deepEqual(point, ports[side]);
  const horizontal = side === "left" || side === "right";
  const axis = horizontal ? 0 : 1;
  assert.equal(outside[horizontal ? 1 : 0], point[horizontal ? 1 : 0]);
  assert.ok((outside[axis] - point[axis]) * (side === "top" || side === "left" ? -1 : 1) > 0);
}

for (const kind of ["architecture", "swimlane"] as const) {
  test(`${kind} honors every pair of declared sides without moving nodes`, () => {
    const baseline = compile(chart(kind, [request])).scene;
    for (const fromSide of sides)
      for (const toSide of sides) {
        const diagram = chart(kind, [{ ...request, fromSide, toSide }]);
        const { semantic, scene } = compile(diagram);
        assert.deepEqual(scene.nodes, baseline.nodes);
        const edge = scene.edges[0];
        assertSide(scene.nodes[0], edge.points[0], edge.points[1], fromSide);
        assertSide(scene.nodes[1], edge.points.at(-1)!, edge.points.at(-2)!, toSide);
        assert.equal(edge.fromSide, fromSide);
        assert.equal(edge.toSide, toSide);
        assert.ok(semantic.chart.kind !== "sequence");
        assert.equal(semantic.chart.relations[0].fromSide, fromSide);
        assert.equal(semantic.chart.relations[0].toSide, toSide);
        assert.ok(Object.isFrozen(semantic.chart.relations[0]));
      }
  });

  test(`${kind} chooses unspecified ends automatically and preserves omitted fields`, () => {
    const automatic = compile(chart(kind, [request]));
    assert.deepEqual(
      compile(chart(kind, [{ ...request, fromSide: undefined, toSide: undefined }])),
      automatic,
    );
    assert.ok(!("fromSide" in automatic.scene.edges[0]));
    assert.ok(!("toSide" in automatic.scene.edges[0]));
    for (const side of sides) {
      for (const field of ["fromSide", "toSide"] as const) {
        const { scene } = compile(chart(kind, [{ ...request, [field]: side }]));
        const edge = scene.edges[0];
        if (field === "fromSide") {
          assertSide(scene.nodes[0], edge.points[0], edge.points[1], side);
          assert.ok(!("toSide" in edge));
        } else {
          assertSide(scene.nodes[1], edge.points.at(-1)!, edge.points.at(-2)!, side);
          assert.ok(!("fromSide" in edge));
        }
      }
    }
  });

  test(`${kind} reports blocked declared sides instead of silently choosing another port`, () => {
    const blocked = [
      ...nodes,
      {
        entity: entity({ id: "blocker", label: "阻挡" }),
        role: component,
        position: { x: 292, y: 120 },
        size: { width: 160, height: 80 },
      },
    ];
    assert.doesNotThrow(() => compile(chart(kind, [request], blocked)));
    for (const relation of [
      { ...request, fromSide: "right" as const },
      { ...request, from: "b", to: "a", toSide: "right" as const },
    ]) {
      assert.throws(
        () => compile(chart(kind, [relation], blocked)),
        (error: unknown) =>
          error instanceof DiagnosticError &&
          error.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === "RELATION_LAYOUT" &&
              diagnostic.path.endsWith("relations.request") &&
              diagnostic.message.includes("Side=right") &&
              diagnostic.hint.includes("fromSide、toSide"),
          ),
      );
    }
  });

  test(`${kind} keeps side constraints while allocating parallel, reverse and self relations`, () => {
    const relations: RelationInput[] = [
      { ...request, id: "automatic" },
      { ...request, fromSide: "right", toSide: "left" },
      { ...request, id: "parallel", label: "再次", fromSide: "right", toSide: "left" },
      { ...request, id: "back", from: "b", to: "a", fromSide: "top", toSide: "top" },
      { id: "self", from: "a", to: "a", label: "重试", fromSide: "left", toSide: "top" },
    ];
    const first = compile(chart(kind, relations)).scene;
    const reversed = compile(chart(kind, [...relations].reverse())).scene;
    for (const edge of first.edges) {
      assert.deepEqual(
        reversed.edges.find((other) => other.id === edge.id),
        edge,
      );
      const from = first.nodes.find((node) => node.id === edge.from)!;
      const to = first.nodes.find((node) => node.id === edge.to)!;
      if (edge.fromSide) assertSide(from, edge.points[0], edge.points[1], edge.fromSide);
      if (edge.toSide) assertSide(to, edge.points.at(-1)!, edge.points.at(-2)!, edge.toSide);
    }
    assert.throws(
      () => chart(kind, [{ ...request, to: "a", fromSide: "right", toSide: "right" }]),
      (error: unknown) =>
        error instanceof DiagnosticError && error.diagnostics[0].code === "RELATION_SIDE_CONFLICT",
    );
  });
}

test("connection sides reject invalid names and remain unavailable to sequence messages", () => {
  for (const field of ["fromSide", "toSide"] as const) {
    for (const kind of ["architecture", "swimlane"] as const) {
      for (const invalid of ["auto", "up", "", null, 1, {}, "__proto__"]) {
        assert.throws(
          () => chart(kind, [{ ...request, [field]: invalid } as RelationInput]),
          (error: unknown) =>
            error instanceof DiagnosticError &&
            error.diagnostics[0].code === "INVALID_RELATION_SIDE" &&
            error.diagnostics[0].path === `${kind}.relations[0].${field}`,
        );
      }
    }
    assert.throws(
      () =>
        sequence({
          id: "sequence",
          title: "时序",
          participants: nodes.map(({ entity, role, size }) => ({ entity, role, size })),
          steps: [{ ...request, [field]: "right" } as StepInput],
        }),
      (error: unknown) =>
        error instanceof DiagnosticError &&
        error.diagnostics[0].code === "UNKNOWN_FIELD" &&
        error.diagnostics[0].path === `sequence.steps[0].${field}`,
    );
  }
});
