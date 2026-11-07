import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const contentPath = process.env.CONTENT_FILE || 'content.json';
const outDir = process.env.OUT_DIR || 'dist';

const esc = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fail = (msg) => {
  process.stderr.write(`build: ${msg}\n`);
  process.exit(1);
};

function load() {
  let raw;
  try {
    raw = readFileSync(contentPath, 'utf8');
  } catch {
    fail(`cannot read ${contentPath}`);
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    fail(`${contentPath} is not valid JSON`);
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    fail(`${contentPath} must be a JSON object`);
  }
  if (typeof data.name !== 'string' || data.name.trim() === '') {
    fail('content is missing required field "name"');
  }
  return data;
}

const isHttp = (u) => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u.trim());

function renderProject(p) {
  const proj = p && typeof p === 'object' ? p : {};
  const title = esc(proj.title ?? '');
  const head = isHttp(proj.url)
    ? `<a href="${esc(proj.url.trim())}">${title}</a>`
    : title;
  const summary = proj.summary ? `\n        <p>${esc(proj.summary)}</p>` : '';
  return `      <li class="card">\n        <h3>${head}</h3>${summary}\n      </li>`;
}

function render(c) {
  const name = esc(c.name);
  const tagline = c.tagline ? `\n    <p class="tagline">${esc(c.tagline)}</p>` : '';
  const about = c.about ? `\n    <p>${esc(c.about)}</p>` : '';
  const projects = Array.isArray(c.projects) ? c.projects : [];
  const projectsBody = projects.length
    ? `\n    <ul>\n${projects.map(renderProject).join('\n')}\n    </ul>`
    : '\n    <p>Projects are coming soon.</p>';
  const email = c.contact && typeof c.contact.email === 'string' ? c.contact.email.trim() : '';
  const contact = email
    ? `\n    <p><a href="mailto:${esc(email)}">${esc(email)}</a></p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
ul{list-style:none;padding:0}
.card{margin:1rem 0}
</style>
</head>
<body>
  <header>
    <h1>${name}</h1>${tagline}
  </header>
  <section id="about">
    <h2>About</h2>${about}
  </section>
  <section id="projects">
    <h2>Projects</h2>${projectsBody}
  </section>
  <section id="contact">
    <h2>Contact</h2>${contact}
  </section>
</body>
</html>
`;
}

const html = render(load());
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html, 'utf8');
