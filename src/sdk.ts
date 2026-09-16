import type {
  ArchitectureChart,
  ArchitectureNode,
  ArchitectureOptions,
  ArchitecturePartition,
} from "./architecture/index.ts";
import type { Diagram, SemanticDiagram } from "./model.ts";
import type {
  ChartMeta,
  Entity,
  EntityInput,
  Participant,
  Position,
  Role,
  RelationVariant,
  RelationSide,
  Tag,
} from "./shared/model.ts";
import type {
  SequenceChart,
  SequenceParticipant,
  SequencePartition,
  SequenceOptions,
  Message,
  MessageVariant,
  MessageKind,
} from "./sequence/index.ts";
import type { SwimlaneChart, SwimlaneOptions } from "./swimlane/index.ts";
import { messageKinds, messageVariants } from "./sequence/index.ts";
import { relationSides, relationVariants } from "./shared/model.ts";
import { array, fail, fields, freeze, identifier, string } from "./diagnostics.ts";

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
  return values.map((value, index) => {
    const p = `${path}[${index}]`;
    fields(value, ["id", "label"], p);
    const id = identifier(value.id, `${p}.id`);
    if (seen.has(id)) fail("DUPLICATE_TAG", p, `标签 ${id} 重复。`, "同一对象只声明一次相同标签。");
    seen.add(id);
    return { id, label: shortText(value.label, `${p}.label`, 24) };
  });
}

export function entity(options: EntityInput): Entity {
  return normalizeEntity(options);
}

function normalizeEntity(options: unknown): Entity {
  fields(options, ["id", "label", "description", "tags"], "entity");
  const value = freeze({
    id: identifier(options.id, "entity.id"),
    label: string(options.label, "entity.label"),
    ...(options.description === undefined
      ? {}
      : { description: shortText(options.description, `entity.${options.id}.description`, 80) }),
    tags: tags(options.tags ?? [], `entity.${options.id}.tags`),
  });
  return value;
}

export function role(options: Role): Role {
  return normalizeRole(options);
}

function normalizeRole(options: unknown): Role {
  fields(options, ["id", "label"], "role");
  return freeze({
    id: identifier(options.id, "role.id"),
    label: string(options.label, "role.label"),
  });
}

function ref(value: unknown, path: string): string {
  if (typeof value === "string") return identifier(value, path);
  fields(value, ["id", "label", "description", "tags"], path);
  return identifier(value.id, path);
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

function normalizeAppearance(node: Record<string, unknown>): Participant<Entity, Role> {
  return {
    entity: normalizeEntity(node.entity),
    role: normalizeRole(node.role),
  };
}

function participants(nodes: unknown, path: string): SequenceParticipant<Entity, Role>[] {
  return array(nodes, path).map((node, i) => {
    const p = `${path}[${i}]`;
    fields(node, ["entity", "role", "partition"], p);
    return {
      ...normalizeAppearance(node),
      ...(node.partition === undefined
        ? {}
        : { partition: identifier(node.partition, `${p}.partition`) }),
    };
  });
}

function architectureNodes(nodes: unknown, path: string): ArchitectureNode<Entity, Role>[] {
  return array(nodes, path).map((node, i) => {
    const p = `${path}[${i}]`;
    fields(node, ["entity", "role", "position"], p);
    return {
      ...normalizeAppearance(node),
      ...(node.position === undefined
        ? {}
        : { position: position(node.position, `${p}.position`) }),
    };
  });
}

function architecturePartitions(values: unknown, path: string): ArchitecturePartition[] {
  return array(values, path, { empty: true }).map((value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "label", "nodes", "position"], p);
    return {
      id: identifier(value.id, `${p}.id`),
      label: shortText(value.label, `${p}.label`, 48),
      nodes: array(value.nodes, `${p}.nodes`, { empty: true }).map((node, index) =>
        ref(node, `${p}.nodes[${index}]`),
      ),
      ...(value.position === undefined
        ? {}
        : { position: position(value.position, `${p}.position`) }),
    };
  });
}

function sequencePartitions(values: unknown, path: string): SequencePartition[] {
  return array(values, path, { empty: true }).map((value, i) => {
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
  return array(values, path, { empty: true }).map((value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "from", "to", "label", "variant", "fromSide", "toSide"], p);
    const relation = {
      id: identifier(value.id, `${p}.id`),
      from: ref(value.from, `${p}.from`),
      to: ref(value.to, `${p}.to`),
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
  return array(values, path).map((value, i) => {
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
      from: ref(value.from, `${p}.from`),
      to: ref(value.to, `${p}.to`),
      label: string(value.label, `${p}.label`),
      kind,
      variant,
      ...(value.replyTo === undefined
        ? {}
        : { replyTo: identifier(value.replyTo, `${p}.replyTo`) }),
    };
  });
}

export function architecture(options: ArchitectureOptions): ArchitectureChart<Entity, Role> {
  fields(options, ["id", "meta", "nodes", "partitions", "relations"], "architecture");
  return diagram({
    kind: "architecture",
    id: identifier(options.id, "architecture.id"),
    meta: chartMeta(options.meta, "architecture.meta"),
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
    lanes: array(options.lanes, "swimlane.lanes").map((lane, i) => {
      const p = `swimlane.lanes[${i}]`;
      fields(lane, ["id", "label"], p);
      return {
        id: identifier(lane.id, `${p}.id`),
        label: shortText(lane.label, `${p}.label`, 48),
      };
    }),
    nodes: array(options.nodes, "swimlane.nodes").map((node, i) => {
      const p = `swimlane.nodes[${i}]`;
      fields(node, ["entity", "role", "lane", "position"], p);
      return {
        ...normalizeAppearance(node),
        lane: identifier(node.lane, `${p}.lane`),
        ...(node.position === undefined
          ? {}
          : { position: position(node.position, `${p}.position`) }),
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
  const collect = <T extends { readonly id: string }>(
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
  const appearance = (node: Participant<Entity, Role>) => {
    collect(entities, node.entity, `diagram.${node.entity.id}`);
    collect(roles, node.role, `diagram.${node.entity.id}.role`);
    return { entity: node.entity.id, role: node.role.id };
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
              lane: node.lane,
            })),
          }
        : {
            ...value,
            nodes: value.nodes.map((node) => ({
              ...appearance(node),
              ...(node.position === undefined ? {} : { position: node.position }),
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
