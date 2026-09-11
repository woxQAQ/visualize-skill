import test from "node:test";
import assert from "node:assert/strict";
import { architecture, compile, document, entity, role, swimlane } from "../src/index.ts";
import type { EdgeLayout, NodeLayout, Point, Relation, Scene } from "../src/model.ts";
import { agentFlow, agentOverview } from "./fixtures/agent-routing.ts";
import { overlaps } from "../src/layout/routing.ts";
import { expense } from "../examples/swimlane.ts";

const worker = role({ id: "worker", label: "处理者" });
const nodes = [
  { id: "center", x: 400, y: 320 },
  { id: "right", x: 750, y: 320 },
  { id: "bottom", x: 400, y: 600 },
  { id: "left", x: 50, y: 320 },
  { id: "top", x: 400, y: 40 },
  { id: "upper-right", x: 750, y: 40 },
  { id: "lower-right", x: 750, y: 600 },
].map(({ id, x, y }) => ({
  entity: entity({ id, label: id }),
  role: worker,
  position: { x, y },
  size: { width: 160, height: 80 },
}));

function sceneFor(kind: "architecture" | "swimlane", relations: Relation[]) {
  const options = { id: "ports", title: "连接点", nodes, relations };
  const chart =
    kind === "architecture"
      ? architecture(options)
      : swimlane({
          ...options,
          width: 1180,
          lanes: [{ id: "work", label: "处理", height: 800 }],
          nodes: nodes.map((node) => ({ ...node, lane: "work" })),
        });
  return compile(document().diagram(chart)).scenes[0];
}

function assertPort(node: NodeLayout, point: Point, neighbor: Point) {
  const cx = node.x + node.width / 2,
    cy = node.y + node.height / 2;
  const [x, y] = point,
    [nx, ny] = neighbor;
  assert.ok(
    (x === cx && y === node.y && nx === x && ny < y) ||
      (x === cx && y === node.y + node.height && nx === x && ny > y) ||
      (x === node.x && y === cy && ny === y && nx < x) ||
      (x === node.x + node.width && y === cy && ny === y && nx > x),
    `${node.id}: ${point} must meet a side midpoint perpendicularly from outside`,
  );
}

function assertRoutes(scene: Scene) {
  const boxes = new Map(scene.nodes.map((node) => [node.id, node]));
  for (const edge of scene.edges) {
    assertPort(boxes.get(edge.from)!, edge.points[0], edge.points[1]);
    assertPort(boxes.get(edge.to)!, edge.points.at(-1)!, edge.points.at(-2)!);
    for (let i = 1; i < edge.points.length; i++) {
      const [ax, ay] = edge.points[i - 1],
        [bx, by] = edge.points[i];
      assert.ok(ax === bx || ay === by);
      for (const node of scene.nodes) {
        const crosses =
          ax === bx
            ? ax > node.x &&
              ax < node.x + node.width &&
              Math.max(ay, by) > node.y &&
              Math.min(ay, by) < node.y + node.height
            : ay > node.y &&
              ay < node.y + node.height &&
              Math.max(ax, bx) > node.x &&
              Math.min(ax, bx) < node.x + node.width;
        assert.ok(!crosses, `${edge.id} crosses ${node.id}`);
      }
    }
  }
  const labels = scene.edges.map((edge) => ({
    x: edge.labelX,
    y: edge.labelY,
    width: edge.label.width,
    height: edge.label.height,
  }));
  for (const [index, label] of labels.entries()) {
    assert.ok(
      ![...scene.nodes, ...labels.slice(index + 1)].some((box) => overlaps(label, box)),
      `${scene.edges[index].id}: label overlaps content`,
    );
    for (const edge of scene.edges) {
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1],
          b = edge.points[i];
        const crosses =
          a[0] === b[0]
            ? a[0] > label.x &&
              a[0] < label.x + label.width &&
              Math.max(a[1], b[1]) > label.y &&
              Math.min(a[1], b[1]) < label.y + label.height
            : a[1] > label.y &&
              a[1] < label.y + label.height &&
              Math.max(a[0], b[0]) > label.x &&
              Math.min(a[0], b[0]) < label.x + label.width;
        assert.ok(!crosses, `${edge.id} crosses the label of ${scene.edges[index].id}`);
      }
    }
    const frames =
      scene.kind === "architecture"
        ? scene.partitions
        : scene.kind === "swimlane"
          ? scene.lanes
          : [];
    const left = label.x - 3,
      right = label.x + label.width + 3;
    const top = label.y - 2,
      bottom = label.y + label.height + 2;
    for (const frame of frames) {
      const horizontal =
        left < frame.x + frame.width &&
        right > frame.x &&
        [frame.y, frame.y + frame.height].some((y) => top < y + 0.5 && bottom > y - 0.5);
      const vertical =
        top < frame.y + frame.height &&
        bottom > frame.y &&
        [frame.x, frame.x + frame.width].some((x) => left < x + 0.5 && right > x - 0.5);
      assert.ok(
        !horizontal && !vertical,
        `${scene.edges[index].id}: label background covers the border of ${frame.id}`,
      );
    }
  }
}

function length(edge: EdgeLayout) {
  return edge.points
    .slice(1)
    .reduce(
      (sum, point, i) =>
        sum + Math.abs(point[0] - edge.points[i][0]) + Math.abs(point[1] - edge.points[i][1]),
      0,
    );
}

function assertNoLongSharedSegments(edges: EdgeLayout[]) {
  for (const [index, edge] of edges.entries()) {
    for (const other of edges.slice(index + 1)) {
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1],
          b = edge.points[i];
        for (let j = 1; j < other.points.length; j++) {
          const c = other.points[j - 1],
            d = other.points[j];
          let shared = 0;
          if (a[0] === b[0] && a[0] === c[0] && a[0] === d[0]) {
            shared =
              Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1])) -
              Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1]));
          } else if (a[1] === b[1] && a[1] === c[1] && a[1] === d[1]) {
            shared =
              Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) -
              Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0]));
          }
          assert.ok(
            shared <= 18,
            `${edge.id} and ${other.id} share ${shared}px beyond a midpoint lead`,
          );
        }
      }
    }
  }
}

test("package overview separates shared corridors and keeps the local Lane to Drive connection short", () => {
  const scene = compile(document().diagram(agentOverview)).scenes[0];
  assertRoutes(scene);
  assertNoLongSharedSegments(scene.edges);
  const local = scene.edges.find((edge) => edge.id === "lane-drive")!;
  assert.ok(
    length(local) <= 200,
    `adjacent nodes should not require ${length(local)}px of routing`,
  );
  assert.ok(
    local.label.lines.includes("accept"),
    "wrapping must keep the existing English word intact",
  );
  assert.ok(
    scene.edges.reduce((sum, edge) => sum + length(edge), 0) <= 5390,
    "removing overlaps must not increase total length in the overview",
  );
});

test("durable flow separates requests from their return paths within the declared lanes", () => {
  const scene = compile(document().diagram(agentFlow)).scenes[0];
  assert.equal(scene.kind, "swimlane");
  if (scene.kind !== "swimlane") return;
  assertRoutes(scene);
  assertNoLongSharedSegments(scene.edges);
  const left = scene.lanes[0].x + scene.lanes[0].headerWidth;
  for (const edge of scene.edges) {
    assert.ok(
      edge.points.every(
        ([x, y]) => x >= left && x <= scene.width - 32 && y >= 32 && y <= scene.height - 32,
      ),
    );
    assert.ok(edge.labelX - 3 >= left && edge.labelX + edge.label.width + 3 <= scene.width - 32);
    assert.ok(edge.labelY - 2 >= 32 && edge.labelY + edge.label.height + 2 <= scene.height - 32);
  }
});

test("cross-lane labels keep their backgrounds clear of swimlane separators", () => {
  const scene = compile(document().diagram(expense)).scenes[0];
  assertRoutes(scene);
  assert.equal(scene.edges.length, expense.relations.length);
});

test("relation declaration order does not change allocated routes or labels", () => {
  const forward = compile(document().diagram(agentOverview)).scenes[0];
  const { kind: _kind, ...options } = agentOverview;
  const reversed = architecture({ ...options, relations: [...options.relations].reverse() });
  const backward = compile(document().diagram(reversed)).scenes[0];
  for (const edge of forward.edges)
    assert.deepEqual(
      backward.edges.find((other) => other.id === edge.id),
      edge,
    );
  assert.deepEqual(
    backward.edges.map((edge) => edge.id),
    agentOverview.relations.map((edge) => edge.id).reverse(),
  );
});

for (const kind of ["architecture", "swimlane"] as const) {
  test(`${kind} shares four midpoint ports for many incoming or outgoing relations in either order`, () => {
    for (const incoming of [false, true]) {
      const relations = nodes.slice(1).map(({ entity }) => ({
        id: `link-${entity.id}`,
        from: incoming ? entity.id : "center",
        to: incoming ? "center" : entity.id,
        label: entity.label,
      }));
      for (const ordered of [relations, [...relations].reverse()]) {
        const scene = sceneFor(kind, ordered);
        assertRoutes(scene);
        const ports = new Set(
          scene.edges.map((edge) => JSON.stringify(incoming ? edge.points.at(-1) : edge.points[0])),
        );
        assert.ok(ports.size <= 4);
        assert.equal(scene.edges.length, 6);
      }
    }
  });

  test(`${kind} keeps self loops, parallel and reverse relations distinct using midpoint ports`, () => {
    const relations = [
      { id: "first", from: "left", to: "right", label: "首次" },
      { id: "second", from: "left", to: "right", label: "再次" },
      { id: "back", from: "right", to: "left", label: "返回" },
      { id: "self", from: "center", to: "center", label: "重试" },
    ];
    const scene = sceneFor(kind, relations);
    assertRoutes(scene);
    const paths = scene.edges.map((edge) => {
      const forward = JSON.stringify(edge.points),
        backward = JSON.stringify([...edge.points].reverse());
      return forward < backward ? forward : backward;
    });
    assert.equal(new Set(paths).size, relations.length);
    const loop = scene.edges.at(-1)!;
    assert.notDeepEqual(loop.points[0], loop.points.at(-1));
    assert.deepEqual(sceneFor(kind, relations), scene);
  });
}
