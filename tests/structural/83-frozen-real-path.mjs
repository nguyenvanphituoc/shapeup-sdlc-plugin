// A frozen glob protects a FILE, and the hook used to compare a SPELLING. Two spellings of the
// same file walked through the attestation freeze: a case variant (`Receipts/` for `receipts/`)
// on a filesystem that folds case, and a symlink inside an allowed substrate pointing at the
// frozen file. This module drives both through the real hook against a real compiled order.
import { mkdtempSync, existsSync, rmSync, mkdirSync, symlinkSync, writeFileSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  const GUARD = join(ROOT, "hooks/sandbox-guard.mjs");
  const { matchesAny, realPathOf, fsFoldsCase } = await import(GUARD);

  section("135. A frozen path is denied under every spelling — case variants and symlinks resolve to the file");

  const ask = (cwd, relPath, toolName = "Write") => {
    const payload = JSON.stringify({ tool_name: toolName, cwd, tool_input: { file_path: join(cwd, relPath), content: "x" } });
    const r = spawnSync("node", [GUARD], { encoding: "utf8", input: payload });
    return { denied: (r.stdout || "").includes('"permissionDecision":"deny"'), frozen: /frozen/i.test(r.stdout || ""), out: r.stdout || "" };
  };

  // WHAT THIS MODULE CAN AND CANNOT DISCRIMINATE, since the freeze was inverted. `realPathOf` now
  // does most of the work for a file that EXISTS — it resolves the spelling away before any glob is
  // consulted — so the case-fold flag is load-bearing only for a path that does not exist yet,
  // where the filesystem cannot be asked what the name means. For those the answer is a platform
  // fact and not a derivable one, so the fold is pinned at the matcher (below) rather than through
  // an assertion about an unborn file that would encode one platform's behaviour as the rule.
  // Pure helpers first — these hold on every platform.
  if (matchesAny("Receipts/dispatch.jsonl", ["receipts/**"], true) && !matchesAny("Receipts/dispatch.jsonl", ["receipts/**"], false)) {
    ok("matchesAny folds case only when asked — the glob stays as the compiler wrote it");
  } else fail("matchesAny's fold flag does not behave: folded should match a case variant, unfolded should not");

  const ws = mkdtempSync(join(tmpdir(), "frozen-real-path-"));
  try {
    const compiled = spawnSync("node", [KERNEL, "compile", "--operation", "execute", "--worker", "task-executor", "--slug", "demo", "--cwd", ws], { encoding: "utf8" });
    const orderPath = join(ws, ".shapeup", "demo", "orders", "execute.json");
    if (compiled.status !== 0 || !existsSync(orderPath)) {
      fail(`could not compile a real "execute" order\nstdout: ${compiled.stdout}\nstderr: ${compiled.stderr}`);
      return;
    }
    ok('compiled a real "execute" order through `harness compile`');

    // realPathOf: a path that does not exist yet re-attaches its tail to the real ancestor, and a
    // dangling symlink is followed by reading it.
    const realWs = realpathSync.native(ws);
    const unborn = realPathOf(join(ws, ".shapeup", "demo", "t0", "verdicts", "r1-a1-t1.json"));
    if (unborn === join(realWs, ".shapeup", "demo", "t0", "verdicts", "r1-a1-t1.json")) ok("realPathOf resolves the existing ancestors and keeps the unborn tail");
    else fail(`realPathOf mangled an unborn path: ${unborn}`);

    // --- case variants: only a filesystem that folds case can be attacked this way -------------
    const canon = [
      [".shapeup/demo/receipts/dispatch.jsonl", ".shapeup/demo/Receipts/dispatch.jsonl", "dispatch receipt ledger"],
      [".shapeup/demo/legs.jsonl", ".shapeup/demo/LEGS.jsonl", "leg-completion ledger"],
      [".shapeup/demo/t0/verdicts/r1-a1-t1.json", ".shapeup/demo/T0/Verdicts/r1-a1-t1.json", "T0 verdict"],
    ];
    if (fsFoldsCase(realWs)) {
      ok("this filesystem folds case — the case-variant spellings below name the frozen files themselves");
      for (const [c, variant, label] of canon) {
        const a = ask(ws, c);
        const b = ask(ws, variant);
        if (a.denied && a.frozen && b.denied && b.frozen) ok(`DENIES the ${label} under both spellings (${c} and ${variant})`);
        else fail(`the ${label} is denied as "${c}" (${a.denied ? "deny" : "allow"}) but its spelling "${variant}" is ${b.denied ? "denied, not as frozen" : "ALLOWED"} — the freeze is one keystroke wide\n${b.out}`);
      }
    } else {
      ok("this filesystem distinguishes case — a case variant is a different file here, and the fold is exercised where the filesystem folds (macOS, Windows)");
      // WHAT THIS BRANCH CANNOT PROVE ANY MORE, and why the case below replaces it. A build order
      // freezes the whole run trace, so a case variant of a frozen channel is frozen on BOTH
      // filesystems — here because it is another file under that same trace, not because anything
      // folded. The property the fold must not break is asked outside the trace, below, where both
      // filesystems can be asked the same question and answer differently for the right reason.
      if (!matchesAny("receipts/dispatch.jsonl", ["Receipts/**"], false) && matchesAny("receipts/dispatch.jsonl", ["Receipts/**"], true)) {
        ok("the matcher folds only when asked — the fold is a filesystem fact, never a default");
      } else fail("matchesAny folds when it was not asked to, or refuses to when it was");
    }

    // --- symlinks: an allowed substrate must not be a door into a frozen file ------------------
    const order = JSON.parse(readFileSync(orderPath, "utf8"));
    order.substrate.allowed = ["src/**"];
    writeFileSync(orderPath, JSON.stringify(order));
    mkdirSync(join(ws, "src"), { recursive: true });
    symlinkSync("../.shapeup/demo/legs.jsonl", join(ws, "src", "legs.jsonl"));            // dangling file link
    symlinkSync("../.shapeup/demo/t0", join(ws, "src", "trace"));                         // dangling dir link

    const plain = ask(ws, "src/plain.ets");
    if (!plain.denied) ok("ALLOWS an ordinary write inside the allowed substrate (src/plain.ets)");
    else fail(`the allowed substrate itself is denied — the real-path comparison broke the happy path\n${plain.out}`);

    // THE FOLD FOLLOWS THE FILESYSTEM, NEVER A PLATFORM GUESS — and this is the one question both
    // filesystems can be asked, because the answer is derived rather than assumed: `SRC/app.ts` is
    // permitted exactly when it IS `src/app.ts`, which the filesystem decides and `realPathOf`
    // reports. Asserting a fixed answer here would encode one platform's behaviour as the rule;
    // this compares the guard's answer against the identity the filesystem itself gives.
    writeFileSync(join(ws, "src", "app.ts"), "x");
    const sameFile = realPathOf(join(ws, "SRC", "app.ts")) === realPathOf(join(ws, "src", "app.ts"));
    const variantSrc = ask(ws, "SRC/app.ts");
    if (sameFile && !variantSrc.denied) ok("this filesystem calls SRC/app.ts the same file as src/app.ts, and the guard permits it — the fold reaches the substrate, not only the freeze");
    else if (!sameFile && variantSrc.denied && !variantSrc.frozen) ok("this filesystem calls SRC/app.ts a different file, and the guard denies it as out of substrate rather than as frozen");
    else fail(`the guard disagrees with the filesystem about SRC/app.ts: same_file=${sameFile} denied=${variantSrc.denied} frozen=${variantSrc.frozen}\n${variantSrc.out}`);

    const viaLink = ask(ws, "src/legs.jsonl");
    if (viaLink.denied && viaLink.frozen) ok("DENIES a write through a file symlink inside src/** that lands on the frozen leg ledger");
    else fail(`a symlink src/legs.jsonl -> .shapeup/demo/legs.jsonl was ${viaLink.denied ? "denied, not as frozen" : "ALLOWED"} — the substrate is a door into the attestation\n${viaLink.out}`);

    const viaDirLink = ask(ws, "src/trace/verdicts/r1-a1-t1.json");
    if (viaDirLink.denied && viaDirLink.frozen) ok("DENIES a write through a directory symlink whose target does not exist yet (src/trace -> .shapeup/demo/t0)");
    else fail(`a write through a dangling directory link into t0/verdicts/ was ${viaDirLink.denied ? "denied, not as frozen" : "ALLOWED"}\n${viaDirLink.out}`);

    const viaLinkEdit = ask(ws, "src/legs.jsonl", "Edit");
    if (viaLinkEdit.denied) ok("DENIES an Edit through the same link, not only a Write");
    else fail(`an Edit through the symlink was allowed\n${viaLinkEdit.out}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}
