import test from "node:test";
import assert from "node:assert/strict";
import {
  architecture,
  compile,
  DiagnosticError,
  entity,
  render,
  role,
  swimlane,
} from "../src/index.ts";
import type { SwimlaneOptions } from "../src/index.ts";
import { expense } from "../examples/swimlane.ts";
import { overlaps } from "../src/layout/routing.ts";

const worker = role({ id: "worker", label: "处理者" });
const a = entity({ id: "a", label: "提交" });
const b = entity({ id: "b", label: "审核" });
const options: SwimlaneOptions = {
  id: "flow",
  title: "流程",
  width: 800,
  lanes: [
    { id: "applicant", label: "申请人", height: 200 },
    { id: "reviewer", label: "审核人", height: 240 },
  ],
  nodes: [
    {
      entity: a,
      role: worker,
      lane: "applicant",
      position: { x: 32, y: 40 },
      size: { width: 180, height: 80 },
    },
    {
      entity: b,
      role: worker,
      lane: "reviewer",
      position: { x: 352, y: 40 },
      size: { width: 180, height: 80 },
    },
  ],
  relations: [{ id: "submit", from: a, to: b, label: "提交申请" }],
};
const chart = (overrides: Partial<SwimlaneOptions> = {}) => swimlane({ ...options, ...overrides });
const hasCode = (code: string) => (error: unknown) =>
  error instanceof DiagnosticError &&
  error.diagnostics.some((d) => d.code === code && d.path && d.hint);
const check = (overrides: Partial<SwimlaneOptions>) => compile(chart(overrides));

test("swimlanes preserve declared geometry and lane order independently of node order", () => {
  assert.equal(chart().headerWidth, 144);
  const { semantic, scene } = check({ nodes: [...options.nodes].reverse() });
  assert.equal(scene.kind, "swimlane");
  if (scene.kind !== "swimlane") return;
  assert.deepEqual(
    scene.lanes.map((lane) => [lane.id, lane.x, lane.y, lane.width, lane.height]),
    [
      ["applicant", 32, 32, 800, 200],
      ["reviewer", 32, 232, 800, 240],
    ],
  );
  assert.equal(scene.width, 864);
  assert.equal(scene.height, 504);
  assert.deepEqual(
    scene.nodes.map((node) => [node.id, node.x, node.y, node.width, node.height]),
    [
      ["b", 552, 296, 180, 80],
      ["a", 232, 96, 180, 80],
    ],
  );
  assert.deepEqual(JSON.parse(JSON.stringify(semantic)), semantic);
  assert.deepEqual(
    semantic.entities.map((item) => item.id),
    ["a", "b"],
  );
  assert.equal(semantic.chart.kind, "swimlane");
  assert.ok(Object.isFrozen(semantic.chart));
});

test("custom header widths control title wrapping, node origins, rendering and routing bounds", () => {
  const baseline = check({}).scene;
  for (const headerWidth of [96, 240]) {
    const delta = headerWidth - 144;
    const flow = chart({ headerWidth, width: options.width + delta });
    const { semantic, scene } = compile(flow);
    assert.equal(scene.kind, "swimlane");
    if (scene.kind !== "swimlane") return;
    const block = semantic.chart;
    assert.ok(block.kind === "swimlane");
    assert.equal(block.headerWidth, headerWidth);
    assert.ok(scene.lanes.every((lane) => lane.headerWidth === headerWidth));
    assert.deepEqual(
      scene.nodes.map((node) => [node.x, node.y, node.width, node.height]),
      baseline.nodes.map((node) => [node.x + delta, node.y, node.width, node.height]),
    );
    for (const edge of scene.edges) {
      assert.ok(edge.points.every(([x]) => x >= 32 + headerWidth && x <= scene.width - 32));
      assert.ok(edge.labelX - 3 >= 32 + headerWidth);
      assert.ok(edge.labelX + edge.label.width + 3 <= scene.width - 32);
    }
    assert.ok(
      render(flow).includes(
        `<rect x="32" y="32" width="${headerWidth}" height="200" fill="color-mix(in srgb, var(--foreground) 4%, var(--background))"`,
      ),
    );
  }
  const lanes = [{ ...options.lanes[0], label: "客户支持与订单审核协作团队" }, options.lanes[1]];
  const narrow = check({ lanes }).scene;
  const wide = check({ lanes, headerWidth: 240, width: 896 }).scene;
  assert.ok(narrow.kind === "swimlane" && wide.kind === "swimlane");
  assert.ok(narrow.lanes[0].title.lines.length > wide.lanes[0].title.lines.length);
  assert.equal(wide.lanes[0].title.lines.length, 1);
});

test("invalid or insufficient header widths produce diagnostics without resizing", () => {
  for (const headerWidth of [0, -1, Infinity, NaN])
    assert.throws(() => chart({ headerWidth }), hasCode("INVALID_SIZE"));
  // @ts-expect-error Width is a numeric dimension, not CSS text.
  assert.throws(() => chart({ headerWidth: "200px" }), hasCode("INVALID_SIZE"));
  // @ts-expect-error Only an omitted value selects the default width.
  assert.throws(() => chart({ headerWidth: null }), hasCode("INVALID_SIZE"));
  for (const headerWidth of [32, 40, 752])
    assert.throws(() => check({ headerWidth }), hasCode("LANE_CONTENT_FIT"));
  assert.throws(() => check({ headerWidth: 300 }), hasCode("LANE_CONTENT_FIT"));
});

test("swimlane declarations copy and freeze caller data and retain shared identity across chart types", () => {
  const input = structuredClone(options);
  const flow = swimlane(input);
  assert.notEqual(flow.lanes, input.lanes);
  assert.notEqual(flow.nodes[0].position, input.nodes[0].position);
  assert.ok(Object.isFrozen(flow.nodes[0].position));
  const structure = architecture({
    id: "structure",
    title: "组件",
    nodes: [options.nodes[0]].map(({ entity, role, size, position }) => ({
      entity,
      role,
      size,
      position,
    })),
    relations: [],
  });
  const doc = flow;
  assert.deepEqual(compile(structure).semantic.entities[0], compile(flow).semantic.entities[0]);
  const { semantic } = compile(doc);
  assert.equal(semantic.entities.filter((item) => item.id === "a").length, 1);
  assert.equal((render(doc).match(/id="details-a"/g) ?? []).length, 1);
});

test("branch and return routes stay inside the swimlane body without crossing nodes or headers", () => {
  const { scene } = compile(expense);
  assert.equal(scene.kind, "swimlane");
  if (scene.kind !== "swimlane") return;
  assert.equal(scene.edges.length, 5);
  const bodyLeft = scene.lanes[0].x + scene.lanes[0].headerWidth;
  for (const edge of scene.edges) {
    for (const [x, y] of edge.points) {
      assert.ok(x >= bodyLeft && x <= scene.width - 32);
      assert.ok(y >= 32 && y <= scene.height - 32);
    }
    const label = {
      x: edge.labelX - 3,
      y: edge.labelY - 2,
      width: edge.label.width + 6,
      height: edge.label.height + 4,
    };
    assert.ok(label.x >= bodyLeft && label.x + label.width <= scene.width - 32);
    assert.ok(label.y >= 32 && label.y + label.height <= scene.height - 32);
    assert.ok(!scene.nodes.some((node) => overlaps(label, node)));
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
  assert.deepEqual(compile(expense).scene, scene);
});

test("swimlane HTML has escaped lane titles, activity details, membership and navigation", () => {
  const flow = chart({
    lanes: [{ ...options.lanes[0], label: '<申请人> & "用户"' }, options.lanes[1]],
  });
  const html = render(flow);
  assert.match(html, /data-lane="applicant"/);
  assert.match(html, /&lt;申请人&gt; &amp; &quot;用户&quot;/);
  assert.match(html, /<dt>所属泳道<\/dt><dd>&lt;申请人&gt;/);
  assert.match(html, /data-entity-detail="details-a" data-chart="flow"/);
  assert.match(html, /data-locate-node="entity-flow-b"/);
  assert.match(html, /横向泳道表示负责的人或系统/);
  assert.doesNotMatch(html, /data-partition=|data-fragment=|\{\{\{/);
  assert.equal(html, render(flow));
});

test("missing lanes, duplicate lanes, empty lanes and unknown membership produce diagnostics", () => {
  assert.throws(() => chart({ lanes: [] }), hasCode("INVALID_ARRAY"));
  assert.throws(
    () => check({ lanes: [...options.lanes, options.lanes[0]] }),
    hasCode("DUPLICATE_LANE"),
  );
  assert.throws(
    () => check({ lanes: [...options.lanes, { id: "unused", label: "未使用", height: 200 }] }),
    hasCode("EMPTY_LANE"),
  );
  assert.throws(
    () => check({ nodes: [{ ...options.nodes[0], lane: "missing" }, options.nodes[1]] }),
    hasCode("UNKNOWN_LANE"),
  );
});

test("swimlane declarations reject missing geometry, invalid dimensions and unsupported fields", () => {
  // @ts-expect-error Swimlane charts define lanes, not architecture partitions.
  assert.throws(() => chart({ partitions: [] }), hasCode("UNKNOWN_FIELD"));
  assert.throws(
    // @ts-expect-error Swimlane activities cannot carry architecture partition membership.
    () => chart({ nodes: [{ ...options.nodes[0], partition: "zone" }] }),
    hasCode("UNKNOWN_FIELD"),
  );
  for (const width of [0, -1, NaN, Infinity])
    assert.throws(() => chart({ width }), hasCode("INVALID_SIZE"));
  assert.throws(
    () => chart({ lanes: [{ ...options.lanes[0], height: Infinity }] }),
    hasCode("INVALID_SIZE"),
  );
  assert.throws(
    () => chart({ nodes: [{ ...options.nodes[0], position: { x: -1, y: 0 } }] }),
    hasCode("INVALID_POSITION"),
  );
  assert.throws(
    () =>
      chart({ nodes: [{ ...options.nodes[0], lane: undefined }] } as unknown as SwimlaneOptions),
    hasCode("INVALID_TEXT"),
  );
  assert.throws(
    () =>
      chart({ nodes: [{ ...options.nodes[0], size: undefined }] } as unknown as SwimlaneOptions),
    hasCode("INVALID_OBJECT"),
  );
  assert.throws(
    () =>
      chart({
        lanes: [{ ...options.lanes[0], position: { x: 0, y: 0 } }],
      } as unknown as SwimlaneOptions),
    hasCode("UNKNOWN_FIELD"),
  );
  assert.throws(
    () => chart({ lanes: [{ ...options.lanes[0], label: "跨行\n名称" }] }),
    hasCode("INVALID_SHORT_TEXT"),
  );
});

test("lane bounds, title fit and overlapping activities fail without resizing", () => {
  assert.throws(() => check({ width: 190 }), hasCode("LANE_CONTENT_FIT"));
  assert.throws(() => check({ width: 600 }), hasCode("LANE_CONTENT_FIT"));
  assert.throws(
    () => check({ lanes: [{ ...options.lanes[0], height: 100 }, options.lanes[1]] }),
    hasCode("LANE_CONTENT_FIT"),
  );
  assert.throws(
    () => check({ lanes: [{ ...options.lanes[0], height: 50 }, options.lanes[1]] }),
    hasCode("LANE_CONTENT_FIT"),
  );
  assert.throws(
    () =>
      check({
        lanes: [{ ...options.lanes[0], label: "很长的泳道名称".repeat(5) }, options.lanes[1]],
      }),
    hasCode("LABEL_CAPACITY"),
  );
  assert.throws(
    () =>
      check({
        nodes: [
          ...options.nodes,
          { ...options.nodes[0], entity: entity({ id: "overlap", label: "重叠" }) },
        ],
      }),
    hasCode("NODE_OVERLAP"),
  );
  assert.throws(
    () =>
      check({
        nodes: [{ ...options.nodes[0], size: { width: 180, height: 20 } }, options.nodes[1]],
      }),
    hasCode("NODE_CONTENT_FIT"),
  );
  assert.throws(() => check({ width: 1280 }), hasCode("LAYOUT_CAPACITY"));
  assert.throws(
    () => check({ lanes: [{ ...options.lanes[0], height: 2600 }, options.lanes[1]] }),
    hasCode("LAYOUT_CAPACITY"),
  );
});

test("swimlanes validate node and relation identities and forbid lanes as endpoints", () => {
  assert.throws(
    () => check({ nodes: [...options.nodes, options.nodes[0]] }),
    hasCode("DUPLICATE_NODE"),
  );
  assert.throws(
    () => check({ relations: [options.relations[0], options.relations[0]] }),
    hasCode("DUPLICATE_RELATION"),
  );
  assert.throws(
    () => check({ relations: [{ ...options.relations[0], from: "applicant" }] }),
    hasCode("UNKNOWN_ENDPOINT"),
  );
  assert.throws(
    () =>
      check({
        nodes: Array.from({ length: 13 }, (_, i) => ({
          ...options.nodes[i % 2],
          entity: entity({ id: `node-${i}`, label: "节点" }),
        })),
      }),
    hasCode("NODE_CAPACITY"),
  );
  assert.throws(
    () =>
      check({
        relations: Array.from({ length: 17 }, (_, i) => ({
          ...options.relations[0],
          id: `edge-${i}`,
        })),
      }),
    hasCode("RELATION_CAPACITY"),
  );
});

test("one-lane flows allow no relations, self loops and parallel relations", () => {
  const single = { lanes: [options.lanes[0]], nodes: [options.nodes[0]], relations: [] };
  assert.equal(check(single).scene.edges.length, 0);
  const loop = check({ ...single, relations: [{ id: "retry", from: a, to: a, label: "重试" }] })
    .scene.edges[0];
  assert.ok(loop.points.length >= 4);
  const scene = check({
    relations: [...options.relations, { id: "again", from: a, to: b, label: "补充说明" }],
  }).scene;
  assert.notDeepEqual(scene.edges[0].points, scene.edges[1].points);
});

test("crowded swimlanes report an unroutable relation without escaping the declared body", () => {
  assert.throws(
    () =>
      check({
        width: 256,
        lanes: [{ id: "applicant", label: "申请人", height: 100 }],
        nodes: [{ ...options.nodes[0], position: { x: 0, y: 0 }, size: { width: 64, height: 52 } }],
        relations: [{ id: "retry", from: a, to: a, label: "这条关系的标签无法放入内容区" }],
      }),
    hasCode("RELATION_LAYOUT"),
  );
});
