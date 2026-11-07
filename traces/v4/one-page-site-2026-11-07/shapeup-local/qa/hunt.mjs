import { spawnSync } from 'node:child_process';
import { writeFileSync, readFileSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const B = '/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer/build.mjs';
const d = mkdtempSync(join(tmpdir(), 'h-'));
function run(label, raw, env = {}) {
  const c = join(d, 'c.json'), o = join(d, 'o' + Math.random().toString(36).slice(2));
  writeFileSync(c, raw);
  const r = spawnSync('node', [B], { env: { ...process.env, CONTENT_FILE: c, OUT_DIR: o, ...env }, encoding: 'utf8', cwd: d });
  console.log('---', label, 'exit', r.status, r.stderr.trim());
  const f = join(o, 'index.html');
  if (existsSync(f)) {
    const h = readFileSync(f, 'utf8');
    console.log(h.split('\n').filter(l => /href|<h1|<h3|<p>|<title/.test(l)).join('\n'));
  }
}
run('jsurl', JSON.stringify({ name: 'a', projects: [{ title: 't', url: 'javascript:alert(1)' }, { title: 't2', url: 'http://x.com/"onmouseover="x' }] }));
run('nonstr', JSON.stringify({ name: 'a', projects: [{ title: { a: 1 }, summary: ['x'], url: 5 }, null, 7, 'str'] }));
run('email', JSON.stringify({ name: 'a', contact: { email: 'a@b.c?subject=x&cc=evil@x.com' } }));
run('minimal', '{"name":"a"}');
run('ws', '{"name":"  "}');
run('weird', JSON.stringify({ name: '\u0000‮😀 x', about: '<script>' }));
run('contactarr', JSON.stringify({ name: 'a', contact: [1] }));
run('urlspace', JSON.stringify({ name: 'a', projects: [{ title: 't', url: 'https://x.com/a b' }] }));
run('untitled', JSON.stringify({ name: 'a', projects: [{ url: 'https://x.com' }, {}] }));
run('BOM', '﻿{"name":"a"}');
run('proto', '{"name":"a","__proto__":{"projects":5}}');
run('outfile', '{"name":"a"}', { OUT_DIR: join(d, 'c.json') });
run('contentdir', '{"name":"a"}', { CONTENT_FILE: d });
run('emptyenv', '{"name":"a"}', { OUT_DIR: '' });
run('hugeabout', JSON.stringify({ name: 'a', about: 'x'.repeat(5e6) }));
rmSync(d, { recursive: true, force: true });
