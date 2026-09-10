import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Definition, Nodes, PhrasingContent, RootContent } from 'mdast';
import { fail, string } from './diagnostics.js';
import type { Inline, MarkdownBlock } from './model.js';

// CommonMark owns syntax. This adapter owns the report's allowed content and links.
export function parseMarkdown(source: string, sourcePath = 'markdown'): readonly MarkdownBlock[] {
  string(source, sourcePath);
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const indent = Math.min(...lines.filter(line => line.trim()).map(line => /^ */.exec(line)![0].length));
  const tree = fromMarkdown(lines.map(line => line.slice(Math.min(indent, /^ */.exec(line)![0].length))).join('\n'));
  const definitions = new Map<string, Definition>();
  const collect = (node: Nodes): void => {
    if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node);
    if ('children' in node) node.children.forEach(collect);
  };
  collect(tree);
  const path = (node: Nodes) => `${sourcePath}.line[${node.position?.start.line ?? 1}]`;
  const reject = (node: Nodes): never => fail(`MARKDOWN_${node.type === 'html' ? 'HTML' : node.type.startsWith('image') ? 'IMAGE' : 'BLOCK'}`,
    path(node), `报告不支持 ${node.type} 内容。`, '使用文档支持的文字结构；图表通过 diagram() 声明，代码示例放入代码块。');
  const link = (node: Nodes, href: string, children: readonly Inline[], title?: string | null): Inline => {
    if (!/^(https?:\/\/|mailto:)/i.test(href) && !/^(entity|diagram):[a-z][a-z0-9-]*$/.test(href)) {
      fail('MARKDOWN_LINK', path(node), '链接地址或内部引用标识无效。', '使用 http、https、mailto 地址，或 entity:对象标识、diagram:图表标识。');
    }
    return { kind: 'link', href, children, ...(title ? { title } : {}) };
  };
  const inline = (nodes: readonly PhrasingContent[]): Inline[] => nodes.map(node => {
    switch (node.type) {
      case 'text': return { kind: 'text', text: node.value };
      case 'inlineCode': return { kind: 'code', text: node.value };
      case 'emphasis': case 'strong': return { kind: node.type, children: inline(node.children) };
      case 'break': return { kind: 'break' };
      case 'link': return link(node, node.url, inline(node.children), node.title);
      case 'linkReference': {
        const definition = definitions.get(node.identifier);
        if (!definition) fail('MARKDOWN_LINK', path(node), '引用链接没有定义。', '为引用标签补充链接定义。');
        return link(node, definition.url, inline(node.children), definition.title);
      }
      default: return reject(node);
    }
  });
  const blocks = (nodes: readonly RootContent[]): MarkdownBlock[] => nodes.flatMap((node): MarkdownBlock[] => {
    switch (node.type) {
      case 'definition': return [];
      case 'paragraph': return [{ kind: 'paragraph', children: inline(node.children) }];
      case 'heading': return [{ kind: 'heading', level: node.depth, children: inline(node.children) }];
      case 'code': return [{ kind: 'codeBlock', language: node.lang ?? '', text: node.value }];
      case 'thematicBreak': return [{ kind: 'thematicBreak' }];
      case 'blockquote': return [{ kind: 'blockquote', children: blocks(node.children) }];
      case 'list': return [{ kind: 'list', ordered: node.ordered ?? false, start: node.start ?? 1,
        tight: !node.spread && node.children.every(item => !item.spread), items: node.children.map(item => blocks(item.children)) }];
      default: return reject(node);
    }
  });
  return blocks(tree.children);
}

export function plainText(nodes: readonly Inline[]): string {
  return nodes.map(node => 'text' in node ? node.text : 'children' in node ? plainText(node.children) : '\n').join('');
}

export function links(blocks: readonly MarkdownBlock[]): string[] {
  const found: string[] = [];
  const visitInline = (nodes: readonly Inline[]): void => {
    for (const node of nodes) {
      if (node.kind === 'link') found.push(node.href);
      if ('children' in node) visitInline(node.children);
    }
  };
  const visit = (nodes: readonly MarkdownBlock[]): void => {
    for (const node of nodes) {
      if (node.kind === 'blockquote') visit(node.children);
      else if (node.kind === 'list') node.items.forEach(visit);
      else if ('children' in node) visitInline(node.children);
    }
  };
  visit(blocks);
  return found;
}
