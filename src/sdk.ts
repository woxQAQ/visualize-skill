import type { Message, SequenceChart } from "./sequence/model.ts";
import type { ArchitectureChart } from "./architecture/model.ts";
import type {
  ArchitectureDirection,
  ArchitectureNode,
  ArchitectureOptions,
  ArchitecturePartition,
} from "./architecture/index.ts";
import { architectureDirections } from "./architecture/index.ts";
import type { Diagram, SemanticDiagram } from "./model.ts";
import type {
  ChartMeta,
  Entity,
  EntityInput,
  Alignment,
  Appearance,
  Position,
  Role,
  RelationVariant,
  RelationSide,
  Tag,
} from "./types.ts";
import { alignmentAxes, defaultRole } from "./types.ts";
import type {
  SequenceParticipant,
  SequencePartition,
  SequenceOptions,
  MessageVariant,
  MessageKind,
} from "./sequence/index.ts";
import type { SwimlaneChart } from "./swimlane/model.ts";
import type { SwimlaneOptions } from "./swimlane/index.ts";
import { messageKinds, messageVariants } from "./sequence/index.ts";
import { relationSides, relationVariants } from "./types.ts";
import {
  array,
  DiagnosticError,
  fail,
  fields,
  freeze,
  identifier,
  string,
  type Diagnostic,
} from "./diagnostics.ts";

/**
 * Run a normalization over an array, gathering every item's diagnostics into one thrown error
 * instead of failing on the first item.
 */
function collect<T, R>(values: readonly T[], normalize: (value: T, index: number) => R): R[] {
  const diagnostics: Diagnostic[] = [];
  const results: R[] = [];
  values.forEach((value, index) => {
    try {
      results.push(normalize(value, index));
    } catch (error) {
      if (!(error instanceof DiagnosticError)) throw error;
      diagnostics.push(...error.diagnostics);
    }
  });
  if (diagnostics.length) throw new DiagnosticError(diagnostics);
  return results;
}

const diagrams = new WeakSet<object>();
function diagram<T extends Diagram>(value: T): T {
  freeze(value);
  diagrams.add(value);
  return value;
}

function chartMeta(value: unknown, path: string): ChartMeta {
  fields(value, ["title", "subtitle"], path);
  return {
    title: string(value.title, `${path}.title`),
    ...(value.subtitle === undefined
      ? {}
      : { subtitle: string(value.subtitle, `${path}.subtitle`) }),
  };
}

function shortText(input: unknown, path: string, limit: number): string {
  const value = string(input, path);
  if (value !== value.trim() || /[\r\n\t]/.test(value) || Array.from(value).length > limit) {
    fail(
      "INVALID_SHORT_TEXT",
      path,
      `此字段需要单行短文本，最多 ${limit} 个字符。`,
      "填写名称或简短摘要；解释应放在对话中，不要塞入节点属性。",
    );
  }
  return value;
}

function tags(input: unknown, path: string): readonly Tag[] {
  const values = array(input, path, { empty: true });
  if (values.length > 8)
    fail(
      "TAG_CAPACITY",
      path,
      "每个对象最多声明 8 个标签。",
      "保留有区分作用的分类标签，不用标签拼接正文。",
    );
  const seen = new Set();
  return collect(values, (value, index) => {
    const p = `${path}[${index}]`;
    fields(value, ["id", "label"], p);
    const id = identifier(value.id, `${p}.id`);
    if (seen.has(id)) fail("DUPLICATE_TAG", p, `标签 ${id} 重复。`, "同一对象只声明一次相同标签。");
    seen.add(id);
    return { id, label: shortText(value.label, `${p}.label`, 24) };
  });
}

export function entity(options: EntityInput): Entity {
  return normalizeEntity(options, "entity");
}

function normalizeEntity(options: unknown, path: string): Entity {
  fields(options, ["id", "label", "description", "tags"], path);
  const value = freeze({
    id: identifier(options.id, `${path}.id`),
    label: string(options.label, `${path}.label`),
    ...(options.description === undefined
      ? {}
      : { description: shortText(options.description, `${path}.description`, 80) }),
    tags: tags(options.tags ?? [], `${path}.tags`),
  });
  return value;
}

export function role(options: Role): Role {
  return normalizeRole(options, "role");
}

function normalizeRole(options: unknown, path: string): Role {
  fields(options, ["id", "label"], path);
  return freeze({
    id: identifier(options.id, `${path}.id`),
    label: string(options.label, `${path}.label`),
  });
}

function position(value: unknown, path: string): Position {
  fields(value, ["x", "y"], path);
  for (const axis of ["x", "y"]) {
    if (typeof value[axis] !== "number" || !Number.isFinite(value[axis]) || value[axis] < 0) {
      fail(
        "INVALID_POSITION",
        `${path}.${axis}`,
        "坐标必须是大于或等于零的有限数字。",
        "声明 position: { x, y }；坐标原点由当前图表的布局规则定义。",
      );
    }
  }
  return { x: value.x as number, y: value.y as number };
}

function alignment(value: unknown, path: string, self: string): Alignment {
  fields(value, ["with", "axis"], path);
  const target = identifier(value.with, `${path}.with`);
  if (target === self)
    fail("ALIGNMENT_SELF", `${path}.with`, "节点不能与自身对齐。", "选择同一容器内的另一个节点。");
  const axis = alignmentAxes.find((axis) => axis === value.axis);
  if (axis === undefined)
    fail(
      "INVALID_ALIGNMENT_AXIS",
      `${path}.axis`,
      "对齐轴必须是 x 或 y。",
      "x 对齐水平中心 cx，用于垂直直连；y 对齐垂直中心 cy，用于水平直连。",
    );
  return { with: target, axis };
}

function placement(
  node: Record<string, unknown>,
  path: string,
  self: string,
): { position?: Position; align?: Alignment } {
  if (node.align !== undefined && node.position !== undefined)
    fail(
      "ALIGNMENT_POSITION_CONFLICT",
      `${path}.align`,
      "position 已固定节点坐标，与 align 冲突。",
      "保留 position，或改用 align 让布局推导对齐坐标。",
    );
  return {
    ...(node.position === undefined
      ? {}
      : { position: position(node.position, `${path}.position`) }),
    ...(node.align === undefined ? {} : { align: alignment(node.align, `${path}.align`, self) }),
  };
}

function normalizeAppearance(
  node: Record<string, unknown>,
  path: string,
): Appearance<Entity, Role> {
  return {
    entity: normalizeEntity(node.entity, `${path}.entity`),
    ...(node.role === undefined ? {} : { role: normalizeRole(node.role, `${path}.role`) }),
  };
}

function participants(nodes: unknown, path: string): SequenceParticipant<Entity, Role>[] {
  return collect(array(nodes, path), (node, i) => {
    const p = `${path}[${i}]`;
    fields(node, ["entity", "role", "partition"], p);
    return {
      ...normalizeAppearance(node, p),
      ...(node.partition === undefined
        ? {}
        : { partition: identifier(node.partition, `${p}.partition`) }),
    };
  });
}

function architectureNodes(nodes: unknown, path: string): ArchitectureNode<Entity, Role>[] {
  return collect(array(nodes, path), (node, i) => {
    const p = `${path}[${i}]`;
    fields(node, ["entity", "role", "partition", "position", "align"], p);
    const appearance = normalizeAppearance(node, p);
    return {
      ...appearance,
      ...(node.partition === undefined
        ? {}
        : { partition: identifier(node.partition, `${p}.partition`) }),
      ...placement(node, p, appearance.entity.id),
    };
  });
}

function architecturePartitions(values: unknown, path: string): ArchitecturePartition[] {
  return collect(array(values, path, { empty: true }), (value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "label", "position"], p);
    return {
      id: identifier(value.id, `${p}.id`),
      label: shortText(value.label, `${p}.label`, 48),
      ...(value.position === undefined
        ? {}
        : { position: position(value.position, `${p}.position`) }),
    };
  });
}

function sequencePartitions(values: unknown, path: string): SequencePartition[] {
  return collect(array(values, path, { empty: true }), (value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "label"], p);
    return {
      id: identifier(value.id, `${p}.id`),
      label: shortText(value.label, `${p}.label`, 48),
    };
  });
}

function relationVariant(value: unknown, path: string): RelationVariant {
  if (value === undefined) return "default";
  if (!relationVariants.some((variant) => variant === value))
    fail(
      "INVALID_RELATION_VARIANT",
      path,
      "关系样式必须使用预设名称。",
      `可用样式：${relationVariants.join(", ")}。`,
    );
  return value as RelationVariant;
}

function relationSide(value: unknown, path: string): RelationSide {
  const side = relationSides.find((side) => side === value);
  if (side === undefined)
    fail(
      "INVALID_RELATION_SIDE",
      path,
      "连接边必须是 top、right、bottom 或 left。",
      "声明起点或终点的矩形边；省略字段时由算法选择。",
    );
  return side;
}

function edges(values: unknown, path: string) {
  return collect(array(values, path, { empty: true }), (value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "from", "to", "label", "variant", "fromSide", "toSide"], p);
    const relation = {
      id: identifier(value.id, `${p}.id`),
      from: identifier(value.from, `${p}.from`),
      to: identifier(value.to, `${p}.to`),
      label: string(value.label, `${p}.label`),
      variant: relationVariant(value.variant, `${p}.variant`),
      ...(value.fromSide === undefined
        ? {}
        : { fromSide: relationSide(value.fromSide, `${p}.fromSide`) }),
      ...(value.toSide === undefined ? {} : { toSide: relationSide(value.toSide, `${p}.toSide`) }),
    };
    if (relation.from === relation.to && relation.fromSide && relation.fromSide === relation.toSide)
      fail(
        "RELATION_SIDE_CONFLICT",
        `${p}.toSide`,
        "自循环的起点和终点不能使用同一条连接边。",
        "为 fromSide 和 toSide 选择不同的边，或省略其中一个字段。",
      );
    return relation;
  });
}

function messageKind(value: unknown, path: string): MessageKind {
  if (value === undefined) return "sync";
  const kind = messageKinds.find((kind) => kind === value);
  if (kind === undefined)
    fail(
      "INVALID_MESSAGE_KIND",
      path,
      "消息行为必须是 sync、async 或 reply。",
      "按是否等待响应选择 sync 或 async；响应用 reply。",
    );
  return kind;
}

function messageVariant(value: unknown, path: string): MessageVariant {
  if (value === undefined) return "default";
  const variant = messageVariants.find((variant) => variant === value);
  if (variant === undefined)
    fail(
      "INVALID_MESSAGE_VARIANT",
      path,
      "消息样式必须使用时序图的视觉预设。",
      `可用预设：${messageVariants.join(", ")}。`,
    );
  return variant;
}

function messages(values: unknown, path: string): Message[] {
  return collect(array(values, path), (value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "from", "to", "label", "replyTo", "kind", "variant"], p);
    const kind = messageKind(value.kind, `${p}.kind`);
    const variant = messageVariant(value.variant, `${p}.variant`);
    if (kind === "reply" && value.replyTo === undefined)
      fail(
        "MISSING_REPLY",
        `${p}.replyTo`,
        "响应必须关联原消息。",
        "用 replyTo 指定先前消息的标识。",
      );
    if (kind !== "reply" && value.replyTo !== undefined)
      fail(
        "UNEXPECTED_REPLY",
        `${p}.replyTo`,
        "只有 reply 消息可以声明 replyTo。",
        '将响应的 kind 设为 "reply"，或移除 replyTo。',
      );
    return {
      id: identifier(value.id, `${p}.id`),
      from: identifier(value.from, `${p}.from`),
      to: identifier(value.to, `${p}.to`),
      label: string(value.label, `${p}.label`),
      kind,
      variant,
      ...(value.replyTo === undefined
        ? {}
        : { replyTo: identifier(value.replyTo, `${p}.replyTo`) }),
    };
  });
}

function architectureDirection(value: unknown, path: string): ArchitectureDirection {
  if (value === undefined) return "vertical";
  const direction = architectureDirections.find((direction) => direction === value);
  if (direction === undefined)
    fail(
      "INVALID_DIRECTION",
      path,
      "布局方向必须是 vertical 或 horizontal。",
      "层级依赖用 vertical，并列职责的横向比较用 horizontal。",
    );
  return direction;
}

export function architecture(options: ArchitectureOptions): ArchitectureChart<Entity, Role> {
  fields(options, ["id", "meta", "nodes", "partitions", "relations", "direction"], "architecture");
  return diagram({
    kind: "architecture",
    id: identifier(options.id, "architecture.id"),
    meta: chartMeta(options.meta, "architecture.meta"),
    direction: architectureDirection(options.direction, "architecture.direction"),
    nodes: architectureNodes(options.nodes, "architecture.nodes"),
    partitions: architecturePartitions(options.partitions ?? [], "architecture.partitions"),
    relations: edges(options.relations, "architecture.relations"),
  });
}

export function sequence(options: SequenceOptions): SequenceChart<Entity, Role> {
  fields(options, ["id", "meta", "participants", "partitions", "messages"], "sequence");
  return diagram({
    kind: "sequence",
    id: identifier(options.id, "sequence.id"),
    meta: chartMeta(options.meta, "sequence.meta"),
    participants: participants(options.participants, "sequence.participants"),
    partitions: sequencePartitions(options.partitions ?? [], "sequence.partitions"),
    messages: messages(options.messages, "sequence.messages"),
  });
}

export function swimlane(options: SwimlaneOptions): SwimlaneChart<Entity, Role> {
  fields(options, ["id", "meta", "lanes", "nodes", "relations"], "swimlane");
  return diagram({
    kind: "swimlane",
    id: identifier(options.id, "swimlane.id"),
    meta: chartMeta(options.meta, "swimlane.meta"),
    lanes: collect(array(options.lanes, "swimlane.lanes"), (lane, i) => {
      const p = `swimlane.lanes[${i}]`;
      fields(lane, ["id", "label"], p);
      return {
        id: identifier(lane.id, `${p}.id`),
        label: shortText(lane.label, `${p}.label`, 48),
      };
    }),
    nodes: collect(array(options.nodes, "swimlane.nodes"), (node, i) => {
      const p = `swimlane.nodes[${i}]`;
      fields(node, ["entity", "role", "lane", "position", "align"], p);
      const appearance = normalizeAppearance(node, p);
      return {
        ...appearance,
        lane: identifier(node.lane, `${p}.lane`),
        ...placement(node, p, appearance.entity.id),
      };
    }),
    relations: edges(options.relations, "swimlane.relations"),
  });
}

export function semanticDiagram(value: Diagram): SemanticDiagram {
  if (!isDiagram(value))
    fail(
      "INVALID_DIAGRAM",
      "diagram",
      "需要 SDK 创建的图表。",
      "使用 architecture、sequence 或 swimlane。",
    );
  const entities = new Map<string, Entity>();
  const roles = new Map<string, Role>();
  const register = <T extends { readonly id: string }>(
    registry: Map<string, T>,
    item: T,
    path: string,
  ) => {
    if (registry.has(item.id) && JSON.stringify(registry.get(item.id)) !== JSON.stringify(item))
      fail(
        "IDENTITY_CONFLICT",
        path,
        `标识符 ${item.id} 存在不同定义。`,
        "复用同一个定义，或为不同对象分配不同标识符。",
      );
    registry.set(item.id, item);
  };
  const appearance = (node: Appearance<Entity, Role>) => {
    register(entities, node.entity, `diagram.${node.entity.id}`);
    if (node.role) register(roles, node.role, `diagram.${node.entity.id}.role`);
    return { entity: node.entity.id, role: node.role?.id ?? defaultRole.id };
  };
  const chart =
    value.kind === "sequence"
      ? {
          ...value,
          participants: value.participants.map((node) => ({
            ...appearance(node),
            ...(node.partition === undefined ? {} : { partition: node.partition }),
          })),
        }
      : value.kind === "swimlane"
        ? {
            ...value,
            nodes: value.nodes.map((node) => ({
              ...appearance(node),
              ...(node.position === undefined ? {} : { position: node.position }),
              ...(node.align === undefined ? {} : { align: node.align }),
              lane: node.lane,
            })),
          }
        : {
            ...value,
            nodes: value.nodes.map((node) => ({
              ...appearance(node),
              ...(node.partition === undefined ? {} : { partition: node.partition }),
              ...(node.position === undefined ? {} : { position: node.position }),
              ...(node.align === undefined ? {} : { align: node.align }),
            })),
          };
  return freeze({
    version: 1,
    entities: [...entities.values()].sort((a, b) => a.id.localeCompare(b.id, "en")),
    roles: [...roles.values()].sort((a, b) => a.id.localeCompare(b.id, "en")),
    chart,
  });
}

export const isDiagram = (value: unknown): value is Diagram =>
  typeof value === "object" && value !== null && diagrams.has(value);
