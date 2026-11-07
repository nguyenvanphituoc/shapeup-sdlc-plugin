import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fail = (msg) => {
  process.stderr.write(msg.replace(/\s*[\r\n]+\s*/g, ' ') + '\n');
  process.exit(1);
};

const contentFile = process.env.CONTENT_FILE || 'content.json';
const outDir = process.env.OUT_DIR || 'dist';

let raw;
try {
  raw = readFileSync(contentFile, 'utf8');
} catch {
  fail(`CONTENT_MISSING: cannot read content file ${contentFile}`);
}

let content;
try {
  content = JSON.parse(raw);
} catch (e) {
  fail(`CONTENT_INVALID_JSON: ${contentFile} is not valid JSON (${e.message})`);
}

if (content === null || typeof content !== 'object' || content.name === undefined || content.name === null || content.name === '') {
  fail(`NAME_MISSING: required field "name" is absent in ${contentFile}`);
}

const projects = Array.isArray(content.projects) ? content.projects : [];
const email = content.contact && content.contact.email;

const card = (p) => {
  const title = p.url
    ? `<a href="${esc(p.url)}">${esc(p.title)}</a>`
    : esc(p.title);
  return `<article class="card"><h3>${title}</h3><p>${esc(p.summary)}</p></article>`;
};

const projectsBody = projects.length
  ? projects.map(card).join('\n')
  : '<p>Projects are coming soon.</p>';

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(content.name)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:40rem;margin:0 auto;padding:1rem;line-height:1.5}
.card{border:1px solid #ccc;padding:.5rem 1rem;margin:.5rem 0}
</style>
</head>
<body>
<header>
<h1>${esc(content.name)}</h1>
<p>${esc(content.tagline)}</p>
</header>
<section id="about">
<h2>About</h2>
<p>${esc(content.about)}</p>
</section>
<section id="projects">
<h2>Projects</h2>
${projectsBody}
</section>
<section id="contact">
<h2>Contact</h2>
<p><a href="mailto:${esc(email)}">${esc(email)}</a></p>
</section>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
