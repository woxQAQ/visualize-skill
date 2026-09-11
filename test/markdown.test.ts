import test from "node:test";
import assert from "node:assert/strict";
import { document, render, DiagnosticError } from "../src/index.ts";
const html = (source: string) => render(document().markdown(source));
const diagnostic = (code: string, line?: number) => (error: unknown) =>
  error instanceof DiagnosticError &&
  error.diagnostics[0].code === code &&
  (line === undefined || error.diagnostics[0].path === `blocks[0].markdown.line[${line}]`);

test("inline delimiters preserve nested formatting, literal underscores and unmatched markers", () => {
  const output = html("***完整强调*** 与 **外层 *内层* 继续** 和 foo_bar_baz、未闭合 *标记。");
  assert.match(output, /<em><strong>完整强调<\/strong><\/em>/);
  assert.match(output, /<strong>外层 <em>内层<\/em> 继续<\/strong>/);
  assert.match(output, /foo_bar_baz、未闭合 \*标记。/);
});

test("links handle balanced destinations, escaped punctuation, formatted labels and titles", () => {
  const output = html(
    '[含 `]` 的 **标题**](https://example.com/a_(b) "说明") 与 [另一处](https://example.com/a\\)b)',
  );
  assert.match(
    output,
    /href="https:\/\/example.com\/a_\(b\)" title="说明">含 <code>]<\/code> 的 <strong>标题<\/strong><\/a>/,
  );
  assert.match(output, /href="https:\/\/example.com\/a\)b"/);
});

test("references resolve forward with normalized labels and ignore definitions in code", () => {
  const output = html(
    "[完整][  PAGE ]、[page][]、[page]\n\n> [page]: https://example.com/first\n\n[page]: https://example.com/second\n\n```md\n[code]: https://example.com/code\n```\n\n[code]",
  );
  assert.equal((output.match(/href="https:\/\/example.com\/first"/g) ?? []).length, 3);
  assert.doesNotMatch(output, /href="https:\/\/example.com\/(?:second|code)"/);
  assert.match(output, /<p>\[code\]<\/p>/);
});

test("lists preserve zero start, nested blocks and loose paragraphs", () => {
  const output = html(
    "0. 首项\n\n   第二段\n\n   - 子项\n\n1. 次项\n\n正文\n\n    <code>示例</code>",
  );
  assert.match(
    output,
    /<ol start="0"><li><p>首项<\/p>\n<p>第二段<\/p>\n<ul><li>子项<\/li><\/ul><\/li>/,
  );
  assert.match(output, /<pre><code>&lt;code&gt;示例&lt;\/code&gt;<\/code><\/pre>/);
});

test("soft and hard breaks, escapes, character references and autolinks remain text", () => {
  const output = html(
    "软换行\n下一行  \n硬换行\\\n再一行 \\*文字\\* &lt;b&gt; &#x4e2d; &unknown;\n\n<https://example.com> <user@example.com>",
  );
  assert.match(output, /软换行\n下一行<br>硬换行<br>再一行 \*文字\* &lt;b&gt; 中 &amp;unknown;/);
  assert.match(output, /href="mailto:user@example.com"/);
});

test("HTML and image diagnostics retain original lines through nested containers", () => {
  assert.throws(
    () => html("# 标题\n\n> - 段落\n>\n>   ![图片](https://example.com/a.png)"),
    diagnostic("MARKDOWN_IMAGE", 5),
  );
  assert.throws(() => html("正文\n\n- 首项\n  <div>HTML</div>"), diagnostic("MARKDOWN_HTML", 4));
  assert.throws(() => html("[链接](javascript&#58;alert(1))"), diagnostic("MARKDOWN_LINK", 1));
  assert.throws(() => html("[链接](https://example.com/&#10;bad)"), diagnostic("MARKDOWN_LINK", 1));
  assert.doesNotThrow(() => html("`![图片](javascript:alert) <script>`"));
});

test("excessive block and emphasis nesting yields a diagnostic", () => {
  assert.throws(() => html("> ".repeat(34) + "内容"), diagnostic("MARKDOWN_DEPTH"));
  assert.throws(() => html("*".repeat(68) + "内容" + "*".repeat(68)), diagnostic("MARKDOWN_DEPTH"));
});

test("tables render aligned headers, inline formats, escaped pipes and uneven body rows", () => {
  const output = html(
    [
      "名称 | 示例 | 数量",
      ":--- | :---: | ---:",
      "**字段** | `a\\|b` | 12",
      "| 缺列 |",
      "| 完整 | 值 | 3 | 忽略多列 |",
      "",
      "后续段落",
    ].join("\n"),
  );
  assert.match(output, /<th scope="col" style="text-align:left">名称<\/th>/);
  assert.match(output, /<th scope="col" style="text-align:center">示例<\/th>/);
  assert.match(output, /<th scope="col" style="text-align:right">数量<\/th>/);
  assert.match(
    output,
    /<td style="text-align:left"><strong>字段<\/strong><\/td><td style="text-align:center"><code>a\|b<\/code><\/td>/,
  );
  assert.match(
    output,
    /<tr><td style="text-align:left">缺列<\/td><td style="text-align:center"><\/td><td style="text-align:right"><\/td><\/tr>/,
  );
  assert.doesNotMatch(output, /忽略多列/);
  assert.match(output, /<p>后续段落<\/p>/);
});

test("tables coexist with paragraphs, code, headings and nested containers", () => {
  const output = html(
    "前文\n甲 | 乙\n--- | ---\n一 | 二\n后文\n\n> | 引用 |\n> | --- |\n> | 单元格 |\n\n- | 列表 |\n  | --- |\n  | 单元格 |\n\n```md\n甲 | 乙\n--- | ---\n```\n\n标题\n---",
  );
  assert.equal((output.match(/<table class="markdown-table">/g) ?? []).length, 3);
  assert.match(output, /<p>前文<\/p>\n<div class="table-scroll"/);
  assert.match(output, /<p>后文<\/p>/);
  assert.match(output, /<blockquote><div class="table-scroll"/);
  assert.match(output, /<li><div class="table-scroll"/);
  assert.match(output, /<pre><code data-language="md">甲 \| 乙\n--- \| ---<\/code><\/pre>/);
  assert.match(output, /<h2 id="heading-1">标题<\/h2>/);
  assert.doesNotMatch(html("甲 | 乙\n| --- |"), /<table class="markdown-table">/);
  assert.doesNotMatch(html("甲 | 乙\n-- | --"), /<table class="markdown-table">/);
});

test("table links use the shared reference and validation rules with source line diagnostics", () => {
  const output = html("| [标题][doc] |\n| --- |\n| [内容][doc] |\n\n[doc]: https://example.com");
  assert.equal((output.match(/href="https:\/\/example.com"/g) ?? []).length, 2);
  assert.throws(() => html("| [未知](entity:missing) |\n| --- |"), diagnostic("UNKNOWN_REFERENCE"));
  assert.throws(
    () => html("| 名称 |\n| --- |\n| [未知](diagram:missing) |"),
    diagnostic("UNKNOWN_REFERENCE"),
  );
  assert.throws(
    () => html("> | 名称 |\n> | --- |\n> | <script> |"),
    diagnostic("MARKDOWN_HTML", 3),
  );
  assert.throws(
    () => html("| 名称 |\n| --- |\n| [链接](javascript:bad) |"),
    diagnostic("MARKDOWN_LINK", 3),
  );
});
