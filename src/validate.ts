import type { Diagnostic, AddDiagnostic } from "./diagnostics.ts";
import type { SemanticDiagram } from "./model.ts";
import { DiagnosticError } from "./diagnostics.ts";
import { theme } from "./design.ts";
import { validateSequence } from "./sequence/validate.ts";

export function validate(doc: SemanticDiagram): SemanticDiagram {
  const diagnostics: Diagnostic[] = [];
  const add: AddDiagnostic = (code, path, message, hint) =>
    diagnostics.push({ code, path, message, hint });
  const tags = new Map();
  for (const entity of doc.entities) {
    for (const tag of entity.tags) {
      if (tags.has(tag.id) && tags.get(tag.id) !== tag.label) {
        add(
          "TAG_IDENTITY_CONFLICT",
          `entity.${entity.id}.tags.${tag.id}`,
          `标签 ${tag.id} 在图表中有不同名称。`,
          "复用相同标签定义，或为不同分类使用不同标识。",
        );
      }
      tags.set(tag.id, tag.label);
    }
  }
  if (doc.roles.length > theme.palette.length)
    add(
      "ROLE_CAPACITY",
      "diagram.roles",
      `角色超过 ${theme.palette.length} 种，无法保持颜色可辨认。`,
      "合并相同职责，或将独立主题拆成不同图表。",
    );
  const chart = doc.chart;
  const path = `diagram[${chart.id}]`;
  const nodes = chart.kind === "sequence" ? chart.participants : chart.nodes;
  const ids = new Set();
  for (const node of nodes) {
    if (ids.has(node.entity))
      add(
        "DUPLICATE_NODE",
        `${path}.${node.entity}`,
        "同一对象在此图中重复出现。",
        "每张图只声明一次对象，再通过多条关系引用。",
      );
    ids.add(node.entity);
  }
  const max = chart.kind === "sequence" ? 6 : 12;
  if (nodes.length > max)
    add(
      "NODE_CAPACITY",
      path,
      `此类图最多支持 ${max} 个对象。`,
      "按系统边界或流程阶段拆图，保持文字可读。",
    );
  const seen = new Set();
  const edge = (value: { id: string; from: string; to: string }) => {
    const p = `${path}.${value.id}`;
    if (seen.has(value.id))
      add("DUPLICATE_RELATION", p, "关系或消息标识重复。", "为每条关系或消息设置唯一标识。");
    seen.add(value.id);
    for (const key of ["from", "to"] as const)
      if (!ids.has(value[key]))
        add(
          "UNKNOWN_ENDPOINT",
          `${p}.${key}`,
          `对象 ${value[key]} 未出现在当前图表中。`,
          "先将该对象加入 nodes 或 participants。",
        );
  };
  if (chart.kind !== "swimlane") {
    const partitionIds = new Set<string>();
    for (const partition of chart.partitions) {
      if (partitionIds.has(partition.id))
        add(
          "DUPLICATE_PARTITION",
          `${path}.partitions.${partition.id}`,
          "分区标识重复。",
          "为本图每个逻辑分区使用唯一标识。",
        );
      partitionIds.add(partition.id);
    }
  }
  if (chart.kind === "architecture") {
    const partitionIds = new Set(chart.partitions.map((partition) => partition.id));
    for (const partition of chart.partitions) {
      if (!chart.nodes.some((node) => node.partition === partition.id))
        add(
          "EMPTY_PARTITION",
          `${path}.partitions.${partition.id}`,
          "分区没有包含节点。",
          "为节点声明 partition，或移除空分区。",
        );
    }
    for (const node of chart.nodes) {
      if (node.partition && !partitionIds.has(node.partition))
        add(
          "UNKNOWN_PARTITION",
          `${path}.${node.entity}.partition`,
          `分区 ${node.partition} 不在图中。`,
          "在 partitions 中声明该分区。实体不能充当分区。",
        );
    }
  }
  if (chart.kind === "sequence") {
    const partitionIds = new Set(chart.partitions.map((partition) => partition.id));
    for (const partition of chart.partitions) {
      if (!chart.messages.some((message) => message.partition === partition.id))
        add(
          "EMPTY_PARTITION",
          `${path}.partitions.${partition.id}`,
          "分区没有包含消息。",
          "为消息声明 partition，或移除空分区。",
        );
    }
    for (const message of chart.messages) {
      if (message.partition && !partitionIds.has(message.partition))
        add(
          "UNKNOWN_PARTITION",
          `${path}.${message.id}.partition`,
          `分区 ${message.partition} 不在图中。`,
          "在 partitions 中声明该逻辑分区。实体不能充当分区。",
        );
    }
  }
  if (chart.kind !== "sequence") {
    // Alignment targets must be placed by the same placement run, so both ends
    // share one partition, lane or the root content area.
    const byId = new Map(chart.nodes.map((node) => [node.entity, node]));
    const containerOf = new Map(
      chart.kind === "architecture"
        ? chart.nodes.map((node) => [node.entity, node.partition ?? ""] as const)
        : chart.nodes.map((node) => [node.entity, node.lane] as const),
    );
    for (const node of chart.nodes) {
      if (node.align === undefined) continue;
      const target = byId.get(node.align.with);
      if (target === undefined) {
        add(
          "UNKNOWN_ALIGNMENT",
          `${path}.${node.entity}.align.with`,
          `对齐目标 ${node.align.with} 未出现在当前图表中。`,
          "选择同一容器内的节点标识。",
        );
      } else if (containerOf.get(node.entity) !== containerOf.get(target.entity)) {
        add(
          "ALIGNMENT_CONTAINER",
          `${path}.${node.entity}.align.with`,
          `节点 ${node.entity} 与对齐目标 ${target.entity} 不在同一容器。`,
          "架构图要求双方在同一分区或同在未分组区域，泳道图要求在同一泳道；跨容器对齐改用 position。",
        );
      }
    }
    for (const node of chart.nodes) {
      if (node.align === undefined) continue;
      const seen = new Set([node.entity]);
      let target = byId.get(node.align.with);
      while (target?.align) {
        if (seen.has(target.entity)) {
          add(
            "ALIGNMENT_CYCLE",
            `${path}.${target.entity}.align.with`,
            "对齐声明形成循环。",
            "让对齐链条的末端指向一个没有 align 的节点。",
          );
          break;
        }
        seen.add(target.entity);
        target = byId.get(target.align.with);
      }
    }
  }
  if (chart.kind === "swimlane") {
    const laneIds = new Set<string>();
    for (const lane of chart.lanes) {
      if (laneIds.has(lane.id))
        add(
          "DUPLICATE_LANE",
          `${path}.lanes.${lane.id}`,
          "泳道标识重复。",
          "为本图每条泳道使用唯一标识。",
        );
      laneIds.add(lane.id);
      if (!chart.nodes.some((node) => node.lane === lane.id))
        add(
          "EMPTY_LANE",
          `${path}.lanes.${lane.id}`,
          "泳道没有包含节点。",
          "为流程节点声明 lane，或移除空泳道。",
        );
    }
    for (const node of chart.nodes) {
      if (!laneIds.has(node.lane))
        add(
          "UNKNOWN_LANE",
          `${path}.${node.entity}.lane`,
          `泳道 ${node.lane} 不在图中。`,
          "在 lanes 中声明该泳道；每个节点必须属于一条泳道。",
        );
    }
  }
  if (chart.kind === "sequence") {
    for (const partition of chart.partitions) {
      const indices = chart.messages.flatMap((message, index) =>
        message.partition === partition.id ? [index] : [],
      );
      if (indices.length && indices.at(-1)! - indices[0] + 1 !== indices.length)
        add(
          "NONCONTIGUOUS_PARTITION",
          `${path}.partitions.${partition.id}`,
          "同一时序分区的消息必须连续排列。",
          "调整 messages 的声明顺序，把同一分区的消息放在一起。",
        );
    }
    validateSequence(chart, path, add, edge);
  } else {
    const values = chart.relations;
    values.forEach(edge);
    if (values.length > 16)
      add(
        "RELATION_CAPACITY",
        path,
        "图表超过 16 条关系。",
        "按解释重点拆图，保留所有关系的含义。",
      );
  }

  if (diagnostics.length) throw new DiagnosticError(diagnostics);
  return doc;
}
