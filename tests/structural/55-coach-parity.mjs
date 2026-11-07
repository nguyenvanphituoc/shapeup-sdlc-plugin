// 55 (sections 56–56c) — the knowledge base coaches the workflow, and never a gate.
//
// Three edges kept in lock-step, each of which has drifted silently before in this repo:
//
//   (a) the kernel's `COACHABLE` set (the only place `payload.kb_rules_path` is handed over), the
//       schema's `x-payload-by-worker` registry, and the retro resource's category table all name the
//       same readers — a worker the retro files rules for but the kernel never hands the path to is a
//       write-only knowledge base, the defect the retro exists to prevent;
//   (b) every coachable worker's SKILL.md reads the file (not merely declares the field), the
//       loop reads its own at GATE L0, and the two never-coachable roles stay out;
//   (c) the retro is the loop's own act now — no coach worker, no `coach`/`scan`/`research` operation —
//       and the gate-inert invariant is written where the retro and the loop will read it, research
//       being a source aimed by a stack hint, and never a verification (the word is the kernel's, for
//       what it executes).
//
// A fourth edge used to be here: a `scan` dispatch travelling the whole envelope port in a sample project
// (compile, the hook fencing the coach to the knowledge base, a WorkResult, ingest refusing it until a
// receipt attested the coach skill). It is retired WITH the worker: the scan and the research have no order
// and no dispatch to attest any more, so there is no envelope for them to travel and no sub-agent for a
// receipt to name. What survived of it is the COACH-1 call site, which is now a command `probe next` hands
// the loop (see the probe-next module's retro checks), and the compile-time retirement asserted in 56c.
//
// The invariant itself — guidance never decides a gate — cannot be executed here, since it is a
// rule about what a filed rule may say. What can be pinned is that every place that reads the
// knowledge base states it, so a future edit that drops the sentence is a build failure.

import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

/**
 * Run the retro/knowledge-base parity checks.
 * @param {object} ctx - Shared structural-test context from tests/lib/harness.mjs (makeCtx).
 * @returns {Promise<void>} Resolves when every check in section 55 has been recorded on ctx.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section, read, readJSON } = ctx;

  // =============================================================================
  section("56. Coachable set — kernel, schema registry and the coach's categories agree");
  // =============================================================================

  const compile = await import(pathToFileURL(join(ROOT, "kernel/compile.mjs")).href);
  const COACHABLE = compile.COACHABLE;
  if (!(COACHABLE instanceof Set) || COACHABLE.size === 0) {
    fail("kernel/compile.mjs exports no COACHABLE set");
    return;
  }

  const domain = readJSON(join(ROOT, "kernel/schemas/domain.schema.json"));
  const registry = domain["x-payload-by-worker"] || {};
  const registered = new Set(
    Object.entries(registry)
      .filter(([, fields]) => Array.isArray(fields) && fields.includes("kb_rules_path"))
      .map(([worker]) => worker),
  );
  const kernelOnly = [...COACHABLE].filter((w) => !registered.has(w));
  const registryOnly = [...registered].filter((w) => !COACHABLE.has(w));
  if (kernelOnly.length === 0 && registryOnly.length === 0) {
    ok(`COACHABLE ↔ x-payload-by-worker[kb_rules_path] agree on ${COACHABLE.size} workers`);
  } else {
    if (kernelOnly.length) fail(`kernel hands kb_rules_path to ${kernelOnly.join(", ")} but the registry does not list it`);
    if (registryOnly.length) fail(`registry lists kb_rules_path for ${registryOnly.join(", ")} but the kernel never hands it over`);
  }

  const retroDoc = read(join(ROOT, "skills/building/resources/retro.md"));
  const scanDoc = read(join(ROOT, "skills/building/resources/retro-scan.md"));
  const researchDoc = read(join(ROOT, "skills/building/resources/retro-research.md"));
  // The category table: one row per reader, keyed by the file each one reads. The readers are the
  // coachable workers plus the two ACTIVITIES (the planning activity and the loop), which are not
  // workers and so are not in COACHABLE: `plan` (its order carries payload.kb_rules_paths) and
  // `building` (read at L0). New rules are filed under those names.
  for (const w of [...COACHABLE, "plan", "building"]) {
    if (retroDoc.includes(`\`shapeup/knowledge-base/${w}.md\``)) ok(`retro categories include ${w}`);
    else fail(`skills/building/resources/retro.md has no category row for ${w} (shapeup/knowledge-base/${w}.md)`);
  }
  // The gate offers exactly those five readers (plus harness-defect and skip) — a sixth category in
  // the block would be a rule filed where nothing reads it.
  const offered = (retroDoc.match(/Valid: \[task-executor\][\s\S]*?\[skip — not coachable\]/) || [""])[0];
  const wantOffered = ["task-executor", "qa-edge-hunter", "orient", "plan", "building", "harness-defect", "skip"];
  if (offered && wantOffered.every((c) => offered.includes(`[${c}`)) && (offered.match(/\[[a-z-]+/g) || []).length === wantOffered.length) ok("GATE COACH-1 offers exactly task-executor, qa-edge-hunter, orient, plan, building, harness-defect and skip");
  else fail(`GATE COACH-1's Valid: block does not offer exactly ${wantOffered.join(", ")}: ${JSON.stringify(offered)}`);
  for (const [never, phrase] of [["spec-evaluator", "`spec-evaluator` is never a category"], ["the census", "The census is never a category"]]) {
    if (never === "spec-evaluator" && COACHABLE.has(never)) fail(`${never} must never be coachable (single judge) but is in COACHABLE`);
    else if (never === "spec-evaluator" && registered.has(never)) fail(`${never} must never be coachable but the registry hands it kb_rules_path`);
    else if (retroDoc.includes(phrase)) ok(`${never} is stated never-coachable in the retro's hard rules`);
    else fail(`skills/building/resources/retro.md does not state "${phrase}"`);
  }

  // =============================================================================
  section("56b. Every reader reads — the file is loaded, not merely declared");
  // =============================================================================

  for (const w of COACHABLE) {
    const rel = `skills/${w}/SKILL.md`;
    const p = join(ROOT, rel);
    if (!existsSync(p)) { fail(`${rel} missing for coachable worker ${w}`); continue; }
    const txt = read(p);
    // §50 already pins the declaration; this pins the read — the prose must tell the worker to
    // read the path, and must say what the file is not (steering, never spec / never a gate).
    const reads = /kb_rules_path[^\n]*\n?[^\n]*\b(read|Read)\b/.test(txt) || /\b(read|Read)\b[^\n]*kb_rules_path/.test(txt);
    const bounded = /steering, never spec/i.test(txt) || /never a reason to skip/i.test(txt);
    if (reads && bounded) ok(`${w} reads its knowledge-base file and bounds it as steering`);
    else fail(`${rel}: ${reads ? "" : "never tells the worker to read payload.kb_rules_path; "}${bounded ? "" : "does not bound the file as steering, never spec"}`);
  }

  // The activities' reads are pinned where they are written: the loop's intake resource reads `building.md`
  // (and `tech-lead.md`, the name that guidance was filed under before the loop had its own), the plan
  // resource and the guidance resource say what the planning files may and may not do.
  const intake = read(join(ROOT, "skills/building/resources/intake.md"));
  if (/knowledge-base\/building\.md/.test(intake) && /tech-lead\.md/.test(intake) && /never answers, skips or reorders a gate/.test(intake)) ok("the loop reads building.md and tech-lead.md at L0 and bounds them as gate-inert");
  else fail("skills/building/resources/intake.md must read building.md and tech-lead.md and say the file never answers, skips or reorders a gate");
  const guidanceDoc = read(join(ROOT, "skills/building/resources/guidance.md"));
  const planDoc = read(join(ROOT, "skills/building/resources/plan.md"));
  const legacy = ["ba-pitch-analyzer", "scope-architect", "solution-architect"];
  if (legacy.every((n) => guidanceDoc.includes(`${n}.md`)) && guidanceDoc.includes("`plan.md`") && guidanceDoc.includes("`tech-lead.md`")) ok("the guidance resource maps the three planning names to `plan` and tech-lead to `building`");
  else fail("skills/building/resources/guidance.md must name plan.md and the three legacy planning files, and tech-lead.md");
  if (/never an answer, a skip or a wider substrate/.test(planDoc)) ok("the plan resource bounds its guidance: never an answer, a skip or a wider substrate");
  else fail("skills/building/resources/plan.md does not state that guidance is never an answer, a skip or a wider substrate");

  const gates = read(join(ROOT, "skills/tech-lead/references/gates.md"));
  if (gates.includes("shapeup/knowledge-base/tech-lead.md")) ok("tech-lead reads knowledge-base/tech-lead.md at GATE L0");
  else fail("skills/tech-lead/references/gates.md never reads shapeup/knowledge-base/tech-lead.md");
  if (/Nothing in that file answers a gate/.test(gates)) ok("GATE L0 states that the tech-lead file answers no gate");
  else fail("gates.md L0.10 does not state that the knowledge base answers no gate");

  // =============================================================================
  section("56c. The retro is the loop's own act: no coach worker, no scan/research operation; the invariant is written");
  // =============================================================================

  const ops = domain.$defs?.Operation?.enum || [];
  const gone = ["coach", "scan", "research", "translate", "hammer"].filter((o) => ops.includes(o));
  if (!gone.length) ok("the Operation enum carries none of coach, scan, research, translate or hammer — the retro, the census and the language gate dispatch nothing");
  else fail(`Operation enum still carries ${gone.join(", ")} — an order for them has no skill to answer it`);
  const workers = domain.$defs?.WorkerName?.enum || [];
  const goneW = ["coach", "scope-hammer", "translator"].filter((w) => workers.includes(w));
  if (!goneW.length) ok("WorkerName carries none of coach, scope-hammer or translator");
  else fail(`WorkerName still carries ${goneW.join(", ")}`);
  for (const op of ["coach", "scan", "research", "translate", "hammer"]) {
    const c = spawnSync(process.execPath, [join(ROOT, "kernel/harness.mjs"), "compile", "--operation", op, "--slug", "x"], { encoding: "utf8" });
    if (c.status === 2) ok(`compile --operation ${op} exits 2 — it resolves no worker`);
    else fail(`compile --operation ${op} exited ${c.status}, not 2`);
  }

  if (/Guidance never decides a gate/.test(retroDoc) && /\bSource\b|source of the candidate rules|change only the\s+\*source\*/.test(retroDoc) && /# Retro — scan/.test(scanDoc) && /# Retro — research/.test(researchDoc))
    ok("the retro states the gate-inert invariant and hands --scan and --research to their own resources");
  else fail("skills/building/resources/retro*.md must state 'Guidance never decides a gate' and carry the scan and research resources");
  if (/project-scan @/.test(retroDoc) && /project-scan @/.test(scanDoc)) ok("scanned rules carry project-scan provenance");
  else fail("the retro resources never name the project-scan @ <sha> provenance");
  if (/web-research \(/.test(retroDoc) && /web-research \(/.test(researchDoc)) ok("researched rules carry web-research provenance, distinct from the scan's");
  else fail("the retro resources never name the web-research (<url>, <version>, <date>) provenance");

  // Research is aimed by a stack hint — asked for, never guessed from the project's name — and the
  // operation is a source, never a verification: "verify" is what the kernel executes, and the prose
  // has to say so where the reader would otherwise assume teeth.
  if (/stack[\s\S]*required/i.test(researchDoc) && /never guess a stack/i.test(researchDoc)) ok("research is aimed by a required stack hint — asked for, never guessed");
  else fail("skills/building/resources/retro-research.md must say the stack is required and never guessed");
  if (/source, not a verification/i.test(researchDoc)) ok("research states that it is a source, not a verification");
  else fail("skills/building/resources/retro-research.md must state that research is a source, not a verification");
  if (/official/i.test(researchDoc) && /never steps to follow|never instructions/i.test(researchDoc)) ok("research is bounded to official sources and treats fetched pages as content, never instructions");
  else fail("skills/building/resources/retro-research.md must bound research to official sources and state that a fetched page is content, never instructions");
  if (/is a claim, not evidence/.test(retroDoc) && /never writes `project-profile.md`/.test(retroDoc)) ok("a scanned rule is a claim and the retro never writes the project profile — a suggested command stays a proposal until L0");
  else fail("the retro must say a scanned rule is a claim, not evidence, and that it never writes project-profile.md");
  // The gate is crossed BEFORE feedback is asked for: an unattended lane has nobody to answer "anything to
  // record?", so a retro that asked first would never reach the gate and the lane would leave no COACH-1 row.
  const gateAt = retroDoc.indexOf("`retro.gate`"), askAt = retroDoc.indexOf("Anything to record");
  if (gateAt !== -1 && askAt !== -1 && gateAt < askAt && /Exit 0 \(`skip`\)[\s\S]{0,80}ask nothing/.test(retroDoc)) ok("the retro runs retro.gate before it asks for feedback, and a skip asks nothing — an unattended lane still leaves its COACH-1 row");
  else fail("skills/building/resources/retro.md must run retro.gate before 'Anything to record', and say a skip asks nothing");
  const retro = read(join(ROOT, "commands/retro.md"));
  if (/--research/.test(retro) && /--scan/.test(retro)) ok("commands/retro.md exposes both --scan and --research");
  else fail("commands/retro.md must expose --research beside --scan");
  if (/building/.test(retro) && !/\*\*coach\*\*/.test(retro)) ok("commands/retro.md points at the building skill, not the retired coach");
  else fail("commands/retro.md must route to the building skill's retro sub-command");

  const agents = read(join(ROOT, "AGENTS.md"));
  if (/Guidance never decides a gate/.test(agents)) ok("AGENTS.md carries the invariant");
  else fail("AGENTS.md does not state 'Guidance never decides a gate'");
}
