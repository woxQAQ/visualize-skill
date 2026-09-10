import test from 'node:test';
import assert from 'node:assert/strict';
import { document, render, DiagnosticError } from '@visualize/semantic';
const html = (source: string) => render(document().markdown(source));
const diagnostic = (code: string, line?: number) => (error: unknown) => error instanceof DiagnosticError
  && error.diagnostics[0].code === code && (line === undefined || error.diagnostics[0].path === `blocks[0].markdown.line[${line}]`);

test('inline delimiters preserve nested formatting, literal underscores and unmatched markers', () => {
  const output = html('***完整强调*** 与 **外层 *内层* 继续** 和 foo_bar_baz、未闭合 *标记。');
  assert.match(output, /<em><strong>完整强调<\/strong><\/em>/);
  assert.match(output, /<strong>外层 <em>内层<\/em> 继续<\/strong>/);
  assert.match(output, /foo_bar_baz、未闭合 \*标记。/);
});

test('links handle balanced destinations, escaped punctuation, formatted labels and titles', () => {
  const output = html('[含 `]` 的 **标题**](https://example.com/a_(b) "说明") 与 [另一处](https://example.com/a\\)b)');
  assert.match(output, /href="https:\/\/example.com\/a_\(b\)" title="说明">含 <code>]<\/code> 的 <strong>标题<\/strong><\/a>/);
  assert.match(output, /href="https:\/\/example.com\/a\)b"/);
});

test('references resolve forward with normalized labels and ignore definitions in code', () => {
  const output = html('[完整][  PAGE ]、[page][]、[page]\n\n> [page]: https://example.com/first\n\n[page]: https://example.com/second\n\n```md\n[code]: https://example.com/code\n```\n\n[code]');
  assert.equal((output.match(/href="https:\/\/example.com\/first"/g) ?? []).length, 3);
  assert.doesNotMatch(output, /href="https:\/\/example.com\/(?:second|code)"/);
  assert.match(output, /<p>\[code\]<\/p>/);
});

test('lists preserve zero start, nested blocks and loose paragraphs', () => {
  const output = html('0. 首项\n\n   第二段\n\n   - 子项\n\n1. 次项\n\n正文\n\n    <code>示例</code>');
  assert.match(output, /<ol start="0"><li><p>首项<\/p>\n<p>第二段<\/p>\n<ul><li>子项<\/li><\/ul><\/li>/);
  assert.match(output, /<pre><code>&lt;code&gt;示例&lt;\/code&gt;<\/code><\/pre>/);
});

test('soft and hard breaks, escapes, character references and autolinks remain text', () => {
  const output = html('软换行\n下一行  \n硬换行\\\n再一行 \\*文字\\* &lt;b&gt; &#x4e2d; &unknown;\n\n<https://example.com> <user@example.com>');
  assert.match(output, /软换行\n下一行<br>硬换行<br>再一行 \*文字\* &lt;b&gt; 中 &amp;unknown;/);
  assert.match(output, /href="mailto:user@example.com"/);
});

test('HTML and image diagnostics retain original lines through nested containers', () => {
  assert.throws(() => html('# 标题\n\n> - 段落\n>\n>   ![图片](https://example.com/a.png)'), diagnostic('MARKDOWN_IMAGE', 5));
  assert.throws(() => html('正文\n\n- 首项\n  <div>HTML</div>'), diagnostic('MARKDOWN_HTML', 4));
  assert.throws(() => html('[链接](javascript&#58;alert(1))'), diagnostic('MARKDOWN_LINK', 1));
  assert.throws(() => html('[链接](https://example.com/&#10;bad)'), diagnostic('MARKDOWN_LINK', 1));
  assert.doesNotThrow(() => html('`![图片](javascript:alert) <script>`'));
});

test('excessive block and emphasis nesting yields a diagnostic', () => {
  assert.throws(() => html('> '.repeat(34) + '内容'), diagnostic('MARKDOWN_DEPTH'));
  assert.throws(() => html('*'.repeat(68) + '内容' + '*'.repeat(68)), diagnostic('MARKDOWN_DEPTH'));
});
