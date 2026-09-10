import { execFileSync } from 'node:child_process';
import { copyFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
rmSync(new URL('dist/', root), { recursive: true, force: true });
for (const project of ['tsconfig.build.json', 'tsconfig.browser.json']) {
  execFileSync('tsc', ['-p', project], { cwd: fileURLToPath(root), stdio: 'inherit' });
}
for (const name of readdirSync(new URL('src/templates/', root))) {
  if (/\.(html|css)$/.test(name)) {
    copyFileSync(new URL(`src/templates/${name}`, root), new URL(`dist/templates/${name}`, root));
  }
}
