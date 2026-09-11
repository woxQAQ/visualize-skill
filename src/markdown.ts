import { fail, string } from "./diagnostics.ts";
import type { Inline, MarkdownBlock, TableAlignment } from "./model.ts";
import { linkTarget, parseInline, referenceId } from "./markdown-inline.ts";
import type { LinkTarget, SourceLine } from "./markdown-inline.ts";

type Draft =
  | { kind: "paragraph" | "heading"; lines: SourceLine[]; level: number }
  | { kind: "codeBlock"; text: string; language: string }
  | { kind: "table"; align: TableAlignment[]; header: SourceLine[]; rows: SourceLine[][] }
  | { kind: "thematicBreak" }
  | { kind: "blockquote"; children: Draft[] }
  | { kind: "list"; ordered: boolean; start: number; tight: boolean; items: Draft[][] };
const fence = (text: string) => /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(text);
const heading = (text: string) => /^ {0,3}(#{1,6})(?:[ \t]+(.*)|[ \t]*)$/.exec(text);
const setext = (text: string) => /^ {0,3}(=+|-+)[ \t]*$/.exec(text);
const rule = (text: string) =>
  /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/.test(text);
const quote = (text: string) => /^ {0,3}>[ \t]?(.*)$/.exec(text);
const definition = (text: string) => /^ {0,3}\[([^\]]+)\]:[ \t]*(.+)$/.exec(text);
function listMarker(text: string) {
  const match = /^( {0,3})([-+*]|\d{1,9}[.)])([ \t]+|$)(.*)$/.exec(text);
  if (!match) return null;
  return {
    ordered: /^\d/.test(match[2]),
    start: /^\d/.test(match[2]) ? parseInt(match[2], 10) : 1,
    marker: match[2].slice(-1),
    indent: match[1].length,
    contentIndent: match[1].length + match[2].length + (match[3].length || 1),
    text: match[4],
  };
}

// Only unescaped pipes separate cells, including inside inline code.
function tableCells(text: string): string[] | null {
  const source = text.trim();
  const cells: string[] = [];
  let cell = "";
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\\" && i + 1 < source.length) {
      cell += source[i + 1] === "|" ? source[++i] : source[i] + source[++i];
    } else if (source[i] === "|") {
      cells.push(cell.trim());
      cell = "";
    } else cell += source[i];
  }
  if (!cells.length) return null;
  cells.push(cell.trim());
  if (source.startsWith("|")) cells.shift();
  if (cells.at(-1) === "") cells.pop();
  return cells;
}

function tableHeader(rows: readonly SourceLine[], index: number) {
  const header = tableCells(rows[index].text);
  const separators = rows[index + 1] && tableCells(rows[index + 1].text);
  if (
    !header?.length ||
    !separators ||
    header.length !== separators.length ||
    !separators.every((cell) => /^:?-{3,}:?$/.test(cell))
  )
    return null;
  const align: TableAlignment[] = separators.map((cell) =>
    cell.startsWith(":")
      ? cell.endsWith(":")
        ? "center"
        : "left"
      : cell.endsWith(":")
        ? "right"
        : null,
  );
  return { header: header.map((text) => ({ ...rows[index], text })), align };
}

// Blocks retain source lines until definitions are collected, so references can
// point forward without scanning code examples or losing diagnostic locations.
export function parseMarkdown(source: string, sourcePath = "markdown"): readonly MarkdownBlock[] {
  string(source, sourcePath);
  const original = source.replace(/\r\n?/g, "\n").split("\n");
  const indent = Math.min(
    ...original.filter((line) => line.trim()).map((line) => /^ */.exec(line)![0].length),
  );
  const lines = original.map((line, index) => ({
    text: line.slice(Math.min(indent, /^ */.exec(line)![0].length)),
    number: index + 1,
  }));
  const definitions = new Map<string, LinkTarget>();
  const startsBlock = (text: string) =>
    !!(
      fence(text) ||
      heading(text) ||
      rule(text) ||
      quote(text) ||
      listMarker(text) ||
      definition(text)
    );
  const blocks = (rows: readonly SourceLine[], depth = 0): Draft[] => {
    if (depth > 32)
      fail(
        "MARKDOWN_DEPTH",
        `${sourcePath}.line[${rows[0].number}]`,
        "块结构嵌套超过 32 层。",
        "减少列表或引用块的嵌套。",
      );
    const result: Draft[] = [];
    let i = 0;
    while (i < rows.length) {
      const row = rows[i],
        text = row.text;
      if (!text.trim()) {
        i++;
        continue;
      }
      const opening = fence(text);
      if (opening && !(opening[1][0] === "`" && opening[2].includes("`"))) {
        const content: string[] = [];
        const openingIndent = /^ */.exec(text)![0].length;
        i++;
        while (i < rows.length) {
          const closing = /^ {0,3}(`+|~+)[ \t]*$/.exec(rows[i].text);
          if (
            closing &&
            closing[1][0] === opening[1][0] &&
            closing[1].length >= opening[1].length
          ) {
            i++;
            break;
          }
          content.push(rows[i++].text.replace(new RegExp(`^ {0,${openingIndent}}`), ""));
        }
        result.push({
          kind: "codeBlock",
          language: opening[2].trim().split(/\s+/)[0],
          text: content.join("\n"),
        });
        continue;
      }
      if (/^( {4}|\t)/.test(text)) {
        const content: string[] = [];
        while (i < rows.length && (!rows[i].text.trim() || /^( {4}|\t)/.test(rows[i].text)))
          content.push(rows[i++].text.replace(/^( {4}|\t)/, ""));
        while (content.at(-1) === "") content.pop();
        result.push({ kind: "codeBlock", language: "", text: content.join("\n") });
        continue;
      }
      const def = definition(text);
      const target = def ? linkTarget(def[2], 0, false) : null;
      if (def && target) {
        const id = referenceId(def[1]);
        if (!definitions.has(id)) definitions.set(id, target);
        i++;
        continue;
      }
      const atx = heading(text);
      if (atx) {
        result.push({
          kind: "heading",
          level: atx[1].length,
          lines: [{ ...row, text: (atx[2] ?? "").replace(/[ \t]+#+[ \t]*$/, "").trim() }],
        });
        i++;
        continue;
      }
      if (rule(text)) {
        result.push({ kind: "thematicBreak" });
        i++;
        continue;
      }
      if (quote(text)) {
        const content: SourceLine[] = [];
        while (i < rows.length) {
          const match = quote(rows[i].text);
          if (!match) break;
          content.push({ ...rows[i++], text: match[1] });
        }
        result.push({ kind: "blockquote", children: blocks(content, depth + 1) });
        continue;
      }
      const first = listMarker(text);
      if (first) {
        const items: Draft[][] = [];
        let tight = true;
        const sameList = (value: string) => {
          const marker = listMarker(value);
          return marker &&
            marker.indent === first.indent &&
            marker.ordered === first.ordered &&
            marker.marker === first.marker
            ? marker
            : null;
        };
        while (i < rows.length) {
          const marker = sameList(rows[i].text);
          if (!marker || rule(rows[i].text)) break;
          const content: SourceLine[] = [{ ...rows[i++], text: marker.text }];
          while (i < rows.length) {
            if (!rows[i].text.trim()) {
              let next = i + 1;
              while (next < rows.length && !rows[next].text.trim()) next++;
              if (next >= rows.length) break;
              if (sameList(rows[next].text) && !rule(rows[next].text)) {
                tight = false;
                i = next;
                break;
              }
              if (/^ */.exec(rows[next].text)![0].length < marker.contentIndent) break;
              tight = false;
              while (i < next) content.push({ ...rows[i++], text: "" });
              continue;
            }
            if (/^ */.exec(rows[i].text)![0].length < marker.contentIndent) break;
            content.push({ ...rows[i], text: rows[i].text.slice(marker.contentIndent) });
            i++;
          }
          items.push(blocks(content, depth + 1));
        }
        result.push({ kind: "list", ordered: first.ordered, start: first.start, tight, items });
        continue;
      }
      const table = tableHeader(rows, i);
      if (table) {
        const body: SourceLine[][] = [];
        i += 2;
        while (i < rows.length && rows[i].text.trim() && !startsBlock(rows[i].text)) {
          const cells = tableCells(rows[i].text);
          if (!cells) break;
          body.push(table.header.map((_, column) => ({ ...rows[i], text: cells[column] ?? "" })));
          i++;
        }
        result.push({ kind: "table", ...table, rows: body });
        continue;
      }
      const content: SourceLine[] = [row];
      i++;
      let level = 0;
      while (i < rows.length && rows[i].text.trim()) {
        const underline = setext(rows[i].text);
        if (underline) {
          level = underline[1][0] === "=" ? 1 : 2;
          i++;
          break;
        }
        if (startsBlock(rows[i].text) || tableHeader(rows, i)) break;
        content.push(rows[i++]);
      }
      result.push({ kind: level ? "heading" : "paragraph", level, lines: content });
    }
    return result;
  };
  const resolve = (draft: readonly Draft[]): MarkdownBlock[] =>
    draft.map((block) => {
      switch (block.kind) {
        case "paragraph":
          return { kind: "paragraph", children: parseInline(block.lines, definitions, sourcePath) };
        case "heading":
          return {
            kind: "heading",
            level: block.level,
            children: parseInline(block.lines, definitions, sourcePath),
          };
        case "blockquote":
          return { kind: "blockquote", children: resolve(block.children) };
        case "list":
          return { ...block, items: block.items.map(resolve) };
        case "table":
          return {
            ...block,
            header: block.header.map((cell) => parseInline([cell], definitions, sourcePath)),
            rows: block.rows.map((row) =>
              row.map((cell) => parseInline([cell], definitions, sourcePath)),
            ),
          };
        default:
          return block;
      }
    });
  return resolve(blocks(lines));
}

export function plainText(nodes: readonly Inline[]): string {
  return nodes
    .map((node) =>
      "text" in node ? node.text : "children" in node ? plainText(node.children) : "\n",
    )
    .join("");
}

export function links(blocks: readonly MarkdownBlock[]): string[] {
  const found: string[] = [];
  const visitInline = (nodes: readonly Inline[]): void => {
    for (const node of nodes) {
      if (node.kind === "link") found.push(node.href);
      if ("children" in node) visitInline(node.children);
    }
  };
  const visit = (nodes: readonly MarkdownBlock[]): void => {
    for (const node of nodes) {
      if (node.kind === "blockquote") visit(node.children);
      else if (node.kind === "list") node.items.forEach(visit);
      else if (node.kind === "table") {
        node.header.forEach(visitInline);
        node.rows.forEach((row) => row.forEach(visitInline));
      } else if ("children" in node) visitInline(node.children);
    }
  };
  visit(blocks);
  return found;
}
