import type { Call, SemanticDocument, Step } from "./model.ts";
import type { Document } from "./sdk.ts";
import { context } from "./design.ts";
import { plainText } from "./markdown.ts";
import { layoutArchitecture } from "./layout/architecture.ts";
import { layoutSequence } from "./layout/sequence.ts";
import { layoutSwimlane } from "./layout/swimlane.ts";
import { validate } from "./validate.ts";
import { isDocument } from "./sdk.ts";
import { fail } from "./diagnostics.ts";
import { escape } from "./markup.ts";
import { renderMarkdown } from "./render-markdown.ts";
import { renderSvg } from "./render-svg.ts";
import { interactionScript, renderTemplate, stylesheet } from "./templates.ts";

function entityNotes(semantic: SemanticDocument) {
  const roles = new Map(semantic.roles.map((role) => [role.id, role.label]));
  const entities = new Map(semantic.entities.map((entity) => [entity.id, entity]));
  const charts = semantic.blocks
    .filter((block) => block.kind === "diagram")
    .map((block) => block.content);
  const link = (id: string, chart: string) =>
    `<a href="#entity-${chart}-${id}" data-locate-node="entity-${chart}-${id}" title="在当前图中定位此节点">${escape(entities.get(id)!.label)}</a>`;
  const calls = (steps: readonly Step[]): Call[] =>
    steps.flatMap((step) =>
      step.kind === "alternative"
        ? step.branches.flatMap((branch) => calls(branch.steps))
        : step.kind === "call"
          ? [step]
          : [],
    );
  const notes = semantic.entities
    .map((entity) => {
      const locations: string[] = [];
      const appearances = charts.flatMap((chart) => {
        const node = (chart.kind === "sequence" ? chart.participants : chart.nodes).find(
          (node) => node.entity === entity.id,
        );
        if (!node) return [];
        const target = `entity-${chart.id}-${entity.id}`;
        locations.push(
          `<li data-location-chart="${chart.id}"><a href="#${target}" data-locate-node="${target}">在「${escape(chart.title)}」中定位此节点</a></li>`,
        );
        const partitionId =
          chart.kind === "architecture"
            ? chart.nodes.find((item) => item.entity === entity.id)?.partition
            : undefined;
        const partition =
          chart.kind === "architecture"
            ? chart.partitions.find((item) => item.id === partitionId)
            : undefined;
        const laneId =
          chart.kind === "swimlane"
            ? chart.nodes.find((item) => item.entity === entity.id)?.lane
            : undefined;
        const lane =
          chart.kind === "swimlane" ? chart.lanes.find((item) => item.id === laneId) : undefined;
        const related = (chart.kind === "sequence" ? calls(chart.steps) : chart.relations).filter(
          (relation) => relation.from === entity.id || relation.to === entity.id,
        );
        const rows = related
          .map((relation) => {
            const outgoing = relation.from === entity.id;
            const self = relation.from === relation.to;
            const direction = self ? "内部" : outgoing ? "发出" : "接收";
            return `<tr><td>${direction}</td><td>${self ? escape(entity.label) : link(outgoing ? relation.to : relation.from, chart.id)}</td><td>${escape(relation.label)}</td></tr>`;
          })
          .join("");
        return [
          renderTemplate("entity-context", {
            chartId: chart.id,
            title: chart.title,
            role: roles.get(node.role)!,
            membership: partition
              ? `<div><dt>所属分区</dt><dd>${escape(partition.label)}</dd></div>`
              : lane
                ? `<div><dt>所属泳道</dt><dd>${escape(lane.label)}</dd></div>`
                : "",
            relations: rows ? renderTemplate("entity-relations", { rows }) : "",
          }),
        ];
      });
      return renderTemplate("entity", {
        id: entity.id,
        label: entity.label,
        tags: entity.tags.length
          ? renderTemplate("entity-tags", {
              items: entity.tags
                .map((tag) => `<li data-tag="${tag.id}">${escape(tag.label)}</li>`)
                .join(""),
            })
          : "",
        appearances: appearances.join(""),
        locations: locations.length
          ? renderTemplate("entity-locations", { items: locations.join("") })
          : "",
      });
    })
    .join("");
  return renderTemplate("entity-notes", { entities: notes });
}

export function compile(document: Document) {
  if (!isDocument(document)) {
    fail(
      "INVALID_DOCUMENT",
      "export.default",
      "默认导出必须是 SDK 的 document() 结果。",
      "使用 export default document().markdown(...).diagram(...)。",
    );
  }
  const semantic = validate(document.toJSON());
  const ctx = context(semantic);
  const scenes = semantic.blocks
    .filter((block) => block.kind === "diagram")
    .map(({ content }) => {
      switch (content.kind) {
        case "architecture":
          return layoutArchitecture(content, ctx);
        case "sequence":
          return layoutSequence(content, ctx);
        case "swimlane":
          return layoutSwimlane(content, ctx);
      }
    });
  return { semantic, scenes };
}

export function render(document: Document) {
  const { semantic, scenes } = compile(document);
  const ctx = context(semantic);
  const firstHeading = semantic.blocks
    .flatMap((block) => (block.kind === "markdown" ? block.content : []))
    .find((block) => block.kind === "heading");
  const title = firstHeading
    ? plainText(firstHeading.children)
    : (semantic.blocks.find((block) => block.kind === "diagram")?.content.title ?? "可视化报告");
  const single = semantic.blocks.length === 1 && semantic.blocks[0].kind === "diagram";
  let sceneIndex = 0,
    headingIndex = 0;
  const nextHeading = () => ++headingIndex;

  const content = semantic.blocks
    .map((block) => {
      if (block.kind === "markdown")
        return `<section class="prose">${renderMarkdown(block.content, nextHeading)}</section>`;
      const chart = block.content;
      const roleIds = new Set(
        (chart.kind === "sequence" ? chart.participants : chart.nodes).map((node) => node.role),
      );
      const legend = semantic.roles
        .filter((role) => roleIds.has(role.id))
        .map((role) => {
          const color = ctx.colors.get(role.id)!;
          return `<span><i aria-hidden="true" style="--role-color:${color.ink};--role-fill:${color.fill}"></i>${escape(role.label)}</span>`;
        })
        .join("");
      return renderTemplate("figure", {
        id: chart.id,
        title: chart.title,
        legend,
        svg: renderSvg(scenes[sceneIndex++], chart, ctx),
      });
    })
    .join("\n");

  const hasEntities = semantic.entities.length > 0;
  return renderTemplate("document", {
    title,
    stylesheet,
    mainClass: single ? "single" : "",
    content,
    notes: hasEntities ? entityNotes(semantic) : "",
    dialog: hasEntities ? renderTemplate("dialog", { script: interactionScript }) : "",
  });
}
