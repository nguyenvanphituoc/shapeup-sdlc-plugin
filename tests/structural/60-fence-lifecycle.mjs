// 60 — THE SUBSTRATE FENCE'S CLOSE-TIME LIFECYCLE (AGENTS.md's own claim, given a reader that can fail).
//
// THE DEFECT THIS CLOSES. AGENTS.md's Setup & Execution section makes three falsifiable claims about
// what un-fences a checkout after a run stops mid-dispatch, and nothing in the suite drove
// `hooks/sandbox-guard.mjs` through the sequence that would catch a wrong one. A rework pass on this
// prose (2026-09-20) found two of the three claims false on inspection alone — inverting one clause
// to its logical opposite in a scratch copy still left the whole suite green, which is exactly the
// "a check that cannot fail did not happen" failure the sweep's own acceptance contract warns about.
//
// WHAT THIS MODULE PROVES, by walking ONE fixture (one order, never deleted, never re-authored)
// through the three states AGENTS.md now describes, and reading the ledger's `rule` string after
// each — not just the host's allow/deny, which cannot tell "no order is live" apart from "no pointer
// is watching":
//
//   (i)   pointer present, order unanswered, target outside its substrate  -> DENY, rule outside-substrate
//   (ii)  pointer REMOVED, same order still unanswered on disk             -> ALLOW, rule no-round
//   (iii) pointer RESTORED, but the order has since been resolved by
//         `harness init run --force`                                      -> ALLOW, rule no-order
//
// (i)->(ii) proves the pointer is load-bearing on its own: nothing else about the fixture changes.
// (ii) is followed by putting the pointer straight back and re-deriving (i) again, so a reader
// cannot mistake "removed the pointer" for "the fixture stopped declaring a substrate" — the same
// fixture re-fences the instant the pointer returns. (iii) then proves the reverse asymmetry: with
// the pointer back on disk, the fence still lifts, because what changed was the answered-ness of the
// order, not whether anything is watching it. Neither direction is inferred from source; both are
// read off `hooks/sandbox-guard.mjs`'s stdout and its own decision ledger, via `SHAPEUP_DECISIONS_PATH`
// redirected to a temp path, as the rest of the suite does.

import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const SLUG = "fence-lifecycle-demo";

/** Write a JSON (or raw string) file, creating its directory. */
function w(root, rel, body) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof body === "string" ? body : JSON.stringify(body, null, 2));
  return p;
}

/**
 * Run the fence-lifecycle checks.
 * @param {object} ctx - Shared harness context (tests/lib/harness.mjs makeCtx).
 * @returns {Promise<void>} Resolves when the section body finishes.
 */
export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  // =============================================================================
  section("94. The substrate fence's close-time lifecycle — AGENTS.md's pointer/order claim, executed");
  // =============================================================================

  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
  if (!existsSync(KERNEL) || !existsSync(GUARD)) {
    fail("kernel/harness.mjs or hooks/sandbox-guard.mjs is missing — cannot exercise the fence lifecycle");
    return;
  }

  const ws = mkdtempSync(join(tmpdir(), "struct-fence-lifecycle-"));
  const ledger = join(ws, "decisions.jsonl");
  try {
    // One order, declared once and never re-authored: a narrow substrate, compiled well in the
    // past (a past compiled_at is what lets a synthetic --force result read as newer than it, per
    // sandbox-guard's own `answered()` — a future compiled_at is the fixture bug a prior pass on
    // this exact claim already hit and corrected).
    const orderPath = w(ws, `.shapeup/${SLUG}/orders/leg-a.json`, {
      schema_version: 1, order_id: `${SLUG}/leg-a`, worker: "task-executor", operation: "execute",
      compiled_at: "2026-08-17T09:00:00.000Z",
      substrate: { allowed: ["src/scopeA/**"] },
    });
    const pointerPath = join(ws, ".shapeup/active-order");
    const writePointer = () => w(ws, ".shapeup/active-order", { slug: SLUG, order_path: orderPath });
    writePointer();

    // A receipt, so `--force` in state (iii) is unwedging an already-open run rather than
    // refusing to open one — the field case AGENTS.md's own paragraph is about.
    w(ws, `.shapeup/${SLUG}/receipt.json`, {
      receipt_version: 1, type: "harness-run-receipt", slug: SLUG,
      run_id: `${SLUG}/deadbeef`, started: true, intake_sha256: "0".repeat(64),
    });

    // The probe target: outside the order's only declared substrate, and outside the run-trace
    // carve-out, so every state below is read off the SAME write.
    const probePath = join(ws, "docs/other.md");

    const ask = () => {
      const env = { ...process.env, SHAPEUP_DECISIONS_PATH: ledger };
      const payload = JSON.stringify({ tool_name: "Edit", cwd: ws, tool_input: { file_path: probePath } });
      const r = spawnSync("node", [GUARD], { encoding: "utf8", input: payload, env });
      const decision = (r.stdout || "").includes('"permissionDecision":"deny"') ? "deny" : "allow";
      let rule = null;
      try {
        const rows = readFileSync(ledger, "utf8").split("\n").filter((l) => l.trim()).map((l) => JSON.parse(l));
        rule = rows.length ? rows[rows.length - 1].rule : null;
      } catch { /* no ledger yet, or unreadable — rule stays null, which fails the assertion below */ }
      return { decision, rule, out: r.stdout || "" };
    };
    const assertState = (label, expectDecision, expectRule) => {
      const { decision, rule, out } = ask();
      if (decision === expectDecision && rule === expectRule) {
        ok(`${label}: ${expectDecision}, rule "${expectRule}"`);
      } else {
        fail(`${label}: expected ${expectDecision}/"${expectRule}", got ${decision}/"${rule}"\n${out}`);
      }
    };

    // (i) Pointer present, order unanswered, target outside its substrate — the fence AGENTS.md
    // says holds "exactly as if the run were live".
    assertState("(i) pointer present, order unanswered", "deny", "outside-substrate");

    // (ii) Remove ONLY the pointer. The order is untouched — still on disk, still unanswered, still
    // declaring the same substrate. If the pointer were merely advisory, this write would still be
    // denied; AGENTS.md's corrected claim is that it is not.
    unlinkSync(pointerPath);
    assertState("(ii) pointer removed, same unanswered order still on disk", "allow", "no-round");

    // Put the pointer straight back before touching anything else, so (iii) below isolates the
    // order's answered-ness rather than re-testing "the pointer is missing" a second time.
    writePointer();
    assertState("(i again) pointer restored — the fixture re-fences on the same order", "deny", "outside-substrate");

    // (iii) Resolve the order the documented way — `harness init run --force` — then put the
    // pointer back (force retires it as part of unwedging). The order file is never deleted or
    // rewritten; only its answered-ness changes.
    const forced = spawnSync("node", [
      KERNEL, "init", "run",
      "--slug", SLUG, "--intake-text", "second pass at the same feature",
      "--force", "--cwd", ws,
    ], { encoding: "utf8" });
    if (forced.status === 0) ok("`harness init run --force` exits 0 over this run root");
    else fail(`init run --force failed: exit ${forced.status}\n${forced.stderr || forced.stdout}`);

    if (existsSync(join(ws, `.shapeup/${SLUG}/results/leg-a.json`))) {
      ok("--force wrote a resolving record for the order under results/");
    } else {
      fail("--force did not write a results/ record — state (iii) below would prove nothing");
    }
    if (existsSync(orderPath)) {
      ok("--force preserved the order file itself (only its answered-ness changed)");
    } else {
      fail("--force deleted the order file — state (iii) is no longer the same fixture");
    }

    writePointer(); // restore, deliberately, to isolate the force-resolution from pointer absence
    assertState("(iii) pointer restored, order resolved by --force", "allow", "no-order");
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
