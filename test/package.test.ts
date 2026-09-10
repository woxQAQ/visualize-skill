import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = resolve('.');

test('packed package provides imports, types and CLI in an independent consumer project', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'visualize-package-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const tarball = join(dir, 'semantic.tgz');
  await exec('pnpm', ['pack', '--out', tarball], { cwd: root });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ private: true, type: 'module', dependencies: { '@visualize/semantic': `file:${tarball}` } }));
  await exec('pnpm', ['install', '--offline', '--ignore-scripts'], { cwd: dir });
  await writeFile(join(dir, 'report.ts'), `
import { architecture, document, entity, role } from '@visualize/semantic';
import type { Partition } from '@visualize/semantic';
const item = entity({ id: 'item', label: '实际实体' });
const worker = role({ id: 'worker', label: '处理者' });
const partition: Partition = { id: 'zone', label: '逻辑区域', position: { x: 0, y: 0 }, size: { width: 300, height: 200 } };
export default document().diagram(architecture({ id: 'consumer', title: '实际分发', partitions: [partition],
  nodes: [{ entity: item, role: worker, partition: 'zone', position: { x: 0, y: 0 }, size: { width: 220, height: 88 } }], relations: [] }));
`);
  await writeFile(join(dir, 'types.ts'), `
import { architecture, entity, role } from '@visualize/semantic';
const item = entity({ id: 'item', label: '实体' });
const worker = role({ id: 'worker', label: '处理者' });
// @ts-expect-error Installed declarations must require explicit node dimensions.
architecture({ id: 'bad', title: '缺少尺寸', nodes: [{ entity: item, role: worker, position: { x: 0, y: 0 } }], relations: [] });
`);
  await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, module: 'NodeNext', target: 'ES2023', types: [] }, include: ['*.ts'] }));
  await exec('pnpm', ['exec', 'tsc', '--project', join(dir, 'tsconfig.json')], { cwd: root });
  const check = await exec('pnpm', ['exec', 'visualize', 'report.ts', '--check'], { cwd: dir });
  assert.deepEqual(JSON.parse(check.stdout), { ok: true, diagrams: 1 });
  await exec('pnpm', ['exec', 'visualize', 'report.ts', '-o', 'report.html'], { cwd: dir });
  const html = await readFile(join(dir, 'report.html'), 'utf8');
  assert.match(html, /实际分发/);
  assert.match(html, /data-partition="zone"/);
  assert.doesNotMatch(html, /data-entity="zone"/);
  const installed = join(dir, 'node_modules', '@visualize/semantic');
  await access(join(installed, 'dist/index.js'));
  await access(join(installed, 'dist/index.d.ts'));
  await access(join(installed, 'SKILL.md'));
  await assert.rejects(access(join(installed, 'src')));
  const hidden = await exec(process.execPath, ['--input-type=module', '-e', "try { await import('@visualize/semantic/src/index.ts'); process.exitCode = 1; } catch (error) { if (error.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') throw error; }"], { cwd: dir });
  assert.equal(hidden.stderr, '');
});
