#!/usr/bin/env node
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { compile, render, DiagnosticError } from "./index.ts";
import { isDiagram } from "./sdk.ts";
import { fail } from "./diagnostics.ts";

let temp: string | undefined;
try {
  const { values, positionals } = parseArgs({
    options: {
      output: { type: "string", short: "o" },
      check: { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: true,
  });
  if (values.help) {
    process.stdout.write(
      "Usage: node <skill>/src/cli.ts <diagram.ts> [-o output.html] [--check]\nExecutes a local ES module. --check validates semantics and layout without writing HTML.\n",
    );
  } else {
    if (positionals.length !== 1 || (!values.check && !values.output))
      throw new Error(
        "需要一个 TypeScript 或 JavaScript 文件，以及 -o 输出路径或 --check。使用 --help 查看用法。",
      );
    const input = resolve(positionals[0]);
    const output = values.output ? resolve(values.output) : null;
    if (input === output) throw new Error("输出路径不能覆盖输入脚本。");
    const module: { default?: unknown } = await import(pathToFileURL(input).href);
    if (!isDiagram(module.default))
      fail(
        "INVALID_DIAGRAM",
        "export.default",
        "默认导出必须是 SDK 创建的图表。",
        "直接导出 architecture(...)、sequence(...) 或 swimlane(...)。",
      );
    if (values.check) {
      compile(module.default);
      process.stdout.write(`${JSON.stringify({ ok: true, diagram: module.default.id })}\n`);
    } else {
      if (!output) throw new Error("缺少输出路径。");
      const html = render(module.default);
      await mkdir(dirname(output), { recursive: true });
      temp = `${output}.${randomUUID()}.tmp`;
      await writeFile(temp, html, "utf8");
      await rename(temp, output);
      temp = undefined;
      process.stdout.write(`${JSON.stringify({ ok: true, output })}\n`);
    }
  }
} catch (error) {
  if (temp) await rm(temp, { force: true });
  const diagnostics =
    error instanceof DiagnosticError
      ? error.diagnostics
      : [
          {
            code: "BUILD_ERROR",
            path: "build",
            message: error instanceof Error ? error.message : String(error),
            hint: "检查输入路径、ES module 导出以及脚本错误。",
          },
        ];
  process.stderr.write(`${JSON.stringify({ ok: false, diagnostics }, null, 2)}\n`);
  process.exitCode = 1;
}
