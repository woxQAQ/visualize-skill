import type {
  Activation,
  LayoutContext,
  Point,
  SequenceChart,
  SequenceEdgeLayout,
  SequenceScene,
  Message,
} from "../model.ts";

interface Execution {
  call: Message;
  activation: Activation;
}
import { wrap } from "../design.ts";
import { nodeBox, finish, path } from "./common.ts";
import { fail } from "../diagnostics.ts";

export function layoutSequence(chart: SequenceChart, ctx: LayoutContext): SequenceScene {
  let nextX = 32;
  const nodes = chart.participants.map((node) => {
    const box = nodeBox(node, ctx, nextX, 24, { description: false });
    nextX += box.width + 40;
    return box;
  });
  const headerHeight = Math.max(...nodes.map((node) => node.height));
  const centers = new Map(nodes.map((node) => [node.id, node.x + node.width / 2]));
  const width = nodes.at(-1)!.x + nodes.at(-1)!.width + 52;
  const edges: SequenceEdgeLayout[] = [],
    activations: Activation[] = [];
  let y = 24 + headerHeight + 32;
  let count = 0;

  function activate(call: Message, stack: Execution[], startY: number): Execution {
    const depth = stack.filter((frame) => frame.call.to === call.to).length;
    const activation: Activation = {
      id: `${call.id}-activation`,
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

  function anchor(entity: string, stack: Execution[], direction: number): number {
    const frame = stack.findLast((frame) => frame.call.to === entity);
    return frame
      ? frame.activation.x + (direction > 0 ? frame.activation.width : 0)
      : centers.get(entity)!;
  }

  const stack: Execution[] = [];
  const prior = new Map<string, Message>();
  for (const message of chart.messages) {
    const returning = message.variant === "return";
    const self = message.from === message.to;
    const direction = centers.get(message.to)! >= centers.get(message.from)! ? 1 : -1;
    const participantIndex = nodes.findIndex((node) => node.id === message.from);
    const selfLabelOnLeft = self && participantIndex === nodes.length - 1 && participantIndex > 0;
    const selfLabelWidth = selfLabelOnLeft
      ? centers.get(message.from)! - centers.get(nodes[participantIndex - 1].id)! - 48
      : participantIndex < nodes.length - 1
        ? centers.get(nodes[participantIndex + 1].id)! - centers.get(message.from)! - 64
        : 120;
    const labelWidth = self
      ? Math.min(120, selfLabelWidth)
      : Math.abs(centers.get(message.to)! - centers.get(message.from)!) - 42;
    if (labelWidth < 12) {
      fail(
        "SEQUENCE_LABEL_SPACE",
        `diagram.${chart.id}.${message.id}`,
        "参与者之间没有足够空间放置消息标签。",
        "增加相关参与者的 size.width。",
      );
    }
    const label = wrap(
      `${++count}. ${message.label}`,
      labelWidth,
      `diagram.${chart.id}.${message.id}.label`,
      6,
      12,
    );
    const lineY = y + label.height + 8;
    const arrivalY = lineY + (self ? 28 : 0);
    const fromX = anchor(message.from, stack, self ? 1 : direction);
    let toX;

    if (returning && prior.get(message.replyTo!)!.variant !== "dashed") {
      const completed = stack.pop()!;
      completed.activation.height = lineY - completed.activation.y;
      toX = anchor(message.to, stack, self ? 1 : -direction);
    } else if (returning || message.variant === "dashed") {
      toX = anchor(message.to, stack, self ? 1 : -direction);
    } else {
      const frame = activate(message, stack, arrivalY);
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
      ...message,
      points,
      path: path(points),
      label,
      labelX: self
        ? centers.get(message.from)! + (selfLabelOnLeft ? -label.width - 24 : 40)
        : Math.min(fromX, toX) + 12,
      labelY: y,
      arrivalY,
      lineY,
    });
    y = arrivalY + 32;
    prior.set(message.id, message);
  }
  const finalWidth = Math.max(
    width,
    ...edges.flatMap((edge) => [
      edge.labelX + edge.label.width + 24,
      ...edge.points.map((point) => point[0] + 24),
    ]),
  );
  return finish({
    kind: "sequence",
    id: chart.id,
    width: finalWidth,
    height: y + 12,
    nodes,
    edges,
    activations: activations.filter((bar) => bar.height > 0),
    lifelines: nodes.map((node) => ({ x: centers.get(node.id)!, y1: node.y + node.height, y2: y })),
  });
}
