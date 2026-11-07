import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BUILD = resolve('build.mjs');

const full = {
  name: 'Ada Lovelace',
  tagline: 'Analyst',
  about: 'About text here.',
  projects: [
    { title: 'Alpha', summary: 'a', url: 'https://a.example' },
    { title: 'Beta', summary: 'b', url: 'http://b.example' },
    { title: 'Gamma', summary: 'c', url: 'https://c.example' },
  ],
  contact: { email: 'ada@example.com' },
};

function exec(env) {
  return spawnSync('node', [BUILD], { env: { ...process.env, ...env }, encoding: 'utf8' });
}

function run(content, { raw, missing } = {}) {
  const tmp = mkdtempSync(join(tmpdir(), 'site-'));
  const file = join(tmp, 'c.json');
  if (!missing) writeFileSync(file, raw ?? JSON.stringify(content));
  const out = join(tmp, 'out');
  const r = exec({ CONTENT_FILE: file, OUT_DIR: out });
  const page = join(out, 'index.html');
  return { r, file, out, page, html: existsSync(page) ? readFileSync(page, 'utf8') : null };
}

const lines = (s) => s.split('\n').filter((l) => l.length);
const sorted = (a) => [...a].sort((x, y) => x - y);

test('TS-INV-01 byte-identical builds', () => {
  const a = run(full);
  const b = exec({ CONTENT_FILE: a.file, OUT_DIR: a.out });
  assert.strictEqual(b.status, 0);
  assert.strictEqual(readFileSync(a.page, 'utf8'), a.html);
});

test('TS-INV-02 no script, handlers, link, src; one style', () => {
  const { html } = run(full);
  assert.ok(!/<script/i.test(html));
  assert.ok(!/\son\w+\s*=/i.test(html));
  assert.ok(!/<link/i.test(html));
  assert.ok(!/src=/i.test(html));
  assert.strictEqual(html.match(/<style>/g).length, 1);
});

test('TS-INV-03 content file unchanged', () => {
  const a = run(full);
  const before = readFileSync(a.file);
  exec({ CONTENT_FILE: a.file, OUT_DIR: a.out });
  assert.deepStrictEqual(readFileSync(a.file), before);
});

test('TS-INV-04 content is escaped', () => {
  const { html } = run({ ...full, projects: [{ title: '<b>Rock & Roll</b>' }] });
  assert.ok(html.includes('&lt;b&gt;Rock &amp; Roll&lt;/b&gt;'));
  assert.ok(!html.includes('<b>'));
});

test('TS-INV-05 no url renders plain title', () => {
  const { html } = run({ ...full, projects: [{ title: 'Plain', url: '' }, { title: 'NoUrl' }] });
  assert.ok(html.includes('Plain') && html.includes('NoUrl'));
  assert.ok(!html.includes('href="#"'));
  assert.ok(!html.includes('href=""'));
  assert.ok(!/<a [^>]*>(Plain|NoUrl)/.test(html));
});

test('TS-INV-06 exactly one h1 equal to name', () => {
  const { html } = run(full);
  assert.strictEqual(html.match(/<h1/g).length, 1);
  assert.ok(html.includes('<h1>Ada Lovelace</h1>'));
});

test('TS-REQ-projects-empty', () => {
  for (const c of [{ ...full, projects: [] }, { name: 'X' }]) {
    const { html } = run(c);
    assert.ok(html.includes('Projects are coming soon.'));
    assert.ok(!/<ul|<li/.test(html));
  }
});

test('TS-REQ-projects-order', () => {
  const { html } = run(full);
  const idx = full.projects.map((p) => html.indexOf(`<a href="${p.url}">${p.title}</a>`));
  assert.ok(idx.every((i) => i >= 0));
  assert.deepStrictEqual(sorted(idx), idx);
  assert.strictEqual(html.match(/class="card"/g).length, 3);
});

test('TS-REQ-layout', () => {
  const { html } = run(full);
  assert.ok(html.includes('<title>Ada Lovelace</title>'));
  const order = ['<h1>', 'Analyst', 'About text here.', '>Projects<', 'mailto:ada@example.com'].map((s) =>
    html.indexOf(s),
  );
  assert.ok(order.every((i) => i >= 0));
  assert.deepStrictEqual(sorted(order), order);
});

test('TS-REQ-env-override', () => {
  const { r, page } = run(full);
  assert.strictEqual(r.status, 0);
  assert.ok(existsSync(page));
});

test('TS-NOGO-01 only node: imports, build succeeds', () => {
  const src = readFileSync(BUILD, 'utf8');
  const specs = [...src.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]);
  assert.ok(specs.length > 0);
  assert.ok(specs.every((s) => s.startsWith('node:')));
  assert.ok(!/node:(http|https|net|dns|tls)/.test(src));
  assert.strictEqual(run(full).r.status, 0);
});

test('TS-NOGO-02 javascript: url not linked', () => {
  const { html } = run({ ...full, projects: [{ title: 'Evil', url: 'javascript:alert(1)' }] });
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('<script'));
});

test('TS-NOGO-03 content file hash unchanged by build', () => {
  const a = run(full);
  const before = readFileSync(a.file);
  exec({ CONTENT_FILE: a.file, OUT_DIR: a.out });
  assert.deepStrictEqual(readFileSync(a.file), before);
});

const bad = [
  [null, { missing: true }],
  [null, { raw: '{not json' }],
  [null, { raw: 'null' }],
  [null, { raw: '[]' }],
  [{ tagline: 'x' }, {}],
  [{ name: '' }, {}],
  [{ name: '   ' }, {}],
  [{ name: 5 }, {}],
];

test('TS-INV-01 reject: nothing written on failure', () => {
  for (const [c, o] of bad) {
    const x = run(c, o);
    assert.strictEqual(x.r.status, 1);
    assert.ok(!existsSync(x.page));
    assert.ok(!existsSync(x.out));
  }
});

test('TS-INV-02 reject: exactly one stderr line, no stack', () => {
  for (const [c, o] of bad) {
    const x = run(c, o);
    assert.strictEqual(lines(x.r.stderr).length, 1);
    assert.ok(!/^\s+at /m.test(x.r.stderr));
  }
});

test('TS-ERR-E_CONTENT_MISSING', () => {
  const x = run(null, { missing: true });
  assert.strictEqual(x.r.status, 1);
  assert.ok(x.r.stderr.includes(x.file));
});

test('TS-ERR-E_CONTENT_INVALID', () => {
  for (const raw of ['{not json', 'null']) {
    const x = run(null, { raw });
    assert.strictEqual(x.r.status, 1);
    assert.strictEqual(lines(x.r.stderr).length, 1);
  }
});

test('TS-ERR-E_NAME_MISSING', () => {
  for (const c of [{ tagline: 'x' }, { name: '' }]) {
    const x = run(c);
    assert.strictEqual(x.r.status, 1);
    assert.ok(x.r.stderr.includes('name'));
  }
});

test('TS-REQ-name-missing', () => {
  const x = run({ tagline: 'x' });
  assert.strictEqual(x.r.status, 1);
  assert.ok(!existsSync(x.page));
});
