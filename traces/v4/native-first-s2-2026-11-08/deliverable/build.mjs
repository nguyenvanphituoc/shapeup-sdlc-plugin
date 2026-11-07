import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const contentFile = process.env.CONTENT_FILE || 'content.json';
const outDir = process.env.OUT_DIR || 'dist';

const fail = (msg) => {
  console.error(String(msg).replace(/\s*[\r\n]+\s*/g, ' '));
  process.exit(1);
};

const esc = (v) =>
  String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function load(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (e) {
    return fail(`CONTENT_MISSING: cannot read content file ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fail(`CONTENT_INVALID_JSON: ${path}: ${e.message}`);
  }
}

const css = `body{max-width:40rem;margin:0 auto;padding:1rem;font-family:sans-serif;line-height:1.5}
article{margin:1rem 0;padding:.5rem 0;border-top:1px solid #ccc}`;

function render(c) {
  const parts = [];
  parts.push(`<header>\n<h1>${esc(c.name)}</h1>`);
  if (c.tagline) parts.push(`<p>${esc(c.tagline)}</p>`);
  parts.push('</header>');

  parts.push(`<section id="about">\n<h2>About</h2>\n<p>${c.about ? esc(c.about) : ''}</p>\n</section>`);

  const projects = Array.isArray(c.projects) ? c.projects : [];
  const cards = projects.map((p) => {
    const title = p && p.title != null ? esc(p.title) : '';
    const head = p && p.url ? `<a href="${esc(p.url)}">${title}</a>` : title;
    const summary = p && p.summary ? `\n<p>${esc(p.summary)}</p>` : '';
    return `<article>\n<h3>${head}</h3>${summary}\n</article>`;
  });
  parts.push(
    `<section id="projects">\n<h2>Projects</h2>\n${
      cards.length ? cards.join('\n') : '<p>Projects are coming soon.</p>'
    }\n</section>`
  );

  const email = c.contact && c.contact.email;
  parts.push(
    `<section id="contact">\n<h2>Contact</h2>\n${
      email ? `<p><a href="mailto:${esc(email)}">${esc(email)}</a></p>` : ''
    }\n</section>`
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.name)}</title>
<style>
${css}
</style>
</head>
<body>
${parts.join('\n')}
</body>
</html>
`;
}

const content = load(contentFile);
if (
  content === null ||
  typeof content !== 'object' ||
  Array.isArray(content) ||
  content.name === undefined ||
  content.name === null ||
  content.name === ''
) {
  fail('NAME_MISSING: content is missing required field name');
}
const html = render(content);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
