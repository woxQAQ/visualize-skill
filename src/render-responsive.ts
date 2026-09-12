import type { Chart, LayoutContext, Relation, Scene, SequenceChart, Step } from "./model.ts";
import { DiagnosticError } from "./diagnostics.ts";
import { escape } from "./markup.ts";
import { nodeDetailsEnabled } from "./design.ts";
import { responsiveArchitecture, responsiveSwimlane } from "./layout/responsive.ts";
import { layoutSequence } from "./layout/sequence.ts";
import { renderSvg } from "./render-svg.ts";

export interface ResponsiveView {
  id: string;
  minimumWidth: number;
  scene: Scene | null;
  relationKey?: readonly Relation[];
}

export function responsiveViews(
  chart: Chart,
  ctx: LayoutContext,
  original: Scene,
): ResponsiveView[] {
  const views: ResponsiveView[] = [
    { id: chart.id, minimumWidth: Math.ceil(original.width), scene: original },
  ];
  for (const width of [288, 432, 576, 704]) {
    if (width >= original.width) continue;
    let scene: Scene;
    let relationKey: readonly Relation[] | undefined;
    if (chart.kind === "sequence") {
      try {
        scene = layoutSequence(chart, ctx, width);
      } catch (error) {
        if (
          !(error instanceof DiagnosticError) ||
          !error.diagnostics.every(({ code }) =>
            [
              "LABEL_CAPACITY",
              "NODE_CONTENT_FIT",
              "SEQUENCE_LABEL_SPACE",
              "LAYOUT_CAPACITY",
            ].includes(code),
          )
        )
          throw error;
        continue;
      }
      if (scene.width > width + 0.001) continue;
    } else {
      try {
        scene =
          chart.kind === "architecture"
            ? responsiveArchitecture(chart, ctx, width)
            : responsiveSwimlane(chart, ctx, width);
      } catch (error) {
        if (
          !(error instanceof DiagnosticError) ||
          !error.diagnostics.every(({ code }) => code === "RELATION_LAYOUT")
        )
          throw error;
        relationKey = chart.relations;
        const relations = chart.relations.map((relation, index) => ({
          ...relation,
          label: String(index + 1),
        }));
        scene =
          chart.kind === "architecture"
            ? responsiveArchitecture({ ...chart, relations }, ctx, width)
            : responsiveSwimlane({ ...chart, relations }, ctx, width);
      }
    }
    const id = `${chart.id}-width-${width}`;
    views.push({ id, minimumWidth: width, scene: { ...scene, id }, relationKey });
  }
  if (chart.kind === "sequence" && views.every((view) => view.minimumWidth > 288)) {
    views.push({ id: `${chart.id}-calls`, minimumWidth: 0, scene: null });
  }
  return views;
}

function sequenceTrace(chart: SequenceChart, ctx: LayoutContext, id: string) {
  let count = 0;
  const callNumbers = new Map<string, number>();
  const rules: string[] = [];
  const participants = new Map(chart.participants.map((node) => [node.entity, node]));
  const node = (entityId: string) => {
    const entity = ctx.entities.get(entityId)!;
    const color = ctx.colors.get(participants.get(entityId)!.role)!;
    return `<span data-entity="${entityId}" style="--node-color:${color.ink};--node-fill:${color.fill}"><a class="node-link node-surface" ${nodeDetailsEnabled ? `href="#details-${entityId}"` : 'role="group"'} data-entity-detail="details-${entityId}" tabindex="0" aria-label="${escape(entity.label)}">${escape(entity.label)}</a></span>`;
  };
  const steps = (items: readonly Step[]): string =>
    items
      .map((step) => {
        if (step.kind === "alternative") {
          return `<li class="trace-alternative" data-fragment="${step.id}"><div class="trace-alternative-label">条件分支（择一）</div>${step.branches.map((branch) => `<section class="trace-branch"><h3>${escape(branch.label)}</h3><ol class="trace-steps">${steps(branch.steps)}</ol></section>`).join("")}</li>`;
        }
        const number = ++count;
        if (step.kind === "call") callNumbers.set(step.id, number);
        const kind =
          step.kind === "return" ? `返回第 ${callNumbers.get(step.replyTo)} 次调用` : "同步调用";
        const triggers = [...new Set([step.from, step.to])]
          .map((entity) => `[data-entity="${entity}"] .node-link:is(:hover,:focus-visible)`)
          .join(",");
        rules.push(`#diagram-${id}:has(${triggers}) [data-relation="${step.id}"] { opacity:1; }`);
        return `<li class="trace-step${step.kind === "return" ? " trace-return" : ""}" data-relation="${step.id}"${step.kind === "return" ? ` data-reply-to="${step.replyTo}"` : ""}>
      <div class="trace-label">${number}. ${escape(step.label)}<span class="trace-kind">${kind}</span></div>
      <div class="trace-endpoints">${node(step.from)}<span class="trace-arrow" aria-hidden="true"></span>${node(step.to)}</div>
    </li>`;
      })
      .join("");
  const content = steps(chart.steps);
  return `<div class="sequence-trace" role="group" aria-label="${escape(chart.title)}，按顺序逐条显示调用和返回">
    <style>@media screen { #diagram-${id}:has(.node-link:is(:hover,:focus-visible)) .trace-step { opacity:0.45; } ${rules.join("\n")} }</style>
    <ol class="trace-steps">${content}</ol>
  </div>`;
}

export function renderResponsive(chart: Chart, ctx: LayoutContext, original: Scene) {
  const views = responsiveViews(chart, ctx, original);
  const ordered = [...views].sort((a, b) => a.minimumWidth - b.minimumWidth);
  const rules = [`#view-${ordered[0].id} { display:block; }`];
  for (let index = 1; index < ordered.length; index++) {
    const view = ordered[index];
    rules.push(
      `@container (min-width:${view.minimumWidth}px) { #view-${ordered[index - 1].id} { display:none; } #view-${view.id} { display:block; } }`,
    );
  }
  return (
    views
      .map((view) => {
        let content = view.scene
          ? renderSvg(view.scene, { ...chart, id: view.id }, ctx)
          : sequenceTrace(chart as SequenceChart, ctx, view.id);
        if (view.relationKey)
          content += `<section class="relation-key" aria-label="关系图例"><h3>关系图例</h3><ol>${view.relationKey.map((relation) => `<li data-relation-key="${relation.id}">${escape(relation.label)}<span>${escape(ctx.entities.get(relation.from)!.label)} → ${escape(ctx.entities.get(relation.to)!.label)}</span></li>`).join("")}</ol></section>`;
        const scoped =
          view.id === chart.id ? content : `<div id="diagram-${view.id}">${content}</div>`;
        return `<div id="view-${view.id}" class="diagram-layout" data-layout-width="${view.minimumWidth}">${scoped}</div>`;
      })
      .join("\n") + `<style data-responsive-layout>${rules.join("\n")}</style>`
  );
}
