import type { LayoutContext, SemanticDocument, TextLayout } from './model.ts';
import { freeze, fail } from './diagnostics.ts';

export const theme = freeze({
  ink: '#252b30', muted: '#5b646c', line: '#707983', border: '#c6ccd0',
  font: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 14, lineHeight: 22, maxWidth: 1280, maxHeight: 2600,
  palette: [
    { ink: '#285c88', fill: '#edf4fa' },
    { ink: '#855018', fill: '#fbf2e5' },
    { ink: '#246757', fill: '#edf6f2' },
    { ink: '#824568', fill: '#f8eff4' },
    { ink: '#62509b', fill: '#f2eff8' },
    { ink: '#555e68', fill: '#f0f2f4' }
  ]
});

const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
const words = new Intl.Segmenter('en', { granularity: 'word' });
export const graphemes = (text: string) => [...segmenter.segment(text)].map(item => item.segment);

// Fixed advances are also supplied to SVG textLength. Layout and paint share
// the same widths, independent of the host's glyph-width substitutions.
export function advance(grapheme: string, size = theme.fontSize) {
  if (/^[\x00-\x7f]+$/.test(grapheme)) return size * 0.62;
  return size;
}
export const measure = (text: string, size = theme.fontSize) => graphemes(text).reduce((sum, g) => sum + advance(g, size), 0);

export function wrap(text: string, width: number, path: string, maxLines = 6, size = theme.fontSize): TextLayout {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    // Preserve words when they fit, while allowing identifiers and CJK to wrap.
    for (const { segment: token } of words.segment(paragraph)) {
      if (line && measure(line + token, size) > width && measure(token, size) <= width) {
        lines.push(line.trimEnd()); line = '';
      }
      for (const g of graphemes(token)) {
        if (line && measure(line + g, size) > width) { lines.push(line.trimEnd()); line = ''; }
        if (!line && /^\s+$/.test(g)) continue;
        line += g;
      }
    }
    lines.push(line.trimEnd());
  }
  if (lines.length > maxLines) fail('LABEL_CAPACITY', path, `文字需要 ${lines.length} 行，超过 ${maxLines} 行的可读范围。`, '缩短图内名称或调整节点宽度；复杂关系应拆图表达。');
  return { lines, width: Math.max(0, ...lines.map(line => measure(line, size))), height: lines.length * theme.lineHeight, size };
}

export function context(doc: SemanticDocument): LayoutContext {
  return {
    entities: new Map(doc.entities.map(entity => [entity.id, entity])),
    colors: new Map(doc.roles.map((role, index) => [role.id, theme.palette[index]]))
  };
}
