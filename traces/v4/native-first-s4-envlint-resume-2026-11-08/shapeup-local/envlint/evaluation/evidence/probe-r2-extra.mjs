// Round-2 extra evidence: (1) the CLI exits with its stdin pipe held open (async spawn, stdin never ended),
// run twice; (2) the exact scope fixture commands the task ACs name. Usage: node probe-r2-extra.mjs <projectRoot>
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2];
const BIN = join(ROOT, 'bin/envlint.mjs');
const D = join(ROOT, '.shapeup/envlint/evaluation/evidence/fx-r2/stdin');
mkdirSync(D, { recursive: true });
writeFileSync(join(D, 'esc.env'), 'PORT=\x1b[31mred\n');
writeFileSync(join(D, 's.json'), '{"PORT":{"type":"int"},"T":{"required":true}}');

function openStdin() {
  return new Promise((resolve) => {
    const c = spawn(process.execPath, [BIN, '--schema', 's.json', 'esc.env'], { cwd: D, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = Buffer.alloc(0), err = Buffer.alloc(0);
    c.stdout.on('data', (b) => { out = Buffer.concat([out, b]); });
    c.stderr.on('data', (b) => { err = Buffer.concat([err, b]); });
    const t = setTimeout(() => { c.kill(); resolve({ hung: true }); }, 5000);
    c.on('exit', (code) => { clearTimeout(t); resolve({ hung: false, code, stdinEnded: c.stdin.writableEnded, escByte: out.includes(0x1b) || err.includes(0x1b), stdout: out.toString(), stderr: err.toString() }); });
  });
}

const result = { stdinHeldOpen: [await openStdin(), await openStdin()], fixtures: [] };
for (const f of ['test/parse.test.mjs', 'test/rules.test.mjs', 'test/cli.test.mjs']) {
  const r = spawnSync(process.execPath, ['--test', f], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
  const tail = (r.stdout || '').split('\n').filter((l) => /^ℹ (tests|pass|fail)/.test(l));
  result.fixtures.push({ cmd: `node --test ${f}`, exit: r.status, summary: tail });
}
process.stdout.write(JSON.stringify(result, null, 1));
