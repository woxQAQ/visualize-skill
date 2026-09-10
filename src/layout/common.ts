import type { LayoutContext, NodeLayout, Participant, Point, Scene } from '../model.js';
import { theme, wrap } from '../design.js';
import { fail } from '../diagnostics.js';

export function nodeBox(node: Participant, ctx: LayoutContext, x: number, y: number, { description = true } = {}): NodeLayout {
  const entity = ctx.entities.get(node.entity)!;
  const { width, height } = node.size;
  if (width <= 32) {
    fail('NODE_CONTENT_FIT', `node.${entity.id}.size.width`, '节点宽度不足以容纳文字和内边距。', '增加 size.width；节点左右各保留 16 像素内边距。');
  }
  const title = wrap(entity.label, width - 32, `entity.${entity.id}.label`, 3);
  const detail = description && entity.description ? wrap(entity.description, width - 32, `entity.${entity.id}.description`, 4, 12) : null;
  const contentHeight = 28 + title.height + (detail ? detail.height + 6 : 0);
  if (contentHeight > height || title.width > width - 32 || (detail && detail.width > width - 32)) {
    fail('NODE_CONTENT_FIT', `node.${entity.id}.size`, `节点 ${entity.id} 的内容无法放入声明的 ${width} × ${height} 尺寸。`, `当前文字至少需要 ${contentHeight} 像素高度。增加宽高或缩短图内摘要，系统不会自动放大节点或截断文字。`);
  }
  return { id: entity.id, role: node.role, x, y, width, height, contentHeight, title, detail };
}

export function finish<T extends Scene>(scene: T): T {
  if (scene.width > theme.maxWidth || scene.height > theme.maxHeight) {
    fail('LAYOUT_CAPACITY', `diagram.${scene.id}`, `布局为 ${Math.ceil(scene.width)} × ${Math.ceil(scene.height)}，超出 ${theme.maxWidth} × ${theme.maxHeight} 的阅读范围。`, '拆分图表或缩短说明，不要缩小字体。');
  }
  return scene;
}

export function path(points: readonly Point[]) {
  return points.map(([x, y], index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
}
