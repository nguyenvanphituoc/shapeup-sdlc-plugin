import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

class BuildFailure extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function load(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new BuildFailure('CONTENT_MISSING', 'content file is missing or unreadable');
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BuildFailure('CONTENT_INVALID_JSON', 'content file is not valid JSON');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data) ||
      (data.projects !== undefined && !Array.isArray(data.projects))) {
    throw new BuildFailure('CONTENT_BAD_SHAPE', 'content must be an object and projects must be an array');
  }
  if (typeof data.name !== 'string' || data.name.trim() === '') {
    throw new BuildFailure('NAME_MISSING', 'name must be a non-empty string');
  }
  return { ...data, projects: data.projects ?? [] };
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\/\S+$/i.test(url.trim());
}

const CSS = 'body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}.card{border:1px solid #ccc;padding:.75rem;margin:.5rem 0}';

function renderProject(p) {
  const item = p !== null && typeof p === 'object' ? p : {};
  const title = esc(item.title);
  const head = isHttpUrl(item.url) ? `<a href="${esc(item.url.trim())}">${title}</a>` : title;
  const summary = item.summary ? `\n<p>${esc(item.summary)}</p>` : '';
  return `<article class="card">\n<h3>${head}</h3>${summary}\n</article>`;
}

function render(c) {
  const tagline = c.tagline ? `\n<p>${esc(c.tagline)}</p>` : '';
  const projects = c.projects.length
    ? c.projects.map(renderProject).join('\n')
    : '<p>Projects are coming soon.</p>';
  const email = c.contact && typeof c.contact.email === 'string' ? c.contact.email : '';
  const contact = email
    ? `<p><a href="mailto:${esc(email)}">${esc(email)}</a></p>`
    : '';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.name)}</title>
<style>${CSS}</style>
</head>
<body>
<header>
<h1>${esc(c.name)}</h1>${tagline}
</header>
<section id="about">
<h2>About</h2>
<p>${esc(c.about)}</p>
</section>
<section id="projects">
<h2>Projects</h2>
${projects}
</section>
<section id="contact">
<h2>Contact</h2>
${contact}
</section>
</body>
</html>
`;
}

try {
  const contentFile = process.env.CONTENT_FILE || 'content.json';
  const outDir = process.env.OUT_DIR || 'dist';
  const html = render(load(contentFile));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html, 'utf8');
} catch (err) {
  const code = err instanceof BuildFailure ? err.code : 'BUILD_FAILED';
  const msg = err instanceof BuildFailure ? err.message : 'unexpected error';
  process.stderr.write(`build error ${code}: ${msg}\n`);
  process.exit(1);
}
