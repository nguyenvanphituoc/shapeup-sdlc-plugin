import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const contentPath = process.env.CONTENT_FILE || "content.json";
const outDir = process.env.OUT_DIR || "dist";

function fail(message) {
  process.stderr.write(message.replace(/\s*\n\s*/g, " ") + "\n");
  process.exit(1);
}

const esc = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

let raw;
try {
  raw = readFileSync(contentPath, "utf8");
} catch (err) {
  fail(`content file not found or unreadable: ${contentPath}`);
}

let content;
try {
  content = JSON.parse(raw);
} catch (err) {
  fail(`content file ${contentPath} is not valid JSON: ${err.message}`);
}

if (content === null || typeof content !== "object" || content.name === undefined || content.name === null || content.name === "") {
  fail(`content file ${contentPath} is missing required field: name`);
}

function renderProject(p) {
  const title = p.url ? `<a href="${esc(p.url)}">${esc(p.title)}</a>` : esc(p.title);
  return `<li class="card"><h3>${title}</h3><p>${esc(p.summary ?? "")}</p></li>`;
}

const projects = Array.isArray(content.projects) ? content.projects : [];
const projectsHtml = projects.length
  ? `<ul>${projects.map(renderProject).join("")}</ul>`
  : `<p>Projects are coming soon.</p>`;

const email = content.contact && content.contact.email;
const contactHtml = email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "";

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(content.name)}</title>
<style>
body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem;line-height:1.5}
ul{list-style:none;padding:0}
.card{border:1px solid #ccc;padding:.5rem 1rem;margin:.5rem 0}
</style>
</head>
<body>
<header>
<h1>${esc(content.name)}</h1>
<p>${esc(content.tagline ?? "")}</p>
</header>
<section id="about">
<h2>About</h2>
<p>${esc(content.about ?? "")}</p>
</section>
<section id="projects">
<h2>Projects</h2>
${projectsHtml}
</section>
<section id="contact">
<h2>Contact</h2>
${contactHtml}
</section>
</body>
</html>
`;

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "index.html"), html, "utf8");
