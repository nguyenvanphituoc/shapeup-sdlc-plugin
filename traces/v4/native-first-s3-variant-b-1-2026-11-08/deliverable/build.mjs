// Build one static index.html from a content file.
// Contract: shapeup/personal-site/spec/usecases/UC-BuildPage.md (ContentSource, PageSink, Error Cases).
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const STYLE = `body{margin:0;font-family:system-ui,sans-serif;line-height:1.5;color:#222}
main{max-width:40rem;margin:0 auto;padding:2rem 1rem}
.card{border:1px solid #ddd;border-radius:6px;padding:0.75rem 1rem;margin:0.75rem 0}`;

function fail(message) {
  console.error(`error: ${String(message).replace(/\s*\n\s*/g, ' ')}`);
  process.exit(1);
}

function escape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function text(value) {
  return typeof value === 'string' ? escape(value) : '';
}

// http:, https: or relative only; anything else renders as plain text (INV-01, INV-06).
function safeUrl(url) {
  if (typeof url !== 'string') return null;
  const normalized = url.replace(/[\t\n\r]/g, '').replace(/^[\x00-\x20]+/, '');
  if (normalized === '') return null;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(normalized);
  if (scheme && !/^https?$/i.test(scheme[1])) return null;
  return url;
}

// ContentSource.load — reads only, never writes.
function load(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') fail(`content file not found: ${path}`);
    fail(`cannot read content file ${path}: ${err.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`content file ${path} cannot be parsed as JSON: ${err.message}`);
  }
}

function validate(content) {
  if (content === null || typeof content !== 'object' || Array.isArray(content)) {
    fail('content must be a JSON object with a non-empty string field "name"');
  }
  if (typeof content.name !== 'string' || content.name === '') {
    fail('field "name" is required and must be a non-empty string');
  }
}

function renderProject(project) {
  const p = project !== null && typeof project === 'object' ? project : {};
  const url = safeUrl(p.url);
  const title = url ? `<a href="${escape(url)}">${text(p.title)}</a>` : text(p.title);
  return `<article class="card"><h3>${title}</h3><p>${text(p.summary)}</p></article>`;
}

function render(content) {
  const projects = Array.isArray(content.projects) ? content.projects : [];
  const projectsBody = projects.length
    ? projects.map(renderProject).join('\n')
    : '<p>Projects are coming soon.</p>';
  const email = content.contact && typeof content.contact === 'object' ? content.contact.email : undefined;
  const contactBody = typeof email === 'string' && email !== ''
    ? `<p><a href="mailto:${escape(email)}">${escape(email)}</a></p>`
    : '<p></p>';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(content.name)}</title>
<style>
${STYLE}
</style>
</head>
<body>
<main>
<header>
<h1>${escape(content.name)}</h1>
<p>${text(content.tagline)}</p>
</header>
<section>
<h2>About</h2>
<p>${text(content.about)}</p>
</section>
<section>
<h2>Projects</h2>
${projectsBody}
</section>
<section>
<h2>Contact</h2>
${contactBody}
</section>
</main>
</body>
</html>
`;
}

// PageSink.write — called only after validation.
function write(outDir, html) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
}

const contentPath = resolve(process.env.CONTENT_FILE || 'content.json');
const outDir = resolve(process.env.OUT_DIR || 'dist');
const content = load(contentPath);
validate(content);
write(outDir, render(content));
