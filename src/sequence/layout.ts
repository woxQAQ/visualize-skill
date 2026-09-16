import type {
  Activation,
  SequenceChart,
  SequenceEdgeLayout,
  SequenceScene,
  SequencePartitionLayout,
  Message,
} from "./model.ts";
import type { LayoutContext, Point } from "../shared/model.ts";

interface Execution {
  call: Message;
  activation: Activation;
}
import { wrap } from "../design.ts";
import { nodeBox, finish, path } from "../shared/layout.ts";
import { fail } from "../diagnostics.ts";

export function layoutSequence(chart: SequenceChart, ctx: LayoutContext): SequenceScene {
  let nextX = chart.partitions.length ? 46 : 32;
  const nodes = chart.participants.map((node) => {
    const box = nodeBox(node, ctx, nextX, 24, { description: false });
    nextX += box.width + 40;
    return box;
  });
  const partitions: SequencePartitionLayout[] = chart.partitions.map((partition) => {
    const members = nodes.filter(
      (_, index) => chart.participants[index].partition === partition.id,
    );
    const first = members[0],
      last = members.at(-1)!;
    const width = last.x + last.width - first.x + 28;
    return {
      id: partition.id,
      x: first.x - 14,
      y: 24,
      width,
      height: 0,
      title: wrap(
        partition.label,
        width - 48,
        `diagram.${chart.id}.partitions.${partition.id}.label`,
        2,
      ),
    };
  });
  const nodeY = partitions.length
    ? 60 + Math.max(...partitions.map((partition) => partition.title.height))
    : 24;
  const headerHeight = Math.max(...nodes.map((node) => node.height));
  for (const node of nodes) {
    node.y = nodeY;
    node.height = headerHeight;
  }
  const borders = partitions
    .flatMap((partition) => [partition.x, partition.x + partition.width])
    .sort((a, b) => a - b);

  function labelSpace(
    x: number,
    width: number,
    obstacles: [number, number][],
  ): { x: number; width: number } {
    const end = x + width;
    const spaces: { x: number; width: number }[] = [];
    let start = x;
    for (const [left, right] of obstacles.sort((a, b) => a[0] - b[0])) {
      if (right <= start || left >= end) continue;
      if (left > start) spaces.push({ x: start, width: left - start });
      start = Math.max(start, right);
    }
    if (start < end) spaces.push({ x: start, width: end - start });
    return spaces.sort((a, b) => b.width - a.width)[0] ?? { x, width: 0 };
  }

  const centers = new Map(nodes.map((node) => [node.id, node.x + node.width / 2]));
  const width = nodes.at(-1)!.x + nodes.at(-1)!.width + 52;
  const edges: SequenceEdgeLayout[] = [],
    activations: Activation[] = [];
  let y = nodeY + headerHeight + 32;
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
    const returning = message.kind === "reply";
    const self = message.from === message.to;
    const direction = centers.get(message.to)! >= centers.get(message.from)! ? 1 : -1;
    const participantIndex = nodes.findIndex((node) => node.id === message.from);
    const selfLabelOnLeft = self && participantIndex === nodes.length - 1 && participantIndex > 0;
    // Reserve text clearance around lifelines and the full nested execution width.
    // The label background extends another 3 px beyond the measured text.
    const clearance = 20;
    const obstacles: [number, number][] = [
      ...borders.map((border): [number, number] => [border - 12, border + 12]),
      ...[...centers.values()].map((center): [number, number] => [
        center - clearance,
        center + clearance,
      ]),
      ...stack.map(({ activation }): [number, number] => [
        activation.x - clearance,
        activation.x + activation.width + clearance,
      ]),
    ];
    if (message.kind === "sync") {
      const depth = stack.filter((frame) => frame.call.to === message.to).length;
      const left = centers.get(message.to)! - 7 + depth * 7;
      obstacles.push([left - clearance, left + 14 + clearance]);
    }
    const fromCenter = centers.get(message.from)!;
    const toCenter = centers.get(message.to)!;
    const labelStart = self
      ? selfLabelOnLeft
        ? centers.get(nodes[participantIndex - 1].id)!
        : fromCenter
      : Math.min(fromCenter, toCenter);
    const labelEnd = self
      ? selfLabelOnLeft
        ? fromCenter
        : participantIndex < nodes.length - 1
          ? centers.get(nodes[participantIndex + 1].id)!
          : fromCenter + 160
      : Math.max(fromCenter, toCenter);
    const labelPosition = labelSpace(labelStart, labelEnd - labelStart, obstacles);
    if (labelPosition.width < 12) {
      fail(
        "SEQUENCE_LABEL_SPACE",
        `diagram.${chart.id}.${message.id}`,
        "参与者之间没有足够空间放置消息标签。",
        "调整 participants 的声明顺序，或拆分消息较密集的图表；参与者尺寸由名称自动计算。",
      );
    }
    const label = wrap(
      `${++count}. ${message.label}`,
      self ? Math.min(120, labelPosition.width) : labelPosition.width,
      `diagram.${chart.id}.${message.id}.label`,
      6,
      12,
    );
    const lineY = y + label.height + 8;
    const arrivalY = lineY + (self ? 28 : 0);
    const fromX = anchor(message.from, stack, self ? 1 : direction);
    let toX;

    if (returning && prior.get(message.replyTo!)!.kind === "sync") {
      const completed = stack.pop()!;
      completed.activation.height = lineY - completed.activation.y;
      toX = anchor(message.to, stack, self ? 1 : -direction);
    } else if (returning || message.kind === "async") {
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
        ? selfLabelOnLeft
          ? labelPosition.x + labelPosition.width - label.width
          : labelPosition.x
        : labelPosition.x + (labelPosition.width - label.width) / 2,
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
  for (const partition of partitions) partition.height = y + 12 - partition.y;
  return finish({
    kind: "sequence",
    id: chart.id,
    width: finalWidth,
    height: y + (partitions.length ? 36 : 12),
    nodes,
    partitions,
    edges,
    activations: activations.filter((bar) => bar.height > 0),
    lifelines: nodes.map((node) => ({ x: centers.get(node.id)!, y1: node.y + node.height, y2: y })),
  });
}
