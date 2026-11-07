import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const S = '/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer/.shapeup/one-page-site/qa/work';
mkdirSync(S, { recursive: true });
const B = '/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer/build.mjs';
const cases = {
  a: '{"name":"X","projects":"abc"}',
  b: '{"name":"X","projects":[null,1,"s"]}',
  c: '{"name":"X","projects":[{"title":"T","url":"https://a.com/\\"onmouseover=x"}]}',
  d: '{"name":"X","projects":[{"title":"T","url":"HTTPS://a.com"}]}',
  e: '{"name":"X","contact":{"email":"a\\"b@x.com"}}',
  f: '{"name":"X","contact":"a@b.c"}',
  g: '{"name":["a"]}',
  h: '{"name":"X","tagline":5,"about":{"a":1}}',
  i: '{"name":"X","projects":[{"title":"T","url":"https://a.com/ b"}]}',
  j: '{"name":"X","projects":[{"title":{"a":1},"summary":["x"]}]}',
  l: '{"name":"X","contact":{"email":"mailto:evil@x.com?cc=a&subject=hi"}}',
  m: '',
  n: '﻿{"name":"BOM"}',
  p: '{"name":"X","projects":[{"title":"T","url":"ftp://a.com"}]}',
  r: '{"name":"  X  ","tagline":"  "}',
  s: '{"name":"X","projects":[{"title":"T","url":"https://"}]}',
};
for (const [k, v] of Object.entries(cases)) {
  writeFileSync(`${S}/${k}.json`, v);
  const r = spawnSync('node', [B], { env: { ...process.env, CONTENT_FILE: `${S}/${k}.json`, OUT_DIR: `${S}/out-${k}` }, encoding: 'utf8' });
  const f = `${S}/out-${k}/index.html`;
  const h = existsSync(f) ? readFileSync(f, 'utf8') : null;
  console.log(`== ${k} exit=${r.status} stderr=${JSON.stringify(r.stderr.slice(0, 300))} out=${h ? 'written' : 'none'}`);
  if (h) console.log(h.split('<body>')[1].replace(/\n\s*/g, ' ').slice(0, 700));
}
const r1 = spawnSync('node', [B], { env: { ...process.env, CONTENT_FILE: S, OUT_DIR: `${S}/zz` }, encoding: 'utf8' });
console.log('dir content', r1.status, JSON.stringify(r1.stderr));
writeFileSync(`${S}/blocker`, 'x');
const r2 = spawnSync('node', [B], { env: { ...process.env, CONTENT_FILE: `${S}/b.json`, OUT_DIR: `${S}/blocker` }, encoding: 'utf8' });
console.log('outdir is file', r2.status, JSON.stringify(r2.stderr.slice(0, 400)));
