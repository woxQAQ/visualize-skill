import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm, realpath, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const cli = resolve("src/cli.ts");
const sdk = pathToFileURL(resolve("src/index.ts")).href;

test("CLI resolves command paths from cwd and relative imports from the content script", async (t) => {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "visualize-cli-")));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, "content"));
  const input = join(dir, "content", "report.ts");
  const output = join(dir, "nested", "report.html");
  const relativeSdk = relative(dirname(input), resolve("src/index.ts"));
  const relativeCli = relative(dir, cli);
  await writeFile(
    input,
    `import {document} from ${JSON.stringify(relativeSdk)}; const title: string = '# 实际调用'; export default document().markdown(title);`,
  );
  const check = await exec(process.execPath, [relativeCli, "content/report.ts", "--check"], {
    cwd: dir,
  });
  assert.deepEqual(JSON.parse(check.stdout), { ok: true, diagrams: 0, warnings: [] });
  const build = await exec(
    process.execPath,
    [relativeCli, "content/report.ts", "-o", "nested/report.html"],
    { cwd: dir },
  );
  assert.equal(JSON.parse(build.stdout).output, output);
  assert.match(await readFile(output, "utf8"), /实际调用/);
});

test("CLI reports diagnostics and preserves the previous output on failure", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "visualize-failure-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const input = join(dir, "bad.mjs"),
    output = join(dir, "report.html");
  await writeFile(
    input,
    `import {document} from ${JSON.stringify(sdk)}; export default document();`,
  );
  await writeFile(output, "previous report");
  await assert.rejects(
    exec(process.execPath, [cli, input, "-o", output]),
    (error) =>
      error instanceof Error &&
      "code" in error &&
      error.code === 1 &&
      "stderr" in error &&
      typeof error.stderr === "string" &&
      JSON.parse(error.stderr).diagnostics[0].code === "EMPTY_DOCUMENT",
  );
  assert.equal(await readFile(output, "utf8"), "previous report");
});

test("wide diagrams produce actionable warnings in checks and successful report generation", async (t) => {
  const dir = await mkdtemp(join(tmpdir(), "visualize-width-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const fixture = pathToFileURL(resolve("test/fixtures/agent-routing.ts")).href;
  const input = join(dir, "report.ts"),
    output = join(dir, "report.html");
  await writeFile(
    input,
    `import {document} from ${JSON.stringify(sdk)};
import {agentOverview, agentFlow} from ${JSON.stringify(fixture)};
export default document().diagram(agentOverview).diagram(agentFlow);`,
  );
  const checked = JSON.parse((await exec(process.execPath, [cli, input, "--check"])).stdout);
  assert.equal(checked.ok, true);
  assert.equal(checked.diagrams, 2);
  assert.deepEqual(
    checked.warnings.map((warning: { code: string; path: string }) => [warning.code, warning.path]),
    [
      ["READING_WIDTH", "diagram.package-overview"],
      ["READING_WIDTH", "diagram.durable-flow"],
    ],
  );
  assert.ok(
    checked.warnings.every(
      (warning: { message: string; hint: string }) =>
        warning.message.includes("1064") && warning.hint,
    ),
  );
  const built = JSON.parse((await exec(process.execPath, [cli, input, "-o", output])).stdout);
  assert.equal(built.ok, true);
  assert.deepEqual(built.warnings, checked.warnings);
  assert.match(await readFile(output, "utf8"), /<svg/);
});
