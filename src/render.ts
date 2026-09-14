import type { Diagram, SemanticDiagram } from "./model.ts";
import { context, nodeDetailsEnabled } from "./design.ts";
import { layoutArchitecture } from "./layout/architecture.ts";
import { layoutSequence } from "./layout/sequence.ts";
import { layoutSwimlane } from "./layout/swimlane.ts";
import { validate } from "./validate.ts";
import { semanticDiagram } from "./sdk.ts";
import { escape } from "./markup.ts";
import { renderSvg } from "./render-svg.ts";
import { interactionScript, pageStylesheet, renderTemplate, stylesheet } from "./templates.ts";

function entityDetails(semantic: SemanticDiagram) {
  const { chart } = semantic;
  const roles = new Map(semantic.roles.map((role) => [role.id, role.label]));
  const entities = new Map(semantic.entities.map((entity) => [entity.id, entity]));
  const link = (id: string) =>
    `<a href="#entity-${chart.id}-${id}" data-locate-node="entity-${chart.id}-${id}">${escape(entities.get(id)!.label)}</a>`;
  return semantic.entities
    .map((entity) => {
      const node = (chart.kind === "sequence" ? chart.participants : chart.nodes).find(
        (node) => node.entity === entity.id,
      )!;
      const partition =
        chart.kind === "architecture"
          ? chart.partitions.find(
              (partition) =>
                partition.id === chart.nodes.find((node) => node.entity === entity.id)?.partition,
            )
          : undefined;
      const lane =
        chart.kind === "swimlane"
          ? chart.lanes.find(
              (lane) => lane.id === chart.nodes.find((node) => node.entity === entity.id)?.lane,
            )
          : undefined;
      const related = (
        chart.kind === "sequence"
          ? chart.messages.filter((message) => message.variant !== "return")
          : chart.relations
      ).filter((relation) => relation.from === entity.id || relation.to === entity.id);
      const rows = related
        .map((relation) => {
          const outgoing = relation.from === entity.id;
          const self = relation.from === relation.to;
          return `<tr><td>${self ? "内部" : outgoing ? "发出" : "接收"}</td><td>${self ? escape(entity.label) : link(outgoing ? relation.to : relation.from)}</td><td>${escape(relation.label)}</td></tr>`;
        })
        .join("");
      return renderTemplate("entity", {
        id: entity.id,
        label: entity.label,
        description: entity.description ? `<p>${escape(entity.description)}</p>` : "",
        role: roles.get(node.role)!,
        membership: partition
          ? `<div><dt>所属分区</dt><dd>${escape(partition.label)}</dd></div>`
          : lane
            ? `<div><dt>所属泳道</dt><dd>${escape(lane.label)}</dd></div>`
            : "",
        tags: entity.tags.length
          ? renderTemplate("entity-tags", {
              items: entity.tags
                .map((tag) => `<li data-tag="${tag.id}">${escape(tag.label)}</li>`)
                .join(""),
            })
          : "",
        relations: rows ? renderTemplate("entity-relations", { rows }) : "",
      });
    })
    .join("");
}

export function compile(diagram: Diagram) {
  const semantic = validate(semanticDiagram(diagram));
  const ctx = context(semantic);
  const chart = semantic.chart;
  const scene =
    chart.kind === "architecture"
      ? layoutArchitecture(chart, ctx)
      : chart.kind === "sequence"
        ? layoutSequence(chart, ctx)
        : layoutSwimlane(chart, ctx);
  return { semantic, scene };
}

export function render(diagram: Diagram) {
  const { semantic, scene } = compile(diagram);
  const ctx = context(semantic);
  const chart = semantic.chart;
  const legend = semantic.roles
    .map((role) => {
      const color = ctx.colors.get(role.id)!;
      return `<span><i aria-hidden="true" style="--role-color:${color.ink};--role-fill:${color.fill}"></i>${escape(role.label)}</span>`;
    })
    .join("");
  const rootId = `visualize-${chart.id}`;
  return renderTemplate("widget", {
    rootId,
    nodeDetails: nodeDetailsEnabled ? "enabled" : "disabled",
    stylesheet,
    content: renderTemplate("figure", {
      id: chart.id,
      title: chart.title,
      legend,
      svg: renderSvg(scene, chart, ctx),
    }),
    details: entityDetails(semantic),
    script: interactionScript.replace("__ROOT_ID__", rootId),
  });
}

export function renderPage(diagram: Diagram): string {
  const content = render(diagram);
  return renderTemplate("page", {
    title: diagram.title,
    stylesheet: pageStylesheet,
    content,
  });
}
