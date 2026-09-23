// 78 — HD-014's code half: a terminal close releases the fence it left standing.
// Section: 132.
//
// THE DEFECT, measured on 3.7.1-rc.4 with a fixture this module rebuilds. The substrate fence is
// enforced while a run has an order that is compiled and unanswered. A run that ends any way other
// than shipping — escalated by a breaker, aborted, killed outright — leaves such an order behind by
// construction, and `closeRun` retired nothing: it stamped `status`, `closed_at`, `closed_status`
// and `close_cause`, exported the run's fact tables, and left both pointers on disk. So after a
// close that exited 0 and recorded everything correctly, an ordinary write ANYWHERE in the
// consumer's project was still denied — with no dispatch in flight and no run to speak of.
//
// The operator's obvious remedy did nothing, which is the part that cost real time: `--force` is
// documented as "abandon the open run and start over", never as "release a stuck fence", so the one
// command that lifts it is the one nobody reaches for. The fence stops the assistant's own edit
// path — `Bash`, `git` and any other editor still write — so the accurate claim is not "a project
// that cannot be edited" but "the assistant cannot edit this project and the documented remedy does
// not say so". That is still the sharpest operational finding in the register.
//
// WHY IT WAS SEQUENCED BEHIND OTHER WORK, and why it is unblocked now. The entry's own falsification
// pass found that nothing stamped `closed_at` at all — so there was no close fact for anything to
// key off, which ruled out the obvious fix. The close-out work landed that stamp (`writeCloseLines`
// writes all four lines in one pass), and this module's first case measures the consequence: the
// close records everything it should and the fence stays up regardless.
//
// UN-FENCING IS NOT RESOLVING, and this module pins the distinction rather than letting the fix
// blur it. Retiring the pointer says "no run is in flight"; it does not say the abandoned order was
// answered. Its result is still missing, the attempt census still sees nothing, and `init run
// --force` is still what writes a synthetic result for it. Those are two different facts about the
// same order, and a close that quietly asserted the second would spend an attempt budget on work
// nobody did.
//
// ONE CLAIM THIS MODULE DOES NOT MAKE, because it was checked and found false. The fix was written
// believing the export had to run before the retirement — that `exportOnClose` resolved its run by
// reading the pointer. It does not: it is handed the slug and keys by the receipt's `run_id`.
// Swapping the two was mutated in and every check stayed green, which is how the belief was caught.
// The export assertion below therefore pins what it can actually see — that a close still exports
// at all — and the ordering is left as a defensive default rather than dressed up as a guard.

import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");

  // The statuses come from the kernel's own list, not from a hand-typed pair — the same derivation
  // rule the close-out itself follows, so a status added later is covered here without an edit.
  const { TERMINAL_STATUSES } = await import(join(ROOT, "kernel/probe/resume.mjs"));

  section("132. A terminal close retires the run's pointers — the fence it left standing comes down");

  if (!TERMINAL_STATUSES?.length) {
    fail("kernel/probe/resume.mjs exports no TERMINAL_STATUSES — cannot derive the statuses to drive");
    return;
  }
  ok(`driving every terminal status the kernel declares (${TERMINAL_STATUSES.join(", ")})`);

  for (const status of TERMINAL_STATUSES) {
    const ws = mkdtempSync(join(tmpdir(), `struct-close-fence-${status}-`));
    try {
      const git = (args) => spawnSync("git", args, { cwd: ws, encoding: "utf8" });
      git(["init", "-q", "-b", "main"]);
      git(["config", "user.email", "probe@example.invalid"]);
      git(["config", "user.name", "probe"]);
      git(["commit", "-q", "--allow-empty", "-m", "base"]);

      const kernel = (...args) => spawnSync("node", [KERNEL, ...args, "--cwd", ws], { cwd: ws, encoding: "utf8" });

      // A REAL run and a REAL order — the pipeline's own artifacts, never a hand-built ledger. A
      // fixture that writes the run state itself can be wrong in ways the pipeline never is, which
      // is how an earlier defect in this repo hid behind three green fixtures.
      const opened = kernel("init", "run", "--slug", "fencetest", "--intake-text", "Add a cart badge");
      const compiled = kernel("compile", "--slug", "fencetest", "--operation", "orient");
      if (opened.status !== 0 || compiled.status !== 0) {
        fail(`[${status}] could not build the fixture through the CLI (init=${opened.status} compile=${compiled.status}): ${(opened.stderr || compiled.stderr || "").slice(0, 200)}`);
        continue;
      }

      const fenced = (label) => {
        const payload = JSON.stringify({
          tool_name: "Write", cwd: ws,
          tool_input: { file_path: join(ws, "src/unrelated.ts"), content: "x" },
        });
        const r = spawnSync("node", [GUARD], {
          encoding: "utf8", input: payload,
          env: { ...process.env, SHAPEUP_DECISIONS_PATH: join(ws, "dec.jsonl") },
        });
        return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), out: r.stdout || "", label };
      };

      // Guard against a vacuous pass: if the fence were not up to begin with, everything below
      // would "prove" a fix that did nothing.
      const before = fenced("before");
      if (before.denied) ok(`[${status}] the fence is up while the run is live (an unanswered order, outside its substrate)`);
      else { fail(`[${status}] the fence was already down before the close — this fixture cannot measure the defect`); continue; }

      const closed = kernel("probe", "resume", "--slug", "fencetest", "--close", status, "--cause", "breaker: no_progress_k");
      if (closed.status !== 0) { fail(`[${status}] the close itself failed (exit ${closed.status}): ${(closed.stderr || "").slice(0, 200)}`); continue; }

      // THE ASSERTION THIS MODULE EXISTS FOR.
      const after = fenced("after");
      if (!after.denied) ok(`[${status}] the fence is DOWN after the close — an ordinary write is permitted again`);
      else fail(`[${status}] the fence still denies an ordinary write after a close that exited 0 — the run is over and the project is still fenced\n${after.out}`);

      const pointers = readdirSync(join(ws, ".shapeup")).filter((f) => f.startsWith("active"));
      if (pointers.length === 0) ok(`[${status}] both run pointers are retired`);
      else fail(`[${status}] the close left ${pointers.join(", ")} on disk — a pointer naming a finished run is a fact that is no longer true`);

      // The close must not lose its own record while gaining this.
      const ledger = readFileSync(join(ws, ".shapeup/fencetest/harness-run.md"), "utf8");
      const stamped = ["status: " + status, "closed_status: " + status].every((l) => ledger.includes(l))
        && !/^closed_at: ~$/m.test(ledger);
      if (stamped) ok(`[${status}] the close still records its status, cause and timestamp`);
      else fail(`[${status}] the close stopped recording itself: ${ledger.split("\n").filter((l) => l.startsWith("clos") || l.startsWith("status")).join(" | ")}`);

      // UN-FENCING IS NOT RESOLVING — the abandoned order is still unanswered, and `--force` is
      // still what answers it. A close that wrote a result here would spend an attempt on work
      // nobody did.
      const resultsDir = join(ws, ".shapeup/fencetest/results");
      const results = existsSync(resultsDir) ? readdirSync(resultsDir).filter((f) => f.endsWith(".json")) : [];
      if (results.length === 0) ok(`[${status}] the abandoned order is still unanswered — the close released the fence without claiming the work was done`);
      else fail(`[${status}] the close wrote ${results.join(", ")} — un-fencing must not masquerade as resolving`);

      // The close's OTHER duty, pinned here because nothing above would notice it stopping: every
      // terminal ending exports its fact tables, keyed by run id. `shipped` is exempt — the Ship
      // phase exports itself before ever calling the close.
      if (status !== "shipped") {
        const exportsRoot = join(ws, ".shapeup/exports");
        const runs = existsSync(exportsRoot) ? readdirSync(exportsRoot) : [];
        const tables = runs.length ? readdirSync(join(exportsRoot, runs[0])) : [];
        if (runs.length === 1 && tables.length > 0) ok(`[${status}] the close still exports its fact tables (${tables.length} under one run key) — teardown did not cost the run its record`);
        else fail(`[${status}] the export is missing or unkeyed (${runs.length} run dir(s), ${tables.length} table(s)) — a close that retires the run must still leave its records behind`);
      }
    } finally {
      rmSync(ws, { recursive: true, force: true });
    }
  }
}
