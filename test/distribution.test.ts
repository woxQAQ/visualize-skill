import test from "node:test";
import assert from "node:assert/strict";
import { access, cp, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Script } from "node:vm";

const exec = promisify(execFile);
const root = resolve(".");

test("copied skill runs from source without installation or build artifacts", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "visualize skill "));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const name of ["src", "examples", "references", "SKILL.md", "package.json"]) {
    await cp(join(root, name), join(dir, name), { recursive: true });
  }
  await assert.rejects(access(join(dir, "node_modules")));
  await assert.rejects(access(join(dir, "dist")));
  const cli = join(dir, "src/cli.ts");
  const output = join(dir, "report.html");
  await exec(process.execPath, [cli, join(dir, "examples/self-explanation.ts"), "-o", output], {
    cwd: tmpdir(),
  });
  const html = await readFile(output, "utf8");
  assert.match(html, /用图表探索这套系统/);
  assert.match(html, /data-entity-detail="details-sdk"/);
  const css = await readFile(join(dir, "src/templates/report.css"), "utf8");
  const embeddedCss = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  assert.equal(embeddedCss?.trim(), css.trim());
  const script = html.match(/<script data-visualize-interaction>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  const interactionScript = await readFile(join(dir, "src/templates/interactions.js"), "utf8");
  assert.equal(script.trim(), interactionScript.trim());
  assert.doesNotThrow(() => new Script(script));
  assert.doesNotMatch(html, /<link|\bsrc=/);

  const swimlaneOutput = join(dir, "swimlane.html");
  await exec(process.execPath, [cli, join(dir, "examples/swimlane.ts"), "-o", swimlaneOutput], {
    cwd: tmpdir(),
  });
  const swimlaneHtml = await readFile(swimlaneOutput, "utf8");
  assert.match(swimlaneHtml, /data-lane="employee"/);
  assert.match(swimlaneHtml, /所属泳道/);

  const external = await mkdtemp(join(tmpdir(), "visualize author "));
  t.after(() => rm(external, { recursive: true, force: true }));
  const entry = pathToFileURL(join(dir, "src/index.ts")).href;
  await writeFile(
    join(external, "report.ts"),
    `
import { document, entity, role, architecture } from ${JSON.stringify(entry)};
const item = entity({ id: 'item', label: '实际对象' });
const worker = role({ id: 'worker', label: '处理者' });
export default document().diagram(architecture({ id: 'external', title: '外部内容脚本',
  nodes: [{ entity: item, role: worker, position: { x: 0, y: 0 }, size: { width: 220, height: 88 } }], relations: [] }));
`,
  );
  const checked = await exec(process.execPath, [cli, "report.ts", "--check"], { cwd: external });
  assert.deepEqual(JSON.parse(checked.stdout), { ok: true, diagrams: 1 });
  await exec(process.execPath, [cli, "report.ts", "-o", "report.html"], { cwd: external });
  assert.match(await readFile(join(external, "report.html"), "utf8"), /外部内容脚本/);
});
