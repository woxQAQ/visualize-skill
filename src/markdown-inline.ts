import { fail } from './diagnostics.ts';
import type { Inline } from './model.ts';

export interface LinkTarget { href: string; title?: string }
export interface SourceLine { text: string; number: number }
const punctuation = /[!-/:-@\[-`{-~]/;
const named: Readonly<Record<string, string>> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' };

function characterReference(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole: string, name: string) => {
    if (!name.startsWith('#')) return Object.hasOwn(named, name) ? named[name] : whole;
    const code = name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd';
  });
}
const unescape = (value: string) => characterReference(value.replace(/\\([!-/:-@\[-`{-~])/g, '$1'));
export const referenceId = (value: string) => unescape(value).trim().replace(/\s+/g, ' ').toLowerCase();

// Read a destination and optional title. Inline links end at the unmatched ')';
// definitions use the whole line. Balanced parentheses can occur in URLs.
export function linkTarget(source: string, start: number, inline: boolean): (LinkTarget & { end: number }) | null {
  let i = start;
  while (/\s/.test(source[i] ?? '') && i < source.length) i++;
  const begin = i;
  let href: string;
  if (source[i] === '<') {
    i++;
    while (i < source.length && source[i] !== '>' && source[i] !== '\n') {
      if (source[i] === '\\') i++;
      i++;
    }
    if (source[i] !== '>') return null;
    href = source.slice(begin + 1, i++);
  } else {
    let depth = 0;
    while (i < source.length && !/\s/.test(source[i])) {
      if (source[i] === '\\' && punctuation.test(source[i + 1] ?? '')) { i += 2; continue; }
      if (source[i] === '(') depth++;
      if (source[i] === ')') {
        if (depth === 0) break;
        depth--;
      }
      i++;
    }
    if (depth !== 0) return null;
    href = source.slice(begin, i);
  }
  const destinationEnd = i;
  while (i < source.length && /\s/.test(source[i])) i++;
  let title: string | undefined;
  if (i > destinationEnd && /["'(]/.test(source[i] ?? '')) {
    const close = source[i] === '(' ? ')' : source[i];
    const titleStart = ++i;
    while (i < source.length && source[i] !== close) {
      if (source[i] === '\\') i++;
      i++;
    }
    if (source[i] !== close) return null;
    title = unescape(source.slice(titleStart, i++));
    while (i < source.length && /\s/.test(source[i])) i++;
  }
  if (inline ? source[i] !== ')' : i !== source.length) return null;
  return { href: unescape(href), ...(title !== undefined ? { title } : {}), end: inline ? i + 1 : i };
}

type Delimiter = { kind: 'delimiter'; marker: string; count: number; open: boolean; close: boolean; offset: number };
type Token = Inline | Delimiter;
const literal = (token: Token): Inline => token.kind === 'delimiter' ? { kind: 'text', text: token.marker.repeat(token.count) } : token;

function emphasis(tokens: Token[], tooDeep: (offset: number) => never): Inline[] {
  const depths = new Map<Inline, number>();
  for (let i = 0; i < tokens.length; i++) {
    const close = tokens[i];
    if (close.kind !== 'delimiter' || !close.close) continue;
    for (let j = i - 1; j >= 0; j--) {
      const open = tokens[j];
      if (open.kind !== 'delimiter' || !open.open || open.marker !== close.marker) continue;
      if ((open.close || close.open) && (open.count + close.count) % 3 === 0 && (open.count % 3 !== 0 || close.count % 3 !== 0)) continue;
      const count = Math.min(open.count, close.count) >= 2 ? 2 : 1;
      const wrapped: Inline = { kind: count === 2 ? 'strong' : 'emphasis', children: tokens.slice(j + 1, i).map(literal) };
      const nesting = 1 + Math.max(0, ...tokens.slice(j + 1, i).map(token => token.kind === 'delimiter' ? 0 : depths.get(token) ?? 0));
      if (nesting > 32) tooDeep(open.offset);
      depths.set(wrapped, nesting);
      open.count -= count;
      close.count -= count;
      const replacement: Token[] = [...(open.count ? [open] : []), wrapped, ...(close.count ? [close] : [])];
      tokens.splice(j, i - j + 1, ...replacement);
      i = j + replacement.length - (close.count ? 2 : 1);
      break;
    }
  }
  return tokens.map(literal);
}

function codeSpan(source: string, start: number, end: number) {
  const run = /^`+/.exec(source.slice(start))![0];
  let close = start + run.length;
  while (close < end) {
    close = source.indexOf('`', close);
    if (close < 0 || close >= end) return null;
    const length = /^`+/.exec(source.slice(close))![0].length;
    if (length === run.length) {
      let value = source.slice(start + run.length, close).replace(/\n/g, ' ');
      if (value.startsWith(' ') && value.endsWith(' ') && value.trim()) value = value.slice(1, -1);
      return { value, end: close + run.length };
    }
    close += length;
  }
  return null;
}

export function parseInline(lines: readonly SourceLine[], definitions: ReadonlyMap<string, LinkTarget>, sourcePath: string): Inline[] {
  const source = lines.map(line => line.text).join('\n');
  const path = (offset: number) => `${sourcePath}.line[${lines[source.slice(0, offset).split('\n').length - 1].number}]`;
  const reject = (code: string, offset: number, message: string): never => fail(code, path(offset), message, '使用支持的文字结构和链接；图表通过 diagram() 声明，HTML 示例放入代码块。');
  const makeLink = (target: LinkTarget, children: readonly Inline[], offset: number): Inline => {
    if ((!/^(https?:\/\/|mailto:)/i.test(target.href) && !/^(entity|diagram):[a-z][a-z0-9-]*$/.test(target.href)) || /[\u0000-\u0020\u007f]/.test(target.href)) {
      reject('MARKDOWN_LINK', offset, '链接地址或内部引用标识无效。');
    }
    return { kind: 'link', href: target.href, children, ...(target.title ? { title: target.title } : {}) };
  };
  const parse = (start: number, end: number, depth = 0, inLink = false): Inline[] => {
    if (depth > 32) reject('MARKDOWN_DEPTH', start, '行内标记嵌套超过 32 层。');
    const tokens: Token[] = [];
    const text = (value: string) => {
      const last = tokens.at(-1);
      if (last?.kind === 'text') tokens[tokens.length - 1] = { kind: 'text', text: last.text + value };
      else if (value) tokens.push({ kind: 'text', text: value });
    };
    for (let i = start; i < end;) {
      const char = source[i];
      if (char === '\\' && (punctuation.test(source[i + 1] ?? '') || source[i + 1] === '\n')) {
        if (source[i + 1] === '\n') tokens.push({ kind: 'break' });
        else text(source[i + 1]);
        i += 2; continue;
      }
      if (char === '`') {
        const span = codeSpan(source, i, end);
        if (span) { tokens.push({ kind: 'code', text: span.value }); i = span.end; continue; }
        const run = /^`+/.exec(source.slice(i))![0];
        text(run); i += run.length; continue;
      }
      if (char === '[' || (char === '!' && source[i + 1] === '[')) {
        const image = char === '!';
        const begin = i + (image ? 2 : 1);
        let close = begin, brackets = 1;
        for (; close < end; close++) {
          if (source[close] === '\\') { close++; continue; }
          if (source[close] === '`') {
            const span = codeSpan(source, close, end);
            if (span) { close = span.end - 1; continue; }
          }
          if (source[close] === '[') brackets++;
          if (source[close] === ']' && --brackets === 0) break;
        }
        if (close < end) {
          const label = source.slice(begin, close);
          let target: LinkTarget | null | undefined;
          let next = close + 1;
          if (source[next] === '(') {
            const result = linkTarget(source.slice(0, end), next + 1, true);
            target = result;
            if (result) next = result.end;
          } else if (source[next] === '[') {
            const refEnd = source.indexOf(']', next + 1);
            if (refEnd >= 0 && refEnd < end) {
              target = definitions.get(referenceId(source.slice(next + 1, refEnd) || label));
              next = refEnd + 1;
            }
          } else target = definitions.get(referenceId(label));
          if (target) {
            if (image) reject('MARKDOWN_IMAGE', i, '报告不支持图片。');
            if (inLink) reject('MARKDOWN_LINK', i, '链接不能嵌套。');
            tokens.push(makeLink(target, parse(begin, close, depth + 1, true), i)); i = next; continue;
          }
        }
      }
      if (char === '<') {
        const auto = /^<([a-z][a-z\d+.-]*:[^<>\s]*|[^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/i.exec(source.slice(i, end));
        if (auto) {
          if (inLink) reject('MARKDOWN_LINK', i, '链接不能嵌套。');
          tokens.push(makeLink({ href: auto[1].includes(':') ? auto[1] : `mailto:${auto[1]}` }, [{ kind: 'text', text: auto[1] }], i));
          i += auto[0].length; continue;
        }
        if (/^<(?:\/?[a-z][a-z\d-]*(?:\s|\/?>)|[!?])/i.test(source.slice(i, end))) reject('MARKDOWN_HTML', i, '报告不支持原始 HTML。');
      }
      if (char === '*' || char === '_') {
        let count = 1;
        while (i + count < end && source[i + count] === char) count++;
        const before = i === start ? '' : source[i - 1], after = i + count === end ? '' : source[i + count];
        const beforeSpace = !before || /\s/.test(before), afterSpace = !after || /\s/.test(after);
        const beforePunct = /[\p{P}\p{S}]/u.test(before), afterPunct = /[\p{P}\p{S}]/u.test(after);
        const left = !afterSpace && (!afterPunct || beforeSpace || beforePunct);
        const right = !beforeSpace && (!beforePunct || afterSpace || afterPunct);
        tokens.push({ kind: 'delimiter', marker: char, count, offset: i, open: left && (char !== '_' || !right || beforePunct), close: right && (char !== '_' || !left || afterPunct) });
        i += count; continue;
      }
      if (char === '\n') {
        const last = tokens.at(-1);
        const hard = last?.kind === 'text' && / {2,}$/.test(last.text);
        if (last?.kind === 'text') tokens[tokens.length - 1] = { kind: 'text', text: last.text.trimEnd() };
        if (hard) tokens.push({ kind: 'break' }); else text('\n');
        i++; continue;
      }
      if (char === '&') {
        const entity = /^&(?:#x[\da-f]+|#\d+|[a-z]+);/i.exec(source.slice(i, end));
        if (entity) { text(characterReference(entity[0])); i += entity[0].length; continue; }
      }
      text(char); i++;
    }
    return emphasis(tokens, offset => reject('MARKDOWN_DEPTH', offset, '强调标记嵌套超过 32 层。'));
  };
  return parse(0, source.length);
}
