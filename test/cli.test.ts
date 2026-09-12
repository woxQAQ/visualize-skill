import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, realpath, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, dirname } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = resolve("src/cli.ts");

test("CLI resolves command paths from cwd and relative imports from the content script", async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "visualize-cli-")));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "content"));
  const input = join(dir, "content", "diagram.ts");
  const output = join(dir, "nested", "diagram.html");
  const relativeSdk = relative(dirname(input), resolve("src/index.ts"));
  const relativeCli = relative(dir, cli);
  await writeFile(
    input,
    `import {architecture, entity, role} from ${JSON.stringify(relativeSdk)}; const title: string = '实际调用'; export default architecture({ id: 'actual', title, nodes: [{ entity: entity({ id: 'item', label: '对象' }), role: role({ id: 'worker', label: '处理者' }), position: { x: 0, y: 0 }, size: { width: 220, height: 88 } }], relations: [] });`,
  );
  const check = await exec(process.execPath, [relativeCli, "content/diagram.ts", "--check"], {
    cwd: dir,
  });
  assert.deepEqual(JSON.parse(check.stdout), { ok: true, diagram: "actual" });
  const build = await exec(
    process.execPath,
    [relativeCli, "content/diagram.ts", "-o", "nested/diagram.html"],
    { cwd: dir },
  );
  assert.equal(JSON.parse(build.stdout).output, output);
  assert.match(await readFile(output, "utf8"), /实际调用/);
});

test("CLI reports diagnostics and preserves the previous output on failure", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "visualize-failure-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "bad.mjs"),
    output = join(dir, "diagram.html");
  await writeFile(input, `export default { kind: "architecture", id: "invalid" };`);
  await writeFile(output, "previous fragment");
  await assert.rejects(
    exec(process.execPath, [cli, input, "-o", output]),
    (error) =>
      error instanceof Error &&
      "code" in error &&
      error.code === 1 &&
      "stderr" in error &&
      typeof error.stderr === "string" &&
      JSON.parse(error.stderr).diagnostics[0].code === "INVALID_DIAGRAM",
  );
  assert.equal(await readFile(output, "utf8"), "previous fragment");
});
