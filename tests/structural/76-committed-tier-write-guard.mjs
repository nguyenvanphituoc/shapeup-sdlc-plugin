// 76 — HD-036 and its layer: the committed tier gets a guard at the WRITE boundary.
// Sections: 128, 129.
//
// THE DEFECT, measured four times over, by four different producers. Every one of them wrote a file
// into the committed tier that this harness's own spec-lint then reds: `ba-pitch-analyzer` →
// `requirements.md` (HD-027), `reduce ship` → `REPORT.md` (HD-030), `tech-lead` →
// `project-profile.md` (HD-036), `coverage` → no-go clauses (HD-037). The rule was never in doubt
// and the lint was never wrong — `lintCommittedTier` has enforced it whole-tree for several
// releases. What was missing is WHEN it speaks: at L1b, minutes and a full phase after the sentence
// was written, to a worker that no longer holds the context needed to rephrase it.
//
// WHY TEACHING DOES NOT CLOSE IT. HD-036 recurred INSIDE ONE SESSION, an hour apart, on a different
// line of the same file, after that same orchestrator had fixed the first occurrence and watched its
// own lint go green. A worker does not carry a lesson across a dispatch, and the run pays ~12 minutes
// and a whole L0 turn for each recurrence. Two fresh runs reproduced it 2/2.
//
// SO THE REMEDY IS A PRECONDITION, NOT A RULE. `hooks/tier-guard.mjs` refuses the write itself and
// says why at the moment of writing, which is the one moment the writer can still rephrase. The
// shape is `sandbox-guard.mjs`'s, deliberately: fail open on everything it cannot positively prove,
// deny only on the state the lint would red.
//
// WHAT THIS MODULE PINS, and why each half is here:
//   128 — the guard is REGISTERED and EXECUTED. A hook on disk that hooks.json never wires enforces
//         nothing, so registration is asserted separately from behaviour, and every behavioural
//         check spawns the real script rather than importing its predicate (a fixture that calls
//         your function directly cannot see whether anything calls it).
//   129 — the guard and the lint cannot DRIFT. Both are executed over one corpus of bodies and
//         required to agree in both directions. A guard that denies less than the lint reds lets the
//         defect back through at L1b; a guard that denies more blocks writes the harness accepts,
//         which is how a guard gets switched off.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section, readJSON } = ctx;

  const GUARD = join(ROOT, "hooks/tier-guard.mjs");

  // ===============================================================================================
  section("128. Committed-tier write guard — registered, and denying at the write boundary");
  // ===============================================================================================
  if (!existsSync(GUARD)) {
    fail("hooks/tier-guard.mjs is missing — the committed tier has no write-time guard (HD-036 recurs 2/2 on fresh runs)");
    return;
  }
  ok("hooks/tier-guard.mjs exists");

  // REGISTRATION IS ITS OWN CHECK. The hook could be perfect and still never fire; 03-hooks.mjs
  // asserts the inverse (no orphan scripts), and this asserts the matcher covers every write tool,
  // because a guard wired to `Write` alone is bypassed by the Edit call that writes the same line.
  {
    const manifest = readJSON(join(ROOT, "hooks/hooks.json"));
    const entries = (manifest.hooks?.PreToolUse || []).filter((g) =>
      (g.hooks || []).some((h) => (h.command || "").includes("hooks/tier-guard.mjs")));
    if (!entries.length) {
      fail("hooks.json does not register hooks/tier-guard.mjs on PreToolUse — the guard exists but never fires");
    } else {
      ok("hooks.json registers tier-guard.mjs on PreToolUse");
      const matcher = entries[0].matcher || "";
      const covered = ["Edit", "Write", "MultiEdit"].filter((t) => matcher.split("|").includes(t));
      if (covered.length === 3) ok("tier-guard's matcher covers Edit|Write|MultiEdit (no write tool routes around it)");
      else fail(`tier-guard's matcher "${matcher}" misses ${["Edit", "Write", "MultiEdit"].filter((t) => !covered.includes(t)).join(", ")} — that tool writes the same line unguarded`);
    }
  }

  /** A throwaway checkout with a committed tier for slug `f`. */
  const makeCheckout = () => {
    const dir = mkdtempSync(join(tmpdir(), "tier-guard-"));
    mkdirSync(join(dir, "shapeup", "f", "spec"), { recursive: true });
    mkdirSync(join(dir, "shapeup", "knowledge-base"), { recursive: true });
    mkdirSync(join(dir, ".git"), { recursive: true });   // a project root the hook can find
    return dir;
  };

  /**
   * Run the real hook over one write. `tool` picks which input shape carries the content, because
   * the three write tools spell it differently and a guard that only reads `content` is blind to
   * the Edit that writes the same string.
   */
  const ask = (cwd, filePath, content, tool = "Write") => {
    const tool_input =
      tool === "Write" ? { file_path: filePath, content }
        : tool === "Edit" ? { file_path: filePath, old_string: "PLACEHOLDER", new_string: content }
          : { file_path: filePath, edits: [{ old_string: "A", new_string: "clean line" }, { old_string: "B", new_string: content }] };
    const r = spawnSync("node", [GUARD], {
      encoding: "utf8",
      input: JSON.stringify({ tool_name: tool, cwd, tool_input }),
      env: { ...process.env, SHAPEUP_DECISIONS_PATH: join(cwd, "decisions.jsonl") },
    });
    return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), out: r.stdout || "", code: r.status };
  };

  const ws = makeCheckout();
  try {
    const req = join(ws, "shapeup/f/requirements.md");

    // 1. The measured shape (HD-027): a bare .shapeup/ path in provenance prose.
    const leak = ask(ws, req, "Atomic requirement clauses extracted from `.shapeup/f/intake.md`.\n");
    if (leak.denied) ok("tier-guard DENIES a committed write citing a .shapeup/ path");
    else fail(`tier-guard permitted the exact write HD-027 measured — the guard is not enforcing\n${leak.out}`);

    // 2. The denial has to be usable AT THE WRITE, which is the whole reason this is a hook and not
    //    a lint. It names the file, the offending token, why it is wrong, and what to write instead.
    {
      const m = leak.out;
      const named = m.includes("shapeup/f/requirements.md") && m.includes(".shapeup/f/intake.md");
      const why = /dangle|gitignored/i.test(m);
      const remedy = /name the committed artifact|describe the tier/i.test(m);
      if (named && why && remedy) ok("the denial names the file, the token, why it is wrong, and the remedy");
      else fail(`the denial is not actionable at the write (named=${named} why=${why} remedy=${remedy})\n${m}`);
    }

    // 3. The other half of the rule, and the one that bit hardest in synthesis.md: a board id.
    const board = ask(ws, join(ws, "shapeup/f/spec/synthesis.md"), "| TASK-004 | Wire the seam | done |\n");
    if (board.denied && /renumber/i.test(board.out)) ok("tier-guard DENIES a committed write carrying a board id, and says why (ids renumber per machine)");
    else fail(`tier-guard permitted a TASK-NNN id in a committed file, or gave no reason\n${board.out}`);

    // 4. Every write tool, not just Write. The Edit path is the one HD-036 recurred through: the
    //    file already existed and the second violation was added a line at a time.
    const viaEdit = ask(ws, req, "See `.shapeup/f/orders/r1-a1.json` for the dispatch.\n", "Edit");
    if (viaEdit.denied) ok("tier-guard DENIES the same leak written through Edit (new_string)");
    else fail(`tier-guard reads Write but not Edit — the recurrence path is unguarded\n${viaEdit.out}`);

    const viaMulti = ask(ws, req, "Board id TASK-012 owns this clause.\n", "MultiEdit");
    if (viaMulti.denied) ok("tier-guard DENIES a leak in ONE edit of a MultiEdit batch");
    else fail(`tier-guard misses a leaking edit inside a MultiEdit batch\n${viaMulti.out}`);

    // 5. FAIL OPEN, positively. Each of these is a state the guard cannot prove bad, and a guard
    //    that blocks them is a guard the next operator disables.
    const clean = ask(ws, req, "Derived from the pitch staged for this run by harness init run.\n");
    if (!clean.denied) ok("tier-guard ALLOWS committed prose that names no local path or board id");
    else fail(`tier-guard denied clean committed prose — false positive\n${clean.out}`);

    const kb = ask(ws, join(ws, "shapeup/knowledge-base/harness-defects.md"),
      "HD-036 — tech-lead writes `.shapeup/<slug>/` paths into project-profile.md (TASK-004 seen too).\n");
    if (!kb.denied) ok("tier-guard ALLOWS shapeup/knowledge-base/ — instructions to a worker, outside the lint's own walk");
    else fail(`tier-guard denied a knowledge-base write; the lint does not walk that tree, so the guard must not either\n${kb.out}`);

    const product = ask(ws, join(ws, "src/app.ts"), "const trace = '.shapeup/f/run-state.json';\n");
    if (!product.denied) ok("tier-guard ALLOWS a .shapeup/ path in product code (outside the committed tier)");
    else fail(`tier-guard denied a write outside the committed tier — it is fencing the wrong surface\n${product.out}`);

    const binary = ask(ws, join(ws, "shapeup/f/spec/diagram.svg"), "<!-- .shapeup/f/intake.md -->\n");
    if (!binary.denied) ok("tier-guard ALLOWS a file form the lint does not scan (.svg)");
    else fail(`tier-guard denied an unscanned file form — it reds what the lint would pass\n${binary.out}`);

    const noContent = ask(ws, req, undefined);
    if (!noContent.denied) ok("tier-guard ALLOWS a call whose input carries no content to inspect (nothing proven)");
    else fail(`tier-guard denied a write it could not read — that is fail-closed on an unknown\n${noContent.out}`);

    // 6. Unparseable input is still exit 0. 11-is-main.mjs owns this for every hook; repeated here
    //    because a guard that crashes on a malformed payload takes the tool call down with it.
    {
      const r = spawnSync("node", [GUARD], { encoding: "utf8", input: "NOT JSON AT ALL {{{",
        env: { ...process.env, SHAPEUP_DECISIONS_PATH: join(ws, "decisions.jsonl") } });
      if (r.status === 0 && !(r.stdout || "").includes('"deny"')) ok("tier-guard fails open (exit 0, no denial) on an unparseable payload");
      else fail(`tier-guard did not fail open on a malformed payload (exit=${r.status})\n${r.stdout}`);
    }

    // 7. The decision reaches the receipt channel — a denial nobody can count is a denial that
    //    cannot be told from an inert hook (hooks/lib/decision.mjs's whole argument).
    {
      const ledger = join(ws, "decisions.jsonl");
      const rows = existsSync(ledger) ? readFileSync(ledger, "utf8").trim().split("\n").map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
      const mine = rows.filter((r) => r.hook === "tier-guard");
      const denies = mine.filter((r) => r.verdict === "deny");
      if (mine.length && denies.length && denies.every((r) => r.rule)) ok(`tier-guard files every decision in the ledger (${mine.length} rows, ${denies.length} deny, each naming a rule)`);
      else fail(`tier-guard's decisions are not on the record (rows=${mine.length} deny=${denies.length}) — a denial that cannot be counted is indistinguishable from an inert hook`);
      const allows = mine.filter((r) => r.verdict === "allow");
      if (allows.length && allows.every((r) => r.reason)) ok("tier-guard's fail-open decisions carry a reason (allow is evidence, not silence)");
      else fail("tier-guard's allow rows carry no reason — the four fail-open states are indistinguishable again");
    }
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // ===============================================================================================
  section("129. Guard and lint agree — the same body that reds at L1b is refused at the write");
  // ===============================================================================================
  // DERIVED BY EXECUTING BOTH, over one corpus, in both directions. The two enforcement points have
  // separate code paths (a file walk vs. a tool payload) and no shared test until this one; the only
  // way the write-time guard stays worth having is if it is neither narrower than the lint (the
  // defect survives to L1b) nor wider (the guard blocks writes the harness accepts).
  {
    const { lintCommittedTier } = await import(join(ROOT, "kernel/verify/spec.mjs"));
    const CORPUS = [
      ["bare local path in prose", "Extracted from `.shapeup/f/intake.md`.\n"],
      ["local path inside a wikilink", "See [[.shapeup/f/discovery/ledger.md]].\n"],
      ["board id in a table cell", "| TASK-004 | Cart seam | ✅ done |\n"],
      ["board id in a sentence", "TASK-012 covers the auth boundary.\n"],
      ["clean provenance prose", "Derived from the pitch staged for this run.\n"],
      ["the tier named without a path", "The run trace is gitignored and wiped between runs.\n"],
      ["a committed path", "See shapeup/f/spec/usecases/UC-01.md.\n"],
      ["a lookalike that is not a board id", "TASKS-pending and TASK_ID are not board ids.\n"],
    ];
    let agreed = 0;
    const disagreements = [];
    for (const [label, body] of CORPUS) {
      const d = mkdtempSync(join(tmpdir(), "tier-agree-"));
      try {
        mkdirSync(join(d, "shapeup", "f"), { recursive: true });
        mkdirSync(join(d, ".git"), { recursive: true });
        const target = join(d, "shapeup", "f", "requirements.md");
        writeFileSync(target, body);
        const reds = lintCommittedTier({ cwd: d, slug: "f" }).filter((x) => x.rule === "TIER-DIRECTION").length > 0;
        const r = spawnSync("node", [GUARD], {
          encoding: "utf8",
          input: JSON.stringify({ tool_name: "Write", cwd: d, tool_input: { file_path: target, content: body } }),
          env: { ...process.env, SHAPEUP_DECISIONS_PATH: join(d, "decisions.jsonl") },
        });
        const denied = (r.stdout || "").includes('"permissionDecision":"deny"');
        if (reds === denied) agreed++;
        else disagreements.push(`${label}: lint ${reds ? "reds" : "passes"} but guard ${denied ? "denies" : "allows"}`);
      } finally {
        rmSync(d, { recursive: true, force: true });
      }
    }
    if (!disagreements.length) ok(`guard and lint agree on all ${CORPUS.length} corpus bodies (both directions)`);
    else fail(`guard and lint disagree — ${disagreements.join("; ")}`);
    if (agreed === CORPUS.length) ok("no corpus body is judged differently at the write than at L1b");
  }
}
