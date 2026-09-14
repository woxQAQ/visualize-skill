import type {
  LayoutContext,
  MessageVariant,
  RelationVariant,
  SemanticDiagram,
  TextLayout,
} from "./model.ts";
import { freeze, fail } from "./diagnostics.ts";

export const theme = freeze({
  ink: "var(--foreground)",
  muted: "var(--muted-foreground)",
  line: "var(--muted-foreground)",
  border: "var(--border)",
  surface: "var(--background)",
  subtle: "color-mix(in srgb, var(--foreground) 4%, var(--background))",
  font: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: 14,
  lineHeight: 22,
  maxWidth: 1280,
  maxHeight: 2600,
  palette: Array.from({ length: 6 }, (_, index) => ({
    ink: `var(--viz-series-${index + 1})`,
    fill: `color-mix(in srgb, var(--viz-series-${index + 1}) 10%, var(--background))`,
  })),
});

export const relationStyles: Readonly<
  Record<
    RelationVariant,
    { ink: string; width: number; dash: string; weight: number; arrow: "filled" | "open" }
  >
> = freeze({
  default: { ink: "var(--viz-series-1)", width: 1.5, dash: "none", weight: 400, arrow: "filled" },
  emphasis: { ink: "var(--viz-series-5)", width: 2.5, dash: "none", weight: 600, arrow: "filled" },
  security: { ink: "var(--red)", width: 1.5, dash: "none", weight: 400, arrow: "filled" },
  dashed: { ink: "var(--viz-series-1)", width: 1.5, dash: "5 4", weight: 400, arrow: "filled" },
  external: {
    ink: "var(--viz-series-3)",
    width: 1.5,
    dash: "8 3 2 3",
    weight: 400,
    arrow: "filled",
  },
  return: { ink: theme.muted, width: 1.5, dash: "5 4", weight: 400, arrow: "open" },
});

export const messageStyles: Readonly<
  Record<
    MessageVariant,
    { ink: string; width: number; dash: string; weight: number; arrow: "filled" | "open" }
  >
> = freeze({
  default: { ink: theme.ink, width: 1.5, dash: "none", weight: 400, arrow: "filled" },
  dashed: { ink: theme.ink, width: 1.5, dash: "8 4", weight: 400, arrow: "open" },
  emphasis: { ink: "var(--viz-series-5)", width: 2.5, dash: "none", weight: 600, arrow: "filled" },
  return: { ink: theme.muted, width: 1.5, dash: "5 4", weight: 400, arrow: "open" },
  security: { ink: "var(--red)", width: 1.5, dash: "none", weight: 400, arrow: "filled" },
});

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
const words = new Intl.Segmenter("en", { granularity: "word" });
export const graphemes = (text: string) => [...segmenter.segment(text)].map((item) => item.segment);

// Fixed advances are also supplied to SVG textLength. Layout and paint share
// the same widths, independent of the host's glyph-width substitutions.
export function advance(grapheme: string, size = theme.fontSize) {
  // eslint-disable-next-line no-control-regex -- This range intentionally covers all ASCII code points.
  if (/^[\x00-\x7f]+$/.test(grapheme)) return size * 0.62;
  return size;
}
export const measure = (text: string, size = theme.fontSize) =>
  graphemes(text).reduce((sum, g) => sum + advance(g, size), 0);

export function wrap(
  text: string,
  width: number,
  path: string,
  maxLines = 6,
  size = theme.fontSize,
): TextLayout {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const paragraphStart = lines.length;
    let line = "";
    // Preserve words when they fit, while allowing identifiers and CJK to wrap.
    for (const { segment: token } of words.segment(paragraph)) {
      if (line && measure(line + token, size) > width && measure(token, size) <= width) {
        lines.push(line.trimEnd());
        line = "";
      }
      for (const g of graphemes(token)) {
        if (line && measure(line + g, size) > width) {
          lines.push(line.trimEnd());
          line = "";
        }
        if (!line && /^\s+$/.test(g)) continue;
        line += g;
      }
    }
    lines.push(line.trimEnd());
    // Keep a lone Han character with the preceding word when both lines fit.
    // Rebalance within a paragraph, preserving explicit breaks and whole words.
    const last = lines.length - 1;
    if (last > paragraphStart && /^\p{Script=Han}$/u.test(lines[last])) {
      const previous = lines[last - 1];
      const word = [...words.segment(previous)].at(-1)!;
      const prefix = previous.slice(0, word.index).trimEnd();
      const tail = word.segment + lines[last];
      // A short middle line is preferable to a lone final character, but
      // balancing must not leave the first line with only one character.
      const minimumPrefixLength = last - 1 === paragraphStart ? 2 : 1;
      if (
        /^\p{Script=Han}+$/u.test(word.segment) &&
        graphemes(prefix).length >= minimumPrefixLength &&
        measure(tail, size) <= width
      ) {
        lines[last - 1] = prefix;
        lines[last] = tail;
      }
    }
  }
  if (lines.length > maxLines)
    fail(
      "LABEL_CAPACITY",
      path,
      `文字需要 ${lines.length} 行，超过 ${maxLines} 行的可读范围。`,
      "缩短图内名称或调整节点宽度；复杂关系应拆图表达。",
    );
  return {
    lines,
    width: Math.max(0, ...lines.map((line) => measure(line, size))),
    height: lines.length * theme.lineHeight,
    size,
  };
}

export function context(doc: SemanticDiagram): LayoutContext {
  return {
    entities: new Map(doc.entities.map((entity) => [entity.id, entity])),
    colors: new Map(doc.roles.map((role, index) => [role.id, theme.palette[index]])),
  };
}
// Retain node details for later use while keeping the current diagrams focused on relationships.
export const nodeDetailsEnabled = false;
