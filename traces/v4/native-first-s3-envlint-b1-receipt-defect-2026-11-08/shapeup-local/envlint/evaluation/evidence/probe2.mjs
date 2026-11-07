// Re-probe: ANSI escape and newline echoed from envfile values into findings output.
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const BIN = '/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer/bin/envlint.mjs';
const d = mkdtempSync(join(tmpdir(), 'envlint-eval2-'));
const s = join(d, 's.json'); writeFileSync(s, '{"PORT":{"type":"int"}}');
const esc = join(d, 'esc.env'); writeFileSync(esc, 'PORT=\x1b[31mred\n');
const nl = join(d, 'nl.env'); writeFileSync(nl, 'PORT="a\\nb"\n');
for (const [name, e] of [['esc', esc], ['newline', nl]]) {
  const r = spawnSync(process.execPath, [BIN, '--schema', s, e], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log(name, JSON.stringify({ exit: r.status, stdout: r.stdout, has_CSI: r.stdout.includes('\x1b['), stdout_lines: r.stdout.trimEnd().split('\n').length, findings_expected: 1 }));
}
