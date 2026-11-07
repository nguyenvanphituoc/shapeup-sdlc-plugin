import { test } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = {
  name: 'Jane',
  tagline: 'Hi',
  about: 'About me',
  projects: [
    { title: 'A', summary: 's', url: 'https://example.com/a' },
    { title: 'B', summary: 's', url: 'https://example.com/b' },
  ],
  contact: { email: 'j@example.com' },
};

function run(content, raw) {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  const file = join(dir, 'c.json');
  const out = join(dir, 'out');
  writeFileSync(file, raw ?? JSON.stringify(content));
  const r = spawnSync('node', ['build.mjs'], {
    env: { ...process.env, CONTENT_FILE: file, OUT_DIR: out },
    encoding: 'utf8',
  });
  const index = join(out, 'index.html');
  return { r, out, index, html: existsSync(index) ? readFileSync(index, 'utf8') : null };
}

const oneLine = (s) => s.endsWith('\n') && s.trim().split('\n').length === 1;

test('TS-INV-01 byte-identical rebuild', () => {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  const file = join(dir, 'c.json');
  writeFileSync(file, JSON.stringify(base));
  const env = { ...process.env, CONTENT_FILE: file, OUT_DIR: join(dir, 'out') };
  spawnSync('node', ['build.mjs'], { env });
  const a = readFileSync(join(dir, 'out', 'index.html'));
  spawnSync('node', ['build.mjs'], { env });
  const b = readFileSync(join(dir, 'out', 'index.html'));
  assert.ok(a.equals(b));
});

test('TS-INV-02 failed build writes no index.html', () => {
  const x = run(null, '{not json');
  assert.strictEqual(x.r.status, 1);
  assert.ok(!existsSync(x.index));
});

test('TS-INV-03 text is escaped', () => {
  const x = run({ ...base, projects: [{ title: '<b>Rock & Roll</b>', summary: 's' }] });
  assert.ok(x.html.includes('&lt;b&gt;Rock &amp; Roll&lt;/b&gt;'));
  assert.ok(!x.html.includes('<b>Rock'));
});

test('TS-INV-04 exactly one h1 with name', () => {
  const x = run(base);
  assert.strictEqual((x.html.match(/<h1/g) || []).length, 1);
  assert.match(x.html, /<h1>Jane<\/h1>/);
});

test('TS-INV-05 project without url is plain text', () => {
  const x = run({ ...base, projects: [{ title: 'NoLink', summary: 's' }] });
  assert.ok(x.html.includes('NoLink'));
  assert.ok(!/<a[^>]*>\s*NoLink/.test(x.html));
  assert.ok(!x.html.includes('href="#"'));
  assert.ok(!x.html.includes('href=""'));
});

test('TS-INV-06 empty projects shows coming soon, no list', () => {
  const x = run({ ...base, projects: [] });
  assert.ok(x.html.includes('Projects are coming soon.'));
  assert.ok(!/<(ul|ol|li)[\s>]/.test(x.html));
});

test('TS-ERR-CONTENT_MISSING', () => {
  const dir = mkdtempSync(join(tmpdir(), 'site-'));
  const out = join(dir, 'out');
  const r = spawnSync('node', ['build.mjs'], {
    env: { ...process.env, CONTENT_FILE: join(dir, 'nope.json'), OUT_DIR: out },
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 1);
  assert.ok(oneLine(r.stderr));
  assert.ok(!existsSync(join(out, 'index.html')));
});

test('TS-ERR-CONTENT_INVALID_JSON', () => {
  const x = run(null, '{not json');
  assert.strictEqual(x.r.status, 1);
  assert.ok(oneLine(x.r.stderr));
  assert.ok(!existsSync(x.index));
});

test('TS-ERR-NAME_MISSING', () => {
  const noName = { ...base };
  delete noName.name;
  const x = run(noName);
  assert.strictEqual(x.r.status, 1);
  assert.ok(oneLine(x.r.stderr));
  assert.ok(!existsSync(x.index));
});

test('TS-NOGO-01 no markdown rendering', () => {
  const x = run({ ...base, about: '**bold** text' });
  assert.ok(x.html.includes('**bold** text'));
  assert.ok(!/<(strong|em)[\s>]/.test(x.html));
});

test('TS-NOGO-03 only index.html written', () => {
  const x = run(base);
  assert.deepStrictEqual(readdirSync(x.out).filter((f) => f.endsWith('.html')), ['index.html']);
});

test('TS-NOGO-05 process exits on its own', () => {
  const x = run(base);
  assert.strictEqual(x.r.status, 0);
  assert.strictEqual(x.r.signal, null);
});
