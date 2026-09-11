import type { Diagnostic, AddDiagnostic } from "./diagnostics.ts";
import type { Relation, SemanticDocument } from "./model.ts";
import { DiagnosticError } from "./diagnostics.ts";
import { links } from "./markdown.ts";
import { theme } from "./design.ts";
import { validateSequence } from "./validate-sequence.ts";

export function validate(doc: SemanticDocument): SemanticDocument {
  const diagnostics: Diagnostic[] = [];
  const add: AddDiagnostic = (code, path, message, hint) =>
    diagnostics.push({ code, path, message, hint });
  const diagrams = new Set();
  const entities = new Set(doc.entities.map((e) => e.id));
  const tags = new Map();
  for (const entity of doc.entities) {
    for (const tag of entity.tags) {
      if (tags.has(tag.id) && tags.get(tag.id) !== tag.label) {
        add(
          "TAG_IDENTITY_CONFLICT",
          `entity.${entity.id}.tags.${tag.id}`,
          `标签 ${tag.id} 在文档中有不同名称。`,
          "复用相同标签定义，或为不同分类使用不同标识。",
        );
      }
      tags.set(tag.id, tag.label);
    }
  }
  if (!doc.blocks.length)
    add("EMPTY_DOCUMENT", "document", "文档没有内容。", "追加 Markdown 或图表。");
  if (doc.roles.length > theme.palette.length)
    add(
      "ROLE_CAPACITY",
      "document.roles",
      `角色超过 ${theme.palette.length} 种，无法保持颜色可辨认。`,
      "合并相同职责，或将独立主题拆成不同文档。",
    );
  for (const [index, block] of doc.blocks.entries()) {
    if (block.kind !== "diagram") continue;
    const chart = block.content;
    const path = `blocks[${index}].diagram[${chart.id}]`;
    if (diagrams.has(chart.id))
      add("DUPLICATE_DIAGRAM", path, "图表标识重复。", "为每个图表使用唯一标识。");
    diagrams.add(chart.id);
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
    const edge = (value: Relation) => {
      const p = `${path}.${value.id}`;
      if (seen.has(value.id))
        add(
          "DUPLICATE_RELATION",
          p,
          "关系或步骤标识重复。",
          "为每条关系、消息和条件分支设置唯一标识。",
        );
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
    if (chart.kind === "architecture") {
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
            "在 partitions 中声明该逻辑分区。实体不能充当分区。",
          );
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
  }
  const textSources = doc.blocks.flatMap((block, index) =>
    block.kind === "markdown"
      ? [{ content: block.content, path: `blocks[${index}].markdown` }]
      : [],
  );
  for (const source of textSources) {
    for (const href of links(source.content)) {
      const [kind, id] = href.split(":");
      if (kind === "entity" && !entities.has(id))
        add(
          "UNKNOWN_REFERENCE",
          source.path,
          `未找到对象 ${id}。`,
          "引用至少一张图中已声明的对象。",
        );
      if (kind === "diagram" && !diagrams.has(id))
        add("UNKNOWN_REFERENCE", source.path, `未找到图表 ${id}。`, "检查 diagram: 后的图表标识。");
    }
  }
  if (diagnostics.length) throw new DiagnosticError(diagnostics);
  return doc;
}
