import { escape } from './markup.js';
import type { Inline, MarkdownBlock } from './model.js';

function inline(nodes: readonly Inline[]): string {
  return nodes.map(node => {
    switch (node.kind) {
      case 'text': return escape(node.text);
      case 'code': return `<code>${escape(node.text)}</code>`;
      case 'strong': return `<strong>${inline(node.children)}</strong>`;
      case 'emphasis': return `<em>${inline(node.children)}</em>`;
      case 'break': return '<br>';
      case 'link': {
        const title = node.title ? ` title="${escape(node.title)}"` : '';
        if (node.href.startsWith('entity:')) {
          const target = `details-${node.href.slice(7)}`;
          return `<a href="#${target}" data-entity-detail="${target}"${title}>${inline(node.children)}</a>`;
        }
        const href = node.href.startsWith('diagram:') ? `#diagram-${node.href.slice(8)}` : node.href;
        return `<a href="${escape(href)}"${title}>${inline(node.children)}</a>`;
      }
    }
  }).join('');
}

export function renderMarkdown(blocks: readonly MarkdownBlock[], nextHeading: () => number, tight = false): string {
  return blocks.map(block => {
    switch (block.kind) {
      case 'paragraph': return tight ? inline(block.children) : `<p>${inline(block.children)}</p>`;
      case 'heading': return `<h${block.level} id="heading-${nextHeading()}">${inline(block.children)}</h${block.level}>`;
      case 'codeBlock': return `<pre><code${block.language ? ` data-language="${escape(block.language)}"` : ''}>${escape(block.text)}</code></pre>`;
      case 'thematicBreak': return '<hr>';
      case 'blockquote': return `<blockquote>${renderMarkdown(block.children, nextHeading)}</blockquote>`;
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul';
        return `<${tag}${block.ordered ? ` start="${block.start}"` : ''}>${block.items.map(item => `<li>${renderMarkdown(item, nextHeading, block.tight)}</li>`).join('')}</${tag}>`;
      }
    }
  }).join('\n');
}
