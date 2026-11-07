// UC-LintEnvFile INV-03 probe beyond the TS-INV-03 fixture: does user-controlled text reach stdout
// with ANSI escape sequences intact? Env value, env key and schema key, each carrying ESC[31m.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const BIN = '/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer/bin/envlint.mjs';
const d = mkdtempSync(join(tmpdir(), 'envlint-ansi-'));
const ESC = '\x1b[31m';
writeFileSync(join(d, 's.json'), JSON.stringify({ A: { type: 'int' }, E: { enum: ['a'] }, [`K${ESC}`]: { required: true } }));
writeFileSync(join(d, 'app.env'), `A=${ESC}red\nE=${ESC}x\nB${ESC}=1\n`);
for (let i = 0; i < 2; i++) {
  const r = spawnSync(process.execPath, [BIN, '--schema', 's.json', 'app.env'], { cwd: d, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(`run ${i + 1}: exit=${r.status} stdout_has_ESC[=${/\x1b\[/.test(r.stdout)}`);
  console.log(JSON.stringify(r.stdout));
}
rmSync(d, { recursive: true, force: true });
