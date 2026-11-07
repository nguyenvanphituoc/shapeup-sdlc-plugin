// Independent evaluator probe, round 1 — drives `node build.mjs` as a process, never imports it.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = process.argv[2];
const buildPath = join(root, 'build.mjs');
const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');

function run(content, { raw = false, file, env: extra = {}, cwd, script = buildPath, noEnv = false } = {}) {
  const dir = cwd ?? mkdtempSync(join(tmpdir(), 'eval-probe-'));
  const f = file ?? join(dir, 'c.json');
  if (content !== undefined) writeFileSync(f, raw ? content : JSON.stringify(content));
  const out = join(dir, 'out');
  const env = noEnv ? { PATH: process.env.PATH } : { PATH: process.env.PATH, CONTENT_FILE: f, OUT_DIR: out, ...extra };
  const r = spawnSync(process.execPath, [script], { env, cwd: dir, encoding: 'utf8' });
  const idx = noEnv ? join(dir, 'dist', 'index.html') : join(out, 'index.html');
  return { dir, f, out, idx, status: r.status, stderr: r.stderr, stdout: r.stdout, html: existsSync(idx) ? readFileSync(idx, 'utf8') : null };
}
const results = [];
const check = (id, ok, detail) => { results.push({ id, ok: !!ok, detail }); };
const errShape = (r) => ({ status: r.status, lines: r.stderr.split('\n').filter(Boolean), outExists: existsSync(r.out), idx: existsSync(r.idx) });

const full = { name: 'Grace Hopper', tagline: 'Compilers & debugging', about: 'Navy rear admiral; wrote <A-0>.',
  projects: [{ title: 'COBOL', summary: 'business lang', url: 'https://example.org/cobol' }, { title: 'Bug', summary: 'moth', url: 'notes/bug.html' }],
  contact: { email: 'grace@example.org' } };

// TS-INV-01 — several unsafe schemes
{
  const urls = ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', '\njavascript:alert(1)', 'java\tscript:x', 'data:text/html,<script>x</script>', 'vbscript:x'];
  const r = run({ name: 'N', projects: urls.map((u, i) => ({ title: `T${i}`, url: u })) });
  const h = r.html ?? '';
  check('TS-INV-01', r.status === 0 && !/<script/i.test(h) && !/<[^>]*\son\w*\s*=/i.test(h) && !/javascript:/i.test(h) && !/<a[\s>]/.test(h) && urls.every((_, i) => h.includes(`T${i}`)),
    { status: r.status, anchors: (h.match(/<a[\s>]/g) || []).length, hasScript: /<script/i.test(h), hasJs: /javascript:/i.test(h) });
}
// TS-INV-02
{
  const dir = mkdtempSync(join(tmpdir(), 'eval-probe-'));
  const f = join(dir, 'c.json');
  writeFileSync(f, JSON.stringify(full, null, 4) + '\n');
  const before = sha(f);
  const r = run(undefined, { file: f, cwd: dir });
  const r2 = run(undefined, { file: f, cwd: dir });
  check('TS-INV-02', r.status === 0 && r2.status === 0 && sha(f) === before, { before, after: sha(f) });
}
// TS-INV-03
{
  const a = run(full), b = run(full);
  check('TS-INV-03', a.status === 0 && b.status === 0 && sha(a.idx) === sha(b.idx), { a: sha(a.idx), b: sha(b.idx), trailingNewline: a.html.endsWith('</html>\n') });
}
// TS-INV-04
{
  const r = run({ name: 'N & <Co>', tagline: "it's", projects: [{ title: '<b>Rock & Roll</b>', summary: '<i>x</i>', url: 'https://x.test/a?b="c"&d=\'e\'' }], contact: { email: 'a"b<c>@example.org' } });
  const h = r.html ?? '';
  check('TS-INV-04', r.status === 0 && h.includes('&lt;b&gt;Rock &amp; Roll&lt;/b&gt;') && !/<b>/.test(h) && !/<i>/.test(h)
    && h.includes('href="mailto:a&quot;b&lt;c&gt;@example.org"') && h.includes('href="https://x.test/a?b=&quot;c&quot;&amp;d=&#39;e&#39;"')
    && h.includes('<title>N &amp; &lt;Co&gt;</title>'),
    { status: r.status, mailto: (h.match(/href="mailto:[^"]*"/) || [])[0], projHref: (h.match(/href="https[^"]*"/) || [])[0] });
}
// TS-INV-05
{
  const r = run(full);
  const h = r.html ?? '';
  const h1s = h.match(/<h1[\s>][\s\S]*?<\/h1>/g) || [];
  const at = (s) => h.indexOf(s);
  const order = [at('<h1>'), at(full.tagline.replace('&', '&amp;')), at('<h2>About</h2>'), at('<h2>Projects</h2>'), at('<h2>Contact</h2>')];
  check('TS-INV-05', r.status === 0 && h1s.length === 1 && h1s[0] === '<h1>Grace Hopper</h1>' && h.includes('<title>Grace Hopper</title>')
    && order.every((v, i) => v >= 0 && (i === 0 || v > order[i - 1]))
    && (h.match(/class="card"/g) || []).length === 2 && h.includes('<a href="https://example.org/cobol">COBOL</a>') && h.includes('<a href="notes/bug.html">Bug</a>')
    && h.includes('<a href="mailto:grace@example.org">') && (h.match(/<style>/g) || []).length === 1 && at('<style>') < at('</head>') && !/<link/i.test(h),
    { status: r.status, h1s, order });
}
// TS-INV-06
{
  const r = run({ name: 'N', projects: [{ title: 'NoUrl', summary: 's' }, { title: 'Empty', url: '' }, { title: 'Ws', url: '   ' }] });
  const h = r.html ?? '';
  check('TS-INV-06', r.status === 0 && h.includes('NoUrl') && h.includes('Empty') && !/<a[\s>]/.test(h) && !h.includes('href="#"') && !h.includes('href=""') && !/undefined|null/.test(h),
    { status: r.status, anchors: (h.match(/<a[^>]*>/g) || []) });
}
// TS-INV-07
{
  const rs = [run({ name: 'N', projects: [] }), run({ name: 'N' })];
  check('TS-INV-07', rs.every((r) => r.status === 0 && r.html.includes('Projects are coming soon.') && !/<(ul|ol|li)[\s>]/i.test(r.html)), rs.map((r) => r.status));
}
// TS-ERR-CONTENT_MISSING
{
  const dir = mkdtempSync(join(tmpdir(), 'eval-probe-'));
  const missing = join(dir, 'absent', 'content.json');
  const r = run(undefined, { file: missing, cwd: dir });
  const e = errShape(r);
  check('TS-ERR-CONTENT_MISSING', e.status === 1 && e.lines.length === 1 && e.lines[0].includes(missing) && !e.idx, { ...e });
}
// TS-ERR-CONTENT_UNPARSEABLE
{
  const r = run('{not json', { raw: true });
  const e = errShape(r);
  check('TS-ERR-CONTENT_UNPARSEABLE', e.status === 1 && e.lines.length === 1 && e.lines[0].includes(r.f) && !e.idx, { ...e });
}
// TS-REQ-name-missing
{
  const r = run({ tagline: 't', projects: [] });
  const e = errShape(r);
  check('TS-REQ-name-missing', e.status === 1 && e.lines.length === 1 && e.lines[0].includes('name') && !e.idx, { ...e });
}
// TS-REQ-name-type
{
  const variants = [{ name: 42 }, { name: '' }, { name: null }, { name: ['x'] }];
  const es = variants.map((v) => errShape(run(v)));
  check('TS-REQ-name-type', es.every((e) => e.status === 1 && e.lines.length === 1 && e.lines[0].includes('name') && !e.idx), es);
}
// TS-NOGO-01
{
  const r = run({ name: 'N', about: '**bold** _x_ # h' });
  check('TS-NOGO-01', r.status === 0 && r.html.includes('**bold** _x_ # h') && !/<(strong|em)[\s>]/i.test(r.html), { status: r.status });
}
// TS-NOGO-02
{
  const dir = mkdtempSync(join(tmpdir(), 'eval-probe-'));
  const script = join(dir, 'build.mjs');
  copyFileSync(buildPath, script);
  const r = run(full, { script, cwd: dir });
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  check('TS-NOGO-02', r.status === 0 && r.html && !existsSync(join(dir, 'node_modules')) && (!pkg.dependencies || Object.keys(pkg.dependencies).length === 0),
    { status: r.status, dirListing: readdirSync(dir), pkgDeps: pkg.dependencies ?? null });
}
// Step 1 defaults: no env, content.json in cwd → dist/index.html
{
  const dir = mkdtempSync(join(tmpdir(), 'eval-probe-'));
  writeFileSync(join(dir, 'content.json'), JSON.stringify(full));
  const r = run(undefined, { cwd: dir, file: join(dir, 'content.json'), noEnv: true });
  check('UC-Step-1-defaults', r.status === 0 && r.html !== null && r.stderr === '' && readdirSync(join(dir, 'dist')).join() === 'index.html', { status: r.status, stderr: r.stderr });
}
// Error on defaults path: no content.json in cwd → exit 1, no dist/
{
  const dir = mkdtempSync(join(tmpdir(), 'eval-probe-'));
  const r = spawnSync(process.execPath, [buildPath], { env: { PATH: process.env.PATH }, cwd: dir, encoding: 'utf8' });
  const lines = r.stderr.split('\n').filter(Boolean);
  check('UC-Step-6-default-missing', r.status === 1 && lines.length === 1 && lines[0].includes(join(dir, 'content.json').replace(/^\/private/, '')) && !existsSync(join(dir, 'dist')), { status: r.status, lines });
}
// Domain: absent optional fields render empty, never 'undefined'/'null'
{
  const r = run({ name: 'N', projects: [{ title: 'T' }], contact: {} });
  check('DM-SiteContent-optional-empty', r.status === 0 && !/undefined|null/.test(r.html) && r.html.includes('<h2>About</h2>') && r.html.includes('<h2>Contact</h2>'), { status: r.status });
}
// Pitch verification entry point as package.json names it: `npm test` → node --test
{
  const r = spawnSync('npm', ['test', '--silent'], { cwd: root, encoding: 'utf8', env: process.env });
  check('INFO-npm-test', r.status === 0, { status: r.status, tail: (r.stdout || '').split('\n').filter((l) => /^ℹ (tests|pass|fail)/.test(l)) });
}

check('INFO-check-file-sha256', true, { 'test/build.test.mjs': sha(join(root, 'test/build.test.mjs')), 'build.mjs': sha(buildPath),
  't0': sha(join(root, '.shapeup/personal-site/t0/verdicts/r1-a1-t1.json')), 'build_gate': sha(join(root, '.shapeup/personal-site/build/r1-t1.json')) });

for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.id} ${JSON.stringify(r.detail)}`);
process.exit(results.some((r) => !r.ok && !r.id.startsWith('INFO')) ? 1 : 0);
