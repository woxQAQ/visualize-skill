import type {
  ArchitectureChart,
  ArchitectureNode,
  ArchitectureOptions,
  Block,
  Diagram,
  Entity,
  EntityInput,
  Participant,
  ArchitecturePartition,
  Position,
  Role,
  SemanticDocument,
  SequenceChart,
  SequenceOptions,
  Size,
  Step,
  SwimlaneChart,
  SwimlaneOptions,
  Tag,
} from "./model.ts";
import { array, fail, fields, freeze, identifier, string } from "./diagnostics.ts";
import { parseMarkdown } from "./markdown.ts";

const diagrams = new WeakSet<object>();
function diagram<T extends Diagram>(value: T): T {
  freeze(value);
  diagrams.add(value);
  return value;
}

function shortText(input: unknown, path: string, limit: number): string {
  const value = string(input, path);
  if (value !== value.trim() || /[\r\n\t]/.test(value) || Array.from(value).length > limit) {
    fail(
      "INVALID_SHORT_TEXT",
      path,
      `此字段需要单行短文本，最多 ${limit} 个字符。`,
      "填写名称或简短摘要；正文解释应放在报告中，不要塞入节点属性。",
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

function dimension(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(
      "INVALID_SIZE",
      path,
      "尺寸必须是大于零的有限数字。",
      "声明正数尺寸，系统会检查内容是否放得下。",
    );
  }
  return value;
}

function size(value: unknown, path: string): Size {
  fields(value, ["width", "height"], path);
  return {
    width: dimension(value.width, `${path}.width`),
    height: dimension(value.height, `${path}.height`),
  };
}

function normalizeAppearance(
  node: Record<string, unknown>,
  path: string,
): Participant<Entity, Role> {
  return {
    entity: normalizeEntity(node.entity),
    role: normalizeRole(node.role),
    size: size(node.size, `${path}.size`),
  };
}

function participants(nodes: unknown, path: string): Participant<Entity, Role>[] {
  return array(nodes, path).map((node, i) => {
    const p = `${path}[${i}]`;
    fields(node, ["entity", "role", "size"], p);
    return normalizeAppearance(node, p);
  });
}

function architectureNodes(nodes: unknown, path: string): ArchitectureNode<Entity, Role>[] {
  return array(nodes, path).map((node, i) => {
    const p = `${path}[${i}]`;
    fields(node, ["entity", "role", "partition", "position", "size"], p);
    return {
      ...normalizeAppearance(node, p),
      position: position(node.position, `${p}.position`),
      ...(node.partition === undefined
        ? {}
        : { partition: identifier(node.partition, `${p}.partition`) }),
    };
  });
}

function architecturePartitions(values: unknown, path: string): ArchitecturePartition[] {
  return array(values, path, { empty: true }).map((value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "label", "position", "size"], p);
    return {
      id: identifier(value.id, `${p}.id`),
      label: shortText(value.label, `${p}.label`, 48),
      position: position(value.position, `${p}.position`),
      size: size(value.size, `${p}.size`),
    };
  });
}

function edges(values: unknown, path: string) {
  return array(values, path, { empty: true }).map((value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "from", "to", "label"], p);
    return {
      id: identifier(value.id, `${p}.id`),
      from: ref(value.from, `${p}.from`),
      to: ref(value.to, `${p}.to`),
      label: string(value.label, `${p}.label`),
    };
  });
}

function steps(values: unknown, path: string, depth = 0): Step[] {
  if (depth > 3) fail("SEQUENCE_DEPTH", path, "条件分支超过三层。", "将深层条件拆成独立时序图。");
  return array(values, path).map((value, i) => {
    const p = `${path}[${i}]`;
    fields(value, ["id", "kind", "branches", "from", "to", "label", "replyTo"], p);
    if (value.kind === "alternative") {
      fields(value, ["id", "kind", "branches"], p);
      const branches = array(value.branches, `${p}.branches`);
      if (branches.length < 2)
        fail(
          "INVALID_ALTERNATIVE",
          p,
          "条件分支至少需要两个分支。",
          "声明条件成立和不成立时的消息。",
        );
      return {
        id: identifier(value.id, `${p}.id`),
        kind: "alternative",
        branches: branches.map((branch, j) => {
          fields(branch, ["label", "steps"], `${p}.branches[${j}]`);
          return {
            label: string(branch.label, `${p}.branches[${j}].label`),
            steps: steps(branch.steps, `${p}.branches[${j}].steps`, depth + 1),
          };
        }),
      };
    }
    fields(value, ["id", "from", "to", "label", "replyTo"], p);
    const message = {
      id: identifier(value.id, `${p}.id`),
      from: ref(value.from, `${p}.from`),
      to: ref(value.to, `${p}.to`),
      label: string(value.label, `${p}.label`),
    };
    return value.replyTo === undefined
      ? { ...message, kind: "call" }
      : { ...message, kind: "return", replyTo: ref(value.replyTo, `${p}.replyTo`) };
  });
}

export function architecture(options: ArchitectureOptions): ArchitectureChart<Entity, Role> {
  fields(options, ["id", "title", "nodes", "partitions", "relations"], "architecture");
  return diagram({
    kind: "architecture",
    id: identifier(options.id, "architecture.id"),
    title: string(options.title, "architecture.title"),
    nodes: architectureNodes(options.nodes, "architecture.nodes"),
    partitions: architecturePartitions(options.partitions ?? [], "architecture.partitions"),
    relations: edges(options.relations, "architecture.relations"),
  });
}

export function sequence(options: SequenceOptions): SequenceChart<Entity, Role> {
  fields(options, ["id", "title", "participants", "steps"], "sequence");
  return diagram({
    kind: "sequence",
    id: identifier(options.id, "sequence.id"),
    title: string(options.title, "sequence.title"),
    participants: participants(options.participants, "sequence.participants"),
    steps: steps(options.steps, "sequence.steps"),
  });
}

export function swimlane(options: SwimlaneOptions): SwimlaneChart<Entity, Role> {
  fields(
    options,
    ["id", "title", "width", "headerWidth", "lanes", "nodes", "relations"],
    "swimlane",
  );
  return diagram({
    kind: "swimlane",
    id: identifier(options.id, "swimlane.id"),
    title: string(options.title, "swimlane.title"),
    width: dimension(options.width, "swimlane.width"),
    headerWidth: dimension(
      options.headerWidth === undefined ? 144 : options.headerWidth,
      "swimlane.headerWidth",
    ),
    lanes: array(options.lanes, "swimlane.lanes").map((lane, i) => {
      const p = `swimlane.lanes[${i}]`;
      fields(lane, ["id", "label", "height"], p);
      return {
        id: identifier(lane.id, `${p}.id`),
        label: shortText(lane.label, `${p}.label`, 48),
        height: dimension(lane.height, `${p}.height`),
      };
    }),
    nodes: array(options.nodes, "swimlane.nodes").map((node, i) => {
      const p = `swimlane.nodes[${i}]`;
      fields(node, ["entity", "role", "lane", "position", "size"], p);
      return {
        ...normalizeAppearance(node, p),
        lane: identifier(node.lane, `${p}.lane`),
        position: position(node.position, `${p}.position`),
      };
    }),
    relations: edges(options.relations, "swimlane.relations"),
  });
}

export class Document {
  #blocks: readonly Block<Diagram>[];
  constructor(blocks: readonly Block<Diagram>[] = []) {
    this.#blocks = freeze(blocks);
    Object.freeze(this);
  }
  markdown(source: string) {
    return new Document([
      ...this.#blocks,
      {
        kind: "markdown",
        content: parseMarkdown(source, `blocks[${this.#blocks.length}].markdown`),
      },
    ]);
  }
  diagram(value: Diagram) {
    if (!diagrams.has(value))
      fail(
        "INVALID_DIAGRAM",
        "document.diagram",
        "需要 SDK 创建的图表。",
        "使用 architecture、sequence 或 swimlane。",
      );
    return new Document([...this.#blocks, { kind: "diagram", content: structuredClone(value) }]);
  }
  toJSON(): SemanticDocument {
    const entities = new Map<string, Entity>();
    const roles = new Map<string, Role>();
    const collect = <T extends { readonly id: string }>(
      registry: Map<string, T>,
      value: T,
      path: string,
    ) => {
      if (
        registry.has(value.id) &&
        JSON.stringify(registry.get(value.id)) !== JSON.stringify(value)
      )
        fail(
          "IDENTITY_CONFLICT",
          path,
          `标识符 ${value.id} 存在不同定义。`,
          "复用同一个对象定义，或为不同对象分配不同标识符。",
        );
      registry.set(value.id, value);
    };
    const blocks: Block[] = this.#blocks.map((block, i) => {
      if (block.kind === "markdown") return block;
      const chart = block.content;
      const appearance = (node: Participant<Entity, Role>) => {
        collect(entities, node.entity, `blocks[${i}].${node.entity.id}`);
        collect(roles, node.role, `blocks[${i}].${node.entity.id}.role`);
        return { entity: node.entity.id, role: node.role.id, size: node.size };
      };
      if (chart.kind === "sequence") {
        return {
          kind: "diagram",
          content: { ...chart, participants: chart.participants.map(appearance) },
        };
      }
      if (chart.kind === "swimlane") {
        return {
          kind: "diagram",
          content: {
            ...chart,
            nodes: chart.nodes.map((node) => ({
              ...appearance(node),
              position: node.position,
              lane: node.lane,
            })),
          },
        };
      }
      return {
        kind: "diagram",
        content: {
          ...chart,
          nodes: chart.nodes.map((node) => ({
            ...appearance(node),
            position: node.position,
            ...(node.partition ? { partition: node.partition } : {}),
          })),
        },
      };
    });
    return freeze({
      version: 1,
      entities: [...entities.values()].sort((a, b) => a.id.localeCompare(b.id, "en")),
      roles: [...roles.values()].sort((a, b) => a.id.localeCompare(b.id, "en")),
      blocks,
    });
  }
}

export const document = () => new Document();
export const isDocument = (value: unknown): value is Document => value instanceof Document;
