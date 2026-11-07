import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const BUILD = new URL('./build.mjs', import.meta.url).pathname;

function setup(content, raw) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  const file = join(dir, 'c.json');
  if (content !== undefined) writeFileSync(file, raw ?? JSON.stringify(content));
  return { dir, file, out: join(dir, 'out') };
}
function run(s) {
  const r = spawnSync(process.execPath, [BUILD], {
    env: { ...process.env, CONTENT_FILE: s.file, OUT_DIR: s.out },
    encoding: 'utf8',
  });
  const p = join(s.out, 'index.html');
  const html = existsSync(p) ? readFileSync(p, 'utf8') : null;
  return { ...r, html };
}
const valid = {
  name: 'Ada',
  tagline: 'Engineer',
  about: 'About me',
  projects: [
    { title: 'P1', summary: 'S1', url: 'https://e.com/1' },
    { title: 'P2', summary: 'S2' },
  ],
  contact: { email: 'ada@example.com' },
};
const oneLine = (e) => e.trim().length > 0 && e.trim().split('\n').length === 1;

test('TS-INV-01 content file never modified', () => {
  const s = setup(valid);
  const h = () => createHash('sha256').update(readFileSync(s.file)).digest('hex');
  const before = h();
  const m = statSync(s.file).mtimeMs;
  const r = run(s);
  assert.equal(r.status, 0);
  assert.equal(h(), before);
  assert.equal(statSync(s.file).mtimeMs, m);
});

test('TS-INV-02 no JavaScript in output', () => {
  const s = setup({ ...valid, about: '<script>alert(1)</script> onclick=x', tagline: '" onmouseover="x' });
  const r = run(s);
  assert.equal(r.status, 0);
  assert.ok(!/<script/i.test(r.html));
  assert.ok(!/<[^>]*\son\w+\s*=/i.test(r.html));
  assert.ok(!/javascript:/i.test(r.html));
  assert.ok(r.html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.equal((r.html.match(/<style>/g) || []).length, 1);
  assert.ok(!/<link[^>]*stylesheet/i.test(r.html));
});

test('TS-INV-03 byte-identical output', () => {
  const s = setup(valid);
  const a = run(s).html;
  const b = run({ ...s, out: join(s.dir, 'out2') }).html;
  assert.ok(a !== null && a === b);
});

test('TS-INV-04 one h1 and title', () => {
  const r = run(setup(valid));
  assert.equal((r.html.match(/<h1>/g) || []).length, 1);
  assert.ok(r.html.includes('<h1>Ada</h1>\n<p>Engineer</p>'));
  assert.ok(r.html.includes('<title>Ada</title>'));
  const i = (k) => r.html.indexOf(`id="${k}"`);
  assert.ok(r.html.indexOf('<h1>') < i('about') && i('about') < i('projects') && i('projects') < i('contact'));
  assert.ok(r.html.includes('<a href="mailto:ada@example.com">'));
  assert.ok(r.html.includes('<a href="https://e.com/1">P1</a>'));
});

test('TS-INV-05 escaping', () => {
  const r = run(setup({ ...valid, projects: [{ title: '<b>Rock & Roll</b>', url: 'x"y' }] }));
  assert.ok(r.html.includes('&lt;b&gt;Rock &amp; Roll&lt;/b&gt;'));
  assert.ok(!r.html.includes('<b>'));
  assert.ok(r.html.includes('href="x&quot;y"'));
});

test('TS-INV-06 no url means no link', () => {
  for (const url of [undefined, '']) {
    const r = run(setup({ name: 'Ada', projects: [{ title: 'Plain', url }] }));
    assert.ok(r.html.includes('Plain'));
    assert.ok(!r.html.includes('href="#"') && !r.html.includes('href=""'));
    assert.ok(!r.html.includes('<a '));
  }
});

test('TS-INV-07 empty projects', () => {
  for (const c of [{ name: 'Ada', projects: [] }, { name: 'Ada' }]) {
    const r = run(setup(c));
    assert.ok(r.html.includes('Projects are coming soon.'));
    assert.ok(!/<(ul|ol|li)[\s>]/.test(r.html));
  }
});

test('TS-INV-08 no dependencies, no network', () => {
  const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.dependencies, undefined);
  const src = readFileSync(BUILD, 'utf8');
  const imports = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.ok(imports.length > 0 && imports.every((x) => x.startsWith('node:')));
  assert.equal(run(setup(valid)).status, 0);
});

test('TS-ERR-CONTENT_MISSING', () => {
  const s = setup(undefined);
  const r = run(s);
  assert.equal(r.status, 1);
  assert.ok(oneLine(r.stderr));
  assert.ok(r.stderr.includes(s.file));
  assert.equal(r.html, null);
});

test('TS-ERR-CONTENT_INVALID_JSON', () => {
  const r = run(setup({}, '{not json'));
  assert.equal(r.status, 1);
  assert.ok(oneLine(r.stderr));
  assert.equal(r.html, null);
});

test('TS-REQ-name-missing', () => {
  const { name, ...rest } = valid;
  const r = run(setup(rest));
  assert.equal(r.status, 1);
  assert.ok(oneLine(r.stderr));
  assert.ok(/\bname\b/.test(r.stderr));
  assert.equal(r.html, null);
});

test('TS-NOGO-01 no Markdown', () => {
  const r = run(setup({ ...valid, about: '**bold** _x_' }));
  assert.ok(r.html.includes('**bold** _x_'));
  assert.ok(!/<(strong|em)>/.test(r.html));
});

test('TS-NOGO-02 one file only', () => {
  const s = setup(valid);
  run(s);
  assert.deepEqual(readdirSync(s.out), ['index.html']);
});

test('TS-NOGO-03 process exits on its own', () => {
  const r = run(setup(valid));
  assert.equal(r.status, 0);
  assert.equal(r.signal, null);
});
