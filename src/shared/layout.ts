import type { Participant } from "../types.ts";
import type { LayoutContext, NodeLayout, Point } from "./model.ts";
import type { Scene } from "../model.ts";
import { theme, wrap, measure } from "../design.ts";
import { fail } from "../diagnostics.ts";

export function nodeBox(
  node: Participant<string, string>,
  ctx: LayoutContext,
  x: number,
  y: number,
  { description = true } = {},
): NodeLayout {
  const entity = ctx.entities.get(node.entity)!;
  const textWidth = Math.max(
    ...entity.label.split("\n").map((line) => measure(line)),
    description && entity.description ? measure(entity.description, 12) : 0,
  );
  const width = Math.ceil(
    Math.max(description ? 160 : 120, Math.min(description ? 280 : 160, textWidth + 32)),
  );
  const title = wrap(entity.label, width - 32, `entity.${entity.id}.label`, 3);
  const detail =
    description && entity.description
      ? wrap(entity.description, width - 32, `entity.${entity.id}.description`, 4, 12)
      : null;
  const contentHeight = 28 + title.height + (detail ? detail.height + 6 : 0);
  const height = Math.max(56, contentHeight);
  return { id: entity.id, role: node.role, x, y, width, height, contentHeight, title, detail };
}

export function finish<T extends Scene>(scene: T): T {
  if (scene.width > theme.maxWidth || scene.height > theme.maxHeight) {
    fail(
      "LAYOUT_CAPACITY",
      `diagram.${scene.id}`,
      `布局为 ${Math.ceil(scene.width)} × ${Math.ceil(scene.height)}，超出 ${theme.maxWidth} × ${theme.maxHeight} 的阅读范围。`,
      "拆分图表或缩短说明，不要缩小字体。",
    );
  }
  return scene;
}

export function path(points: readonly Point[]) {
  return points.map(([x, y], index) => `${index ? "L" : "M"} ${x} ${y}`).join(" ");
}
