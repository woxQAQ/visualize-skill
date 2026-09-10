import type { LayoutContext, SemanticDocument, TextLayout } from './model.js';
import { freeze, fail } from './diagnostics.js';

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

export const stylesheet = `
:root{color-scheme:light;color:#252b30;background:#f4f3ef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-size:16px;line-height:1.75}
*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:0 auto;padding:56px 28px 80px;background:#fff;min-height:100vh}main.single{padding-top:28px}
.prose{max-width:760px}h1,h2,h3,h4,h5,h6{line-height:1.35;font-weight:650;letter-spacing:-.02em}h1{font-size:34px;margin:0 0 24px}h2{font-size:24px;margin:40px 0 16px}h3{font-size:19px;margin:28px 0 12px}p{margin:16px 0}li{padding-left:3px;margin:5px 0}a{color:#285c88;text-underline-offset:3px}a:focus-visible,summary:focus-visible,.diagram-scroll:focus-visible{outline:2px solid #285c88;outline-offset:4px}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.88em;background:#f1f3f5;padding:2px 4px;border-radius:3px}pre{overflow:auto;padding:20px;background:#f5f6f7;border:1px solid #dce0e3;line-height:1.6}pre code{background:none;padding:0}p,li{overflow-wrap:anywhere}
figure{margin:30px 0 38px;padding:22px 0 16px;border-top:1px solid #c6ccd0;border-bottom:1px solid #c6ccd0}figcaption{font-size:18px;font-weight:650;line-height:1.5}.legend{display:flex;flex-wrap:wrap;gap:10px 24px;margin:12px 0 14px;font-size:12px;color:#5b646c}.legend span{display:inline-flex;align-items:center;gap:7px}.legend i{width:10px;height:10px;display:inline-block;border:1px solid var(--role-color);background:var(--role-fill)}.diagram-scroll{overflow:auto;overscroll-behavior-x:contain;padding:0 0 8px}.diagram-scroll svg{display:block;max-width:none}details{font-size:13px;color:#5b646c;margin-top:12px}summary{cursor:pointer;width:fit-content}details li{margin:3px 0}svg [data-entity]:target rect{stroke-width:3}footer{font-size:12px;color:#5b646c;margin-top:40px}
@media(max-width:640px){main{padding:28px 18px 48px}h1{font-size:28px}h2{font-size:22px}figure{margin:24px 0}.legend{gap:8px 16px}}
.node-link{cursor:pointer;text-decoration:none}.node-link:hover .node-surface{stroke:var(--node-color);stroke-width:2;fill:var(--node-hover-fill)}.node-link:focus-visible{outline:none}.node-link:focus-visible .node-surface{stroke:#285c88;stroke-width:3;fill:var(--node-hover-fill)}.interactive .entity-notes{display:none}
.detail-dialog{width:min(680px,calc(100vw - 32px));max-height:calc(100dvh - 48px);padding:28px 32px;border:1px solid #b6bdc4;border-radius:6px;background:white;color:#252b30;line-height:1.75;overscroll-behavior:contain}.detail-dialog::backdrop{background:rgb(20 28 35 / 35%)}.detail-dialog form{display:flex;justify-content:flex-end;margin:0 0 4px}.detail-dialog button{font:inherit;font-size:14px;padding:5px 16px;border:1px solid #b6bdc4;border-radius:4px;background:white;color:#252b30;cursor:pointer}.detail-dialog button:focus-visible{outline:2px solid #285c88;outline-offset:3px}.detail-dialog h2{margin:0 0 12px;font-size:26px}.detail-dialog h3{margin-top:24px}.detail-dialog article:focus{outline:none}
.entity-facts{margin:12px 0}.entity-facts div{display:grid;grid-template-columns:88px minmax(0,1fr);gap:12px;margin:6px 0}.entity-facts dt{color:#5b646c}.entity-facts dd{margin:0;overflow-wrap:anywhere}.entity-tags{display:flex;flex-wrap:wrap;gap:8px;list-style:none;padding:0}.entity-tags li{border:1px solid #c6ccd0;border-radius:3px;padding:2px 9px;margin:0;font-size:14px}.entity-context{margin-top:28px}.entity-relations{border-collapse:collapse;width:100%;table-layout:fixed;font-size:14px}.entity-relations th,.entity-relations td{text-align:left;padding:8px;border-bottom:1px solid #dce0e3;vertical-align:top;overflow-wrap:anywhere}.entity-relations th:first-child{width:52px}.entity-relations th{font-weight:600;color:#5b646c}
@media(max-width:640px){.detail-dialog{padding:20px;width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}}
@media print{:root{background:#fff}main{padding:0;max-width:none}figure{break-inside:avoid}.diagram-scroll{overflow:visible}.diagram-scroll svg{max-width:100%;height:auto}details{display:none}a{color:inherit}footer{display:none}}
`;
