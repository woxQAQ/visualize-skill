import test from "node:test";
import assert from "node:assert/strict";
import { compile, document, entity, role, sequence } from "../src/index.ts";
import type { SequenceScene, StepInput } from "../src/model.ts";

const worker = role({ id: "worker", label: "参与者" });
const participants = Array.from({ length: 6 }, (_, i) => ({
  entity: entity({ id: `participant-${i}`, label: `参与者 ${i}` }),
  role: worker,
  size: { width: 160, height: 64 },
}));

function layout(steps: StepInput[]) {
  const result = compile(
    document().diagram(sequence({ id: "wide-sequence", title: "宽时序图", participants, steps })),
  );
  return { ...result, scene: result.scenes[0] as SequenceScene };
}

test("oversized sequences reduce gaps while retaining participant sizes and message readability", () => {
  const { scene, warnings } = layout([
    { id: "call", from: "participant-0", to: "participant-1", label: "abcdefghijklmnopqr" },
    { id: "return", from: "participant-1", to: "participant-0", label: "完成", replyTo: "call" },
  ]);
  assert.ok(
    scene.width < 1244,
    "the original six 160px participants and 40px gaps occupied 1244px",
  );
  assert.equal(
    scene.edges[0].label.lines.length,
    1,
    "compaction must not wrap an originally single-line message",
  );
  for (const [i, node] of scene.nodes.entries()) {
    assert.equal(node.width, 160);
    assert.equal(node.height, 64);
    if (i) assert.ok(node.x - scene.nodes[i - 1].x - 160 >= 24);
  }
  const firstGap = scene.nodes[1].x - scene.nodes[0].x - 160;
  assert.ok(firstGap > 24, "the long message needs more space than the minimum gap");
  assert.deepEqual(
    warnings.map((warning) => [warning.code, warning.path]),
    [["READING_WIDTH", "diagram.wide-sequence"]],
  );
});

test("compaction includes nested alternatives and last-participant self calls when reserving label space", () => {
  const { scene } = layout([
    { id: "outer", from: "participant-0", to: "participant-5", label: "开始" },
    {
      id: "branch",
      kind: "alternative",
      branches: [
        {
          label: "分支一",
          steps: [
            { id: "self", from: "participant-5", to: "participant-5", label: "局部处理" },
            {
              id: "self-done",
              from: "participant-5",
              to: "participant-5",
              label: "完成",
              replyTo: "self",
            },
          ],
        },
        {
          label: "分支二",
          steps: [
            {
              id: "nested",
              from: "participant-5",
              to: "participant-4",
              label: "abcdefghijklmnopqr",
            },
            {
              id: "nested-done",
              from: "participant-4",
              to: "participant-5",
              label: "完成",
              replyTo: "nested",
            },
          ],
        },
      ],
    },
    {
      id: "outer-done",
      from: "participant-5",
      to: "participant-0",
      label: "结束",
      replyTo: "outer",
    },
  ]);
  assert.ok(scene.width < 1244);
  assert.ok(scene.edges.every((edge) => edge.label.lines.length === 1));
  assert.ok(
    scene.edges.every((edge) => edge.labelX >= 0 && edge.labelX + edge.label.width <= scene.width),
  );
  assert.ok(scene.activations.every((activation) => activation.height > 0));
});
