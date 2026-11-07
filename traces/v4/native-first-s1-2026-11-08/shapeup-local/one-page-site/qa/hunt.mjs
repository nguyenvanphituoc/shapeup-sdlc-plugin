import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
const root = "/Users/liberty/Documents/proj-shapeup-sdlc-plugin-consumer";
const qa = join(root, ".shapeup/one-page-site/qa");
const cases = {
  default: null,
  nullproj: '{"name":"x","projects":[null]}',
  notitle: '{"name":"x","projects":[{"summary":"s"}]}',
  jsurl: '{"name":"x","projects":[{"title":"j","url":"javascript:alert(1)"}]}',
  quoteemail: '{"name":"x","contact":{"email":"a\\"b@x"}}',
  objname: '{"name":{"a":1}}',
  numname: '{"name":0}',
  falsename: '{"name":false}',
  projstr: '{"name":"x","projects":"oops"}',
  arr: '[]',
  nullc: 'null',
  contactstr: '{"name":"x","contact":"a@b.c"}',
  projnum: '{"name":"x","projects":[5]}',
  longname: JSON.stringify({ name: "A".repeat(20000) + "\u0000🏳️‍🌈‮" }),
  bom: "﻿" + '{"name":"x"}',
  nameonly: '{"name":"x"}',
  ws: '{"name":"   "}',
  emptyurl: '{"name":"x","projects":[{"title":"t","url":""}]}',
  directory: "DIR",
};
for (const [k, v] of Object.entries(cases)) {
  const dir = join(qa, "c", k);
  mkdirSync(dir, { recursive: true });
  const env = { ...process.env, OUT_DIR: join(dir, "out") };
  if (v !== null) {
    if (v === "DIR") { env.CONTENT_FILE = dir; }
    else { writeFileSync(join(dir, "content.json"), v); env.CONTENT_FILE = join(dir, "content.json"); }
  } else { env.CONTENT_FILE = join(root, "content.json"); }
  const r = spawnSync("node", [join(root, "build.mjs")], { env, encoding: "utf8" });
  const f = join(dir, "out/index.html");
  const html = existsSync(f) ? readFileSync(f, "utf8") : null;
  console.log("== " + k, "exit", r.status, "stderr:", JSON.stringify((r.stderr || "").slice(0, 300)));
  if (html) {
    const body = html.split("<body>")[1] || "";
    console.log(k, "html:", JSON.stringify(body.slice(0, 600)), "len", html.length);
  }
}
