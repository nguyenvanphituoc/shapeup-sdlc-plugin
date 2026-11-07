import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const script = join(root, 'build.mjs');

function run(content, raw = false) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  const contentFile = join(dir, 'c.json');
  if (content !== undefined) writeFileSync(contentFile, raw ? content : JSON.stringify(content));
  const outDir = join(dir, 'out');
  const r = spawnSync(process.execPath, [script], {
    cwd: dir,
    env: { ...process.env, CONTENT_FILE: contentFile, OUT_DIR: outDir },
    encoding: 'utf8',
  });
  const file = join(outDir, 'index.html');
  return { ...r, outDir, file, html: existsSync(file) ? readFileSync(file, 'utf8') : null };
}

const full = {
  name: 'Jane',
  tagline: 'Maker',
  about: 'About <i>me</i>',
  projects: [
    { title: '<b>Rock & Roll</b>', summary: 's1', url: 'https://a.example/x' },
    { title: 'Two', url: 'http://b.example' },
    { title: 'Three', url: 'https://c.example' },
  ],
  contact: { email: 'j@example.com' },
};

test('layout order, title, mailto, cards in order', () => {
  const r = run(full);
  assert.equal(r.status, 0);
  const h = r.html;
  assert.equal((h.match(/<h1>/g) || []).length, 1);
  assert.match(h, /<title>Jane<\/title>/);
  assert.match(h, /<h1>Jane<\/h1>\s*<p>Maker<\/p>/);
  const i = ['>About<', '>Projects<', '>Contact<'].map((s) => h.indexOf(s));
  assert.ok(i[0] > 0 && i[0] < i[1] && i[1] < i[2]);
  assert.match(h, /href="mailto:j@example\.com"/);
  assert.equal((h.match(/class="card"/g) || []).length, 3);
  assert.ok(h.indexOf('a.example') < h.indexOf('b.example') && h.indexOf('b.example') < h.indexOf('c.example'));
  assert.match(h, /<a href="https:\/\/a\.example\/x">/);
});

test('no script, no external resource, inline style', () => {
  const h = run(full).html;
  assert.ok(!/<script/i.test(h));
  assert.match(h, /<style>/);
  assert.ok(!/<link/i.test(h));
  assert.ok(!/\bsrc=/i.test(h));
});

test('escaping', () => {
  const h = run(full).html;
  assert.ok(h.includes('&lt;b&gt;Rock &amp; Roll&lt;/b&gt;'));
  assert.ok(!h.includes('<b>'));
  assert.ok(!h.includes('<i>'));
});

test('determinism', () => {
  assert.equal(run(full).html, run(full).html);
});

test('url-less and non-http url projects are plain text', () => {
  const h = run({ name: 'n', projects: [{ title: 'NoUrl' }, { title: 'Evil', url: 'javascript:alert(1)' }] }).html;
  assert.ok(h.includes('NoUrl') && h.includes('Evil'));
  assert.ok(!h.includes('href="#"') && !h.includes('href=""'));
  assert.ok(!/javascript:/.test(h));
});

test('zero or absent projects', () => {
  for (const c of [{ name: 'n', projects: [] }, { name: 'n' }]) {
    const h = run(c).html;
    assert.ok(h.includes('Projects are coming soon.'));
    const section = h.slice(h.indexOf('id="projects"'), h.indexOf('id="contact"'));
    assert.ok(!/<(ul|ol|li)\b/.test(section));
  }
});

test('env overrides write only index.html into OUT_DIR', () => {
  const r = run(full);
  assert.ok(existsSync(r.file));
  assert.deepEqual(readdirSync(r.outDir), ['index.html']);
});

const failures = [
  ['CONTENT_MISSING', undefined],
  ['CONTENT_INVALID_JSON', '{not json'],
  ['CONTENT_BAD_SHAPE', 'null'],
  ['CONTENT_BAD_SHAPE', '[]'],
  ['CONTENT_BAD_SHAPE', '{"name":"x","projects":"y"}'],
  ['NAME_MISSING', '{}'],
  ['NAME_MISSING', '{"name":""}'],
  ['NAME_MISSING', '{"name":5}'],
];
for (const [code, raw] of failures) {
  test(`failure ${code} ${raw}`, () => {
    const r = run(raw, true);
    assert.equal(r.status, 1);
    const lines = r.stderr.split('\n').filter(Boolean);
    assert.equal(lines.length, 1);
    assert.ok(lines[0].includes(code));
    assert.ok(!/\bat \S+ \(/.test(r.stderr));
    assert.ok(!existsSync(r.file));
  });
}

test('real content.json is valid and never modified', () => {
  const p = join(root, 'content.json');
  const hash = () => createHash('sha256').update(readFileSync(p)).digest('hex');
  const before = hash();
  const r = run(JSON.parse(readFileSync(p, 'utf8')));
  assert.equal(r.status, 0);
  assert.equal(hash(), before);
});

test('source has no Date, Math.random, network or non-node imports', () => {
  const src = readFileSync(script, 'utf8');
  assert.ok(!/\bDate\b/.test(src) && !/Math\.random/.test(src));
  assert.ok(!/fetch\(|node:https?|node:net/.test(src));
  for (const m of src.matchAll(/from '([^']+)'/g)) assert.ok(m[1].startsWith('node:'));
});
