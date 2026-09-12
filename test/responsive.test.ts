import test from "node:test";
import assert from "node:assert/strict";
import { compile, render } from "../src/index.ts";
import { context } from "../src/design.ts";
import { responsiveViews } from "../src/render-responsive.ts";
import { overlaps } from "../src/layout/routing.ts";
import { overview } from "../examples/architecture.ts";
import { generation } from "../examples/sequence.ts";
import { expense } from "../examples/swimlane.ts";
import type { Point, Rect, Step } from "../src/model.ts";

function entersBox(a: Point, b: Point, box: Rect) {
  return a[0] === b[0]
    ? a[0] > box.x &&
        a[0] < box.x + box.width &&
        Math.max(a[1], b[1]) > box.y &&
        Math.min(a[1], b[1]) < box.y + box.height
    : a[1] > box.y &&
        a[1] < box.y + box.height &&
        Math.max(a[0], b[0]) > box.x &&
        Math.min(a[0], b[0]) < box.x + box.width;
}

test("compact diagrams preserve every entity and relation within their target width without reducing text", () => {
  for (const diagram of [overview, generation, expense]) {
    const { semantic, scene: original } = compile(diagram);
    const views = responsiveViews(semantic.chart, context(semantic), original);
    const retained = structuredClone(original);
    for (const { minimumWidth, scene } of views) {
      if (!scene) continue;
      assert.ok(scene.width <= minimumWidth + 0.001);
      assert.deepEqual(
        scene.nodes.map((node) => node.id),
        original.nodes.map((node) => node.id),
      );
      assert.deepEqual(
        scene.edges.map(({ id, from, to }) => ({ id, from, to })),
        original.edges.map(({ id, from, to }) => ({ id, from, to })),
      );
      for (const node of scene.nodes) {
        assert.ok(node.x >= 0 && node.y >= 0);
        assert.ok(node.x + node.width <= scene.width + 0.001);
        assert.ok(node.y + node.height <= scene.height + 0.001);
        assert.equal(node.title.size, 14);
        assert.ok(node.title.width <= node.width - 32 + 0.001);
        assert.ok(node.contentHeight <= node.height);
        if (node.detail) {
          assert.equal(node.detail.size, 12);
          assert.ok(node.detail.width <= node.width - 32 + 0.001);
        }
      }
      for (const [index, node] of scene.nodes.entries()) {
        assert.ok(scene.nodes.slice(index + 1).every((other) => !overlaps(node, other)));
      }
      for (const edge of scene.edges) {
        assert.equal(edge.label.size, 12);
        assert.ok(edge.labelX >= 0 && edge.labelY >= 0);
        assert.ok(edge.labelX + edge.label.width <= scene.width + 0.001);
        assert.ok(edge.labelY + edge.label.height <= scene.height + 0.001);
        for (const [x, y] of edge.points)
          assert.ok(x >= 0 && x <= scene.width && y >= 0 && y <= scene.height);
        if (scene.kind !== "sequence") {
          const label = {
            x: edge.labelX,
            y: edge.labelY,
            width: edge.label.width,
            height: edge.label.height,
          };
          for (const node of scene.nodes) {
            assert.ok(!overlaps(label, node), `${scene.id}: ${edge.id} label overlaps ${node.id}`);
            if (node.id === edge.from || node.id === edge.to) continue;
            for (let index = 1; index < edge.points.length; index++) {
              assert.ok(
                !entersBox(edge.points[index - 1], edge.points[index], node),
                `${scene.id}: ${edge.id} crosses ${node.id}`,
              );
            }
          }
        }
      }
      if (scene.kind === "architecture" && semantic.chart.kind === "architecture") {
        for (const node of semantic.chart.nodes.filter((node) => node.partition)) {
          const box = scene.nodes.find((box) => box.id === node.entity)!;
          const region = scene.partitions.find((region) => region.id === node.partition)!;
          assert.ok(box.x >= region.x && box.x + box.width <= region.x + region.width);
          assert.ok(
            box.y >= region.y + region.headerHeight &&
              box.y + box.height <= region.y + region.height,
          );
        }
      }
      if (scene.kind === "swimlane" && semantic.chart.kind === "swimlane") {
        for (const node of semantic.chart.nodes) {
          const box = scene.nodes.find((box) => box.id === node.entity)!;
          const lane = scene.lanes.find((lane) => lane.id === node.lane)!;
          assert.ok(box.x >= lane.x + lane.headerWidth && box.x + box.width <= lane.x + lane.width);
          assert.ok(box.y >= lane.y && box.y + box.height <= lane.y + lane.height);
        }
      }
    }
    assert.deepEqual(original, retained);
    assert.deepEqual(compile(diagram).scene, retained);
  }
});

test("narrow sequences preserve call order, alternatives and return pairing in the call view", () => {
  const { semantic, scene } = compile(generation);
  const views = responsiveViews(semantic.chart, context(semantic), scene);
  assert.ok(views.some((view) => view.minimumWidth === 0 && view.scene === null));
  const compact = views.find((view) => view.minimumWidth === 576)!.scene!;
  assert.deepEqual(compact.nodes[0].title.lines, ["TypeScript", "SDK"]);
  const html = render(generation);
  const flatten = (steps: readonly Step[]): Exclude<Step, { kind: "alternative" }>[] =>
    steps.flatMap((step) =>
      step.kind === "alternative"
        ? step.branches.flatMap((branch) => flatten(branch.steps))
        : [step],
    );
  assert.equal(semantic.chart.kind, "sequence");
  if (semantic.chart.kind !== "sequence") return;
  const steps = flatten(semantic.chart.steps);
  const rows = [
    ...html.matchAll(
      /<li class="trace-step(?: trace-return)?" data-relation="([^"]+)"(?: data-reply-to="([^"]+)")?/g,
    ),
  ];
  assert.deepEqual(
    rows.map(([, id]) => id),
    steps.map((step) => step.id),
  );
  for (const [index, [, , replyTo]] of rows.entries()) {
    const step = steps[index];
    assert.equal(replyTo, step.kind === "return" ? step.replyTo : undefined);
  }
  assert.match(html, /class="trace-branch"><h3>检查通过<\/h3>/);
  assert.match(html, /class="trace-branch"><h3>检查失败<\/h3>/);
  assert.match(html, /返回第 1 次调用/);
});

test("dense narrow diagrams retain complete relations through numbered keys when full labels cannot fit", async () => {
  const { agentOverview, agentFlow } = await import("./fixtures/agent-routing.ts");
  for (const diagram of [agentOverview, agentFlow]) {
    const { semantic, scene } = compile(diagram);
    const views = responsiveViews(semantic.chart, context(semantic), scene);
    const narrow = views.find((view) => view.minimumWidth === 288)!;
    assert.equal(narrow.scene!.width, 288);
    assert.ok(narrow.relationKey);
    assert.deepEqual(
      narrow.relationKey.map(({ id, from, to, label }) => ({ id, from, to, label })),
      diagram.relations,
    );
    assert.deepEqual(
      narrow.scene!.edges.map((edge) => edge.label.lines.join("")),
      diagram.relations.map((_, index) => String(index + 1)),
    );
    const html = render(diagram);
    assert.ok(Buffer.byteLength(html) < 1_000_000);
    for (const relation of diagram.relations)
      assert.ok(html.includes(`data-relation-key="${relation.id}"`));
  }
});
