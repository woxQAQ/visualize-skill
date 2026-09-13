// Compile-only checks: invalid declarations must fail before rendering.
import { architecture, render, entity, role, sequence, swimlane } from "../src/index.ts";
import type { RelationInput, RelationVariant, SemanticDiagram, Step } from "../src/index.ts";

const item = entity({ id: "item", label: "对象", tags: [{ id: "public", label: "公开" }] });
const worker = role({ id: "worker", label: "处理者" });
const size = { width: 220, height: 88 };

const preset: RelationVariant = "security";
const styledRelation: RelationInput = {
  id: "access",
  from: item,
  to: item,
  label: "授权",
  variant: preset,
};
void styledRelation;
// @ts-expect-error Only named relation presets are accepted.
const unknownVariant: RelationVariant = "custom";
void unknownVariant;
const invalidStyle: RelationInput = {
  id: "invalid-style",
  from: item,
  to: item,
  label: "关系",
  // @ts-expect-error Relations cannot supply arbitrary stroke colors.
  stroke: "red",
};
void invalidStyle;

architecture({
  id: "valid",
  title: "有效声明",
  nodes: [{ entity: item, role: worker, size, position: { x: 0, y: 0 } }],
  relations: [],
});
architecture({
  id: "missing-size",
  title: "缺少尺寸",
  // @ts-expect-error Architecture nodes require an explicit size.
  nodes: [{ entity: item, role: worker, position: { x: 0, y: 0 } }],
  relations: [],
});
sequence({
  id: "missing-size",
  title: "缺少尺寸",
  // @ts-expect-error Sequence participants require an explicit size too.
  participants: [{ entity: item, role: worker }],
  steps: [],
});
// @ts-expect-error A tag is a named classification record, not arbitrary text.
entity({ id: "bad-tags", label: "错误标签", tags: ["正文"] });
// @ts-expect-error A node has no Markdown details field.
entity({ id: "bad-details", label: "错误正文", details: "# 正文" });
// @ts-expect-error Shared entity tags cannot be mutated after declaration.
item.tags.push({ id: "new", label: "新标签" });
sequence({
  id: "bad-reply",
  title: "错误返回",
  participants: [{ entity: item, role: worker, size }],
  // @ts-expect-error References use identifiers, not numeric indices.
  steps: [{ id: "return", from: item, to: item, label: "返回", replyTo: 1 }],
});
// @ts-expect-error Rendering accepts a diagram, not prose.
render("正文");

function inspectStep(step: Step): string {
  if (step.kind === "alternative") return step.branches[0].label;
  if (step.kind === "return") return step.replyTo;
  // @ts-expect-error A call cannot be mistaken for a return.
  return step.replyTo;
}
function inspectDiagram(value: SemanticDiagram): void {
  // @ts-expect-error The serialized semantic model is immutable too.
  value.entities.push(item);
}
void inspectStep;
void inspectDiagram;

architecture({
  id: "bad-parent",
  title: "错误归属",
  // @ts-expect-error Entity ownership cannot substitute for logical partition membership.
  nodes: [{ entity: item, role: worker, size, position: { x: 0, y: 0 }, parent: item }],
  relations: [],
});
architecture({
  id: "bad-partition",
  title: "错误分区",
  // @ts-expect-error A partition is identified by its local identifier, not an entity object.
  nodes: [{ entity: item, role: worker, size, position: { x: 0, y: 0 }, partition: item }],
  relations: [],
});

const lanes = [{ id: "worker", label: "处理者", height: 200 }];
const activity = { entity: item, role: worker, size, position: { x: 0, y: 0 }, lane: "worker" };
swimlane({ id: "valid-flow", title: "流程", width: 800, lanes, nodes: [activity], relations: [] });
swimlane({
  id: "custom-header",
  title: "流程",
  width: 800,
  headerWidth: 200,
  lanes,
  nodes: [activity],
  relations: [],
});
swimlane({
  id: "invalid-header",
  title: "流程",
  width: 800,
  // @ts-expect-error Header width is a numeric chart dimension.
  headerWidth: "200px",
  lanes,
  nodes: [activity],
  relations: [],
});
swimlane({
  id: "uneven-headers",
  title: "流程",
  width: 800,
  // @ts-expect-error Header width is shared by the chart, not independently set on a lane.
  lanes: [{ ...lanes[0], headerWidth: 200 }],
  nodes: [activity],
  relations: [],
});
// @ts-expect-error A swimlane requires a declared common width.
swimlane({ id: "missing-width", title: "流程", lanes, nodes: [activity], relations: [] });
swimlane({
  id: "missing-lane",
  title: "流程",
  width: 800,
  lanes,
  // @ts-expect-error Each activity must belong to a lane.
  nodes: [{ entity: item, role: worker, size, position: { x: 0, y: 0 } }],
  relations: [],
});
swimlane({
  id: "missing-position",
  title: "流程",
  width: 800,
  lanes,
  // @ts-expect-error Swimlane nodes require explicit geometry.
  nodes: [{ entity: item, role: worker, size, lane: "worker" }],
  relations: [],
});
swimlane({
  id: "entity-lane",
  title: "流程",
  width: 800,
  lanes,
  // @ts-expect-error Lane membership uses a local identifier, not an entity.
  nodes: [{ ...activity, lane: item }],
  relations: [],
});
swimlane({
  id: "missing-height",
  title: "流程",
  width: 800,
  // @ts-expect-error Lanes declare their height, not a free position.
  lanes: [{ id: "worker", label: "处理者" }],
  nodes: [activity],
  relations: [],
});
swimlane({
  id: "bad-partition",
  title: "流程",
  width: 800,
  lanes,
  // @ts-expect-error Swimlane declarations cannot use architecture partitions.
  nodes: [{ ...activity, partition: "worker" }],
  relations: [],
});
