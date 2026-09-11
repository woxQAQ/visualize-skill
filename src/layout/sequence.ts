import type {
  Activation,
  Call,
  Fragment,
  LayoutContext,
  NodeLayout,
  Point,
  SequenceChart,
  SequenceEdgeLayout,
  SequenceScene,
  Step,
} from "../model.ts";

interface Execution {
  call: Call;
  activation: Activation;
}
import { theme, wrap } from "../design.ts";
import { nodeBox, finish, path } from "./common.ts";
import { fail } from "../diagnostics.ts";

// Compact only oversized diagrams. Message line counts and participant sizes
// remain unchanged; each gap retains at least 24 pixels of separation.
function compactParticipants(nodes: NodeLayout[], steps: readonly Step[]) {
  let excess = nodes.at(-1)!.x + nodes.at(-1)!.width + 52 - theme.readingWidth;
  if (excess <= 0 || nodes.length < 2) return;
  const centers = nodes.map((node) => node.x + node.width / 2);
  const indices = new Map(nodes.map((node, i) => [node.id, i]));
  const constraints: { start: number; end: number; slack: number }[] = [];
  let count = 0;
  function visit(steps: readonly Step[]) {
    for (const step of steps) {
      if (step.kind === "alternative") {
        for (const branch of step.branches) visit(branch.steps);
        continue;
      }
      const from = indices.get(step.from)!,
        to = indices.get(step.to)!;
      const self = from === to;
      const last = from === nodes.length - 1;
      const start = self ? (last ? from - 1 : from) : Math.min(from, to);
      const end = self ? start + 1 : Math.max(from, to);
      const overhead = self ? (last ? 48 : 64) : 42;
      const available = centers[end] - centers[start] - overhead;
      const width = self ? Math.min(120, available) : available;
      const text = `${++count}. ${step.label}`;
      if (width < 12) continue; // The normal layout reports insufficient label space.
      const lines = wrap(text, width, "", Infinity, 12).lines.length;
      let lo = 12,
        hi = Math.ceil(width);
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        if (wrap(text, mid, "", Infinity, 12).lines.length <= lines) hi = mid;
        else lo = mid + 1;
      }
      constraints.push({ start, end, slack: Math.max(0, available - lo) });
    }
  }
  visit(steps);
  for (let i = 0; i < nodes.length - 1; i++) {
    const affected = constraints.filter(
      (constraint) => constraint.start <= i && i < constraint.end,
    );
    const reduction = Math.min(16, excess, ...affected.map((constraint) => constraint.slack));
    for (let j = i + 1; j < nodes.length; j++) nodes[j].x -= reduction;
    for (const constraint of affected) constraint.slack -= reduction;
    excess -= reduction;
  }
}

export function layoutSequence(chart: SequenceChart, ctx: LayoutContext): SequenceScene {
  let nextX = 32;
  const nodes = chart.participants.map((node) => {
    const box = nodeBox(node, ctx, nextX, 24, { description: false });
    nextX += box.width + 40;
    return box;
  });
  compactParticipants(nodes, chart.steps);
  const headerHeight = Math.max(...nodes.map((node) => node.height));
  const centers = new Map(nodes.map((node) => [node.id, node.x + node.width / 2]));
  const width = nodes.at(-1)!.x + nodes.at(-1)!.width + 52;
  const edges: SequenceEdgeLayout[] = [],
    fragments: Fragment[] = [],
    activations: Activation[] = [];
  let y = 24 + headerHeight + 32;
  let count = 0,
    segmentCount = 0;

  function activate(call: Call, stack: Execution[], startY: number): Execution {
    const depth = stack.filter((frame) => frame.call.to === call.to).length;
    const activation: Activation = {
      id: `${call.id}-segment-${++segmentCount}`,
      callId: call.id,
      entity: call.to,
      x: centers.get(call.to)! - 7 + depth * 7,
      y: startY,
      width: 14,
      height: 0,
    };
    activations.push(activation);
    return { call, activation };
  }

  function endSegments(stack: Execution[], endY: number): void {
    for (const frame of stack) frame.activation.height = Math.max(0, endY - frame.activation.y);
  }

  function resume(calls: Call[], startY: number): Execution[] {
    const stack: Execution[] = [];
    for (const call of calls) stack.push(activate(call, stack, startY));
    return stack;
  }

  function anchor(entity: string, stack: Execution[], direction: number): number {
    const frame = stack.findLast((frame) => frame.call.to === entity);
    return frame
      ? frame.activation.x + (direction > 0 ? frame.activation.width : 0)
      : centers.get(entity)!;
  }

  function walk(steps: readonly Step[], stack: Execution[], depth = 0): Execution[] {
    for (const step of steps) {
      if (step.kind === "alternative") {
        endSegments(stack, y);
        const inherited = stack.map((frame) => frame.call);
        const fragment: Fragment = {
          id: step.id,
          operator: "alt",
          height: 0,
          x: 12 + depth * 10,
          y,
          width: width - 24 - depth * 20,
          branches: [],
        };
        fragments.push(fragment);
        y += 32;
        let exitCalls: Call[] = [];
        for (const branch of step.branches) {
          const label = wrap(
            `[${branch.label}]`,
            width - 80,
            `diagram.${chart.id}.${step.id}.branch`,
            3,
            12,
          );
          fragment.branches.push({ y, label });
          y += label.height + 18;
          const branchStack = walk(branch.steps, resume(inherited, y), depth + 1);
          endSegments(branchStack, y);
          exitCalls = branchStack.map((frame) => frame.call);
          y += 12;
        }
        fragment.height = y - fragment.y;
        y += 24;
        stack = resume(exitCalls, y);
        continue;
      }

      const returning = step.kind === "return";
      const self = step.from === step.to;
      const direction = centers.get(step.to)! >= centers.get(step.from)! ? 1 : -1;
      const participantIndex = nodes.findIndex((node) => node.id === step.from);
      const selfLabelOnLeft = self && participantIndex === nodes.length - 1 && participantIndex > 0;
      const selfLabelWidth = selfLabelOnLeft
        ? centers.get(step.from)! - centers.get(nodes[participantIndex - 1].id)! - 48
        : participantIndex < nodes.length - 1
          ? centers.get(nodes[participantIndex + 1].id)! - centers.get(step.from)! - 64
          : 120;
      const labelWidth = self
        ? Math.min(120, selfLabelWidth)
        : Math.abs(centers.get(step.to)! - centers.get(step.from)!) - 42;
      if (labelWidth < 12) {
        fail(
          "SEQUENCE_LABEL_SPACE",
          `diagram.${chart.id}.${step.id}`,
          "参与者之间没有足够空间放置消息标签。",
          "增加相关参与者的 size.width。",
        );
      }
      const label = wrap(
        `${++count}. ${step.label}`,
        labelWidth,
        `diagram.${chart.id}.${step.id}.label`,
        6,
        12,
      );
      const lineY = y + label.height + 8;
      const arrivalY = lineY + (self ? 28 : 0);
      const fromX = anchor(step.from, stack, self ? 1 : direction);
      let toX;

      if (returning) {
        const completed = stack.pop()!;
        completed.activation.height = lineY - completed.activation.y;
        toX = anchor(step.to, stack, self ? 1 : -direction);
      } else {
        const frame = activate(step, stack, arrivalY);
        stack.push(frame);
        toX = frame.activation.x + (self || direction < 0 ? frame.activation.width : 0);
      }

      const points: Point[] = self
        ? [
            [fromX, lineY],
            [Math.max(fromX, toX) + 42, lineY],
            [Math.max(fromX, toX) + 42, arrivalY],
            [toX, arrivalY],
          ]
        : [
            [fromX, lineY],
            [toX, lineY],
          ];
      edges.push({
        ...step,
        points,
        path: path(points),
        label,
        labelX: self
          ? centers.get(step.from)! + (selfLabelOnLeft ? -label.width - 24 : 40)
          : Math.min(fromX, toX) + 12,
        labelY: y,
        arrivalY,
        lineY,
        dashed: returning,
      });
      y = arrivalY + 32;
    }
    return stack;
  }

  walk(chart.steps, []);
  const finalWidth = Math.max(
    width,
    ...edges.flatMap((edge) => [
      edge.labelX + edge.label.width + 24,
      ...edge.points.map((point) => point[0] + 24),
    ]),
  );
  for (const frame of fragments) frame.width += finalWidth - width;
  return finish({
    kind: "sequence",
    id: chart.id,
    width: finalWidth,
    height: y + 12,
    nodes,
    edges,
    fragments,
    activations: activations.filter((bar) => bar.height > 0),
    lifelines: nodes.map((node) => ({ x: centers.get(node.id)!, y1: node.y + node.height, y2: y })),
  });
}
