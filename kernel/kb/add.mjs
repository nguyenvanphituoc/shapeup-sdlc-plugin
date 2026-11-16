#!/usr/bin/env node
// harness kb add — file one rule a PERSON decided on, as a rule file.
//
//   harness.mjs kb add --reader <reader> --body <text> [--kind guide|check|ask] [--when <json>] [--check <name>] [--params <json>] [--alias <old id>] [--cwd <dir>]
//
// This is the `/retro` path: a PO is present and their assignment is the authority, so the rule starts `active`.
// It is refused while a run is open — inside a run a rule reaches the table only through the reflector, whose
// candidates the kernel checks against its own ledgers — and the table is linted before the file is kept.
// Exit 0 filed · 1 refused · 2 malformed input.
import { resolve, join, dirname, relative } from "node:path";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { runArgs } from "../core/argv.mjs";
import { idOf, slugOf, normalizeText } from "../core/rules.mjs";
import { READERS, KINDS, renderRule, lintRules } from "../shapeup/kb.mjs";
import { activeScope, knowledgeRulesDir } from "../shapeup/paths.mjs";

export const ARGV_SPEC = {
  usage: "harness.mjs kb add --reader <reader> --body <text> [--kind guide|check|ask] [--when <json>] [--check <name>] [--params <json>] [--alias <old id>]",
  _: { arity: 0, max: 0, name: "(no positional operands)" },
  reader: { type: "enum", values: Object.keys(READERS), required: true },
  body: { type: "str", required: true },
  kind: { type: "enum", values: KINDS },
  when: { type: "json" },
  check: { type: "str" },
  params: { type: "json" },
  alias: { type: "str" },
  cwd: { type: "path" },
};

export function cli(rawArgv) {
  const args = runArgs(ARGV_SPEC, rawArgv);
  const cwd = resolve(args.cwd || process.cwd());
  if (existsSync(activeScope(cwd))) { console.error("✋ kb add: a run is open. Inside a run a rule reaches the table through the reflector and `kb apply`; `kb add` is for a person's decision, outside one."); process.exit(1); }
  const body = normalizeText(args.body); const id = idOf(READERS[args.reader].code, body);
  const file = join(knowledgeRulesDir(cwd), args.reader, `${id}.${slugOf(body)}.md`);
  if (existsSync(file)) { console.log(JSON.stringify({ ok: true, id, file: relative(cwd, file), already_present: true })); process.exit(0); }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, renderRule({ id, reader: args.reader, kind: args.kind ?? "guide", when: args.when ?? {}, status: "active", check: args.check, params: args.params, aliases: args.alias ? [args.alias] : [] }, body));
  const bad = lintRules(cwd);
  if (bad.length) { rmSync(file, { force: true }); for (const p of bad) console.error(`✋ kb add: ${p.file} [${p.rule}] ${p.message}`); process.exit(1); }
  console.log(JSON.stringify({ ok: true, id, file: relative(cwd, file) }));
  process.exit(0);
}
