import { test } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = { name: "Ada", tagline: "Tag", about: "About me", projects: [{ title: "P1", summary: "S1", url: "https://x.test/p1" }], contact: { email: "a@x.test" } };

function run(file, out) {
  return spawnSync(process.execPath, ["build.mjs"], { env: { ...process.env, CONTENT_FILE: file, OUT_DIR: out }, encoding: "utf8" });
}

function build(content, raw) {
  const dir = mkdtempSync(join(tmpdir(), "site-"));
  const file = join(dir, "c.json");
  const out = join(dir, "out");
  if (content !== undefined) writeFileSync(file, raw ?? JSON.stringify(content));
  const r = run(file, out);
  const page = join(out, "index.html");
  return { r, file, out, page, html: existsSync(page) ? readFileSync(page, "utf8") : null };
}
const oneLine = (s) => s.split("\n").filter(Boolean).length === 1;

test("TS-INV-01 content file untouched", () => {
  const b = build(base);
  const before = readFileSync(b.file, "utf8");
  const r2 = run(b.file, b.out);
  assert.equal(b.r.status, 0);
  assert.equal(r2.status, 0);
  assert.equal(readFileSync(b.file, "utf8"), before);
});

test("TS-INV-02 deterministic", () => {
  const b = build(base);
  const first = b.html;
  assert.equal(run(b.file, b.out).status, 0);
  assert.equal(readFileSync(b.page, "utf8"), first);
});

test("TS-INV-03 failed build writes nothing", () => {
  const b = build(null, "{not json");
  assert.equal(b.r.status, 1);
  assert.equal(existsSync(b.page), false);
});

test("TS-INV-04 escaping", () => {
  const b = build({ ...base, projects: [{ title: "<b>Rock & Roll</b>", summary: "s" }] });
  assert.ok(b.html.includes("&lt;b&gt;Rock &amp; Roll&lt;/b&gt;"));
  assert.ok(!b.html.includes("<b>Rock"));
});

test("TS-INV-05 no script", () => {
  assert.ok(!build(base).html.includes("<script"));
});

test("TS-INV-06 one h1 and title", () => {
  const b = build(base);
  assert.equal(b.html.split("<h1").length - 1, 1);
  assert.ok(b.html.includes("<h1>Ada</h1>"));
  assert.ok(b.html.includes("<title>Ada</title>"));
});

test("TS-INV-07 url-less project is plain text", () => {
  const b = build({ ...base, projects: [{ title: "NoLink", summary: "s" }] });
  assert.ok(b.html.includes("NoLink"));
  assert.ok(!b.html.includes('href="#"'));
  assert.ok(!b.html.includes('href=""'));
  assert.ok(!/<a[^>]*>\s*NoLink/.test(b.html));
});

test("TS-INV-08 no projects", () => {
  const b = build({ ...base, projects: [] });
  assert.ok(b.html.includes("Projects are coming soon."));
  assert.ok(!b.html.includes("<ul") && !b.html.includes("<li"));
});

test("TS-ERR-CONTENT_MISSING", () => {
  const b = build(undefined);
  assert.equal(b.r.status, 1);
  assert.ok(oneLine(b.r.stderr));
  assert.ok(b.r.stderr.includes("c.json"));
  assert.equal(existsSync(b.page), false);
});

test("TS-ERR-CONTENT_UNPARSEABLE", () => {
  const b = build(null, "{not json");
  assert.equal(b.r.status, 1);
  assert.ok(oneLine(b.r.stderr));
  assert.ok(/JSON/.test(b.r.stderr));
  assert.equal(existsSync(b.page), false);
});

test("TS-REQ-name-missing", () => {
  const noName = { ...base };
  delete noName.name;
  const b = build(noName);
  assert.equal(b.r.status, 1);
  assert.ok(oneLine(b.r.stderr));
  assert.ok(b.r.stderr.includes("name"));
  assert.equal(existsSync(b.page), false);
});

test("TS-NOGO-01 no markdown", () => {
  const b = build({ ...base, about: "**bold** _x_" });
  assert.ok(b.html.includes("**bold** _x_"));
  assert.ok(!b.html.includes("<strong>") && !b.html.includes("<em>"));
});

test("TS-NOGO-02 single page", () => {
  assert.deepEqual(readdirSync(build(base).out), ["index.html"]);
});

test("TS-NOGO-03 exits on its own", () => {
  const b = build(base);
  assert.equal(b.r.status, 0);
  assert.equal(b.r.signal, null);
});
