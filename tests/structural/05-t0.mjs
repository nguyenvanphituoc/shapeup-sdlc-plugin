// T0, executed: the witness that runs a scope's fixtures and re-hashes what it cites.
//
// Everything here goes through the shipped command against a real git work tree, because the
// ratchet acts on the tree and a fixture-less unit of it proves nothing. The questions, in order:
// is a green a green and a red a red; does the artifact keep the evidence a judge needs (stderr for a
// failure, stdout for a pass, bounded, and "never ran" kept apart from "ran and failed"); does a
// strictly better attempt survive while a worse one is rolled back; and does the cited hash match.
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { scratch, put, kernel, json, slurp, existsSync } from "../lib/fixture.mjs";

const node = (code) => `node -e "${code}"`;

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

  /** One attempt through the real command; returns the printed answer, exit code and the artifact. */
  const attempt = (s, contract, n, extra = []) => {
    const r = kernel(ROOT, ["verify", "t0", contract, "--round", "1", "--attempt", String(n), "--cwd", s.dir, "--out", join(s.dir, ".shapeup/demo"), ...extra], { cwd: s.dir });
    const file = r.out?.path ? resolve(s.dir, r.out.path) : null;
    return { ...r, file, artifact: file && existsSync(file) ? json(file) : null };
  };
  const contractFor = (s, fixtures) => put(s.dir, "scopes/demo.json", {
    schema_version: 1, scope_id: "demo", allowed_file_substrate: ["src/**"], e2e_verification_fixtures: fixtures,
  });
  const repo = (tag) => {
    const s = scratch(tag, { git: true });
    put(s.dir, "src/seed.txt", "seed\n");
    put(s.dir, "src/a.txt", "");
    put(s.dir, "src/b.txt", "");
    put(s.dir, ".gitignore", ".shapeup/\n");
    const g = (a) => import("node:child_process").then((m) => m.spawnSync("git", a, { cwd: s.dir }));
    return g(["add", "-A"]).then(() => g(["commit", "-q", "-m", "seed"])).then(() => s);
  };

  section("t0 — green is green, red is red, and the artifact keeps the evidence");
  {
    const s = await repo("t0-basic");
    try {
      const green = attempt(s, contractFor(s, [node("console.log('4 fixtures, 4 passed')")]), 1, ["--no-ratchet"]);
      check(green.status === 0 && green.artifact?.overall === "green", "a passing fixture is overall green and exits 0");
      check(green.artifact?.fixtures?.[0]?.stdout_tail?.includes("4 passed"), "a pass keeps its stdout, so a green that ran nothing stays visible");

      const red = attempt(s, contractFor(s, [node("console.error('src/cart.ts:31 error TS2551'); process.exit(1)")]), 2, ["--no-ratchet"]);
      check(red.status === 1 && red.artifact?.overall !== "green", "a failing fixture is not green and exits 1");
      const row = red.artifact?.fixtures?.[0] ?? {};
      check(row.stderr_tail?.includes("TS2551") && !row.error, "a failure keeps its stderr and carries no `error` (that field means 'never ran')");

      const never = attempt(s, contractFor(s, [node("process.stdout.write('x'.repeat(2*1024*1024))")]), 3, ["--no-ratchet"]);
      check(Boolean(never.artifact?.fixtures?.[0]?.error), "a fixture that could not run keeps its `error`, apart from one that ran and failed");

      const noisy = attempt(s, contractFor(s, [node("for (let i=0;i<40000;i++) console.log('filler '+i); console.log('LAST LINE MARKER')")]), 4, ["--no-ratchet"]);
      const tail = noisy.artifact?.fixtures?.[0]?.stdout_tail ?? "";
      check(tail.includes("LAST LINE MARKER") && tail.length <= 8192 && /truncat/i.test(tail),
        "output is kept as a bounded tail that says it was truncated, so a stack trace survives and a partial stream never reads as whole");

      check(typeof green.artifact?.env === "object" && green.artifact.env !== null,
        "the artifact carries the environment fingerprint, so a green from a different toolchain is distinguishable");
      const digest = createHash("sha256").update(slurp(green.file)).digest("hex");
      check(green.out?.sha256 === digest, "the printed answer cites the sha256 of the artifact it wrote, and it re-hashes to the same value");
    } finally { s.done(); }
  }

  section("t0 — the ratchet keeps strictly better work and rolls back worse");
  {
    const s = await repo("t0-ratchet");
    try {
      const both = contractFor(s, [
        node("process.exit(require('fs').readFileSync('src/a.txt','utf8').trim()?0:1)"),
        node("process.exit(require('fs').readFileSync('src/b.txt','utf8').trim()?0:1)"),
      ]);
      let r = attempt(s, both, 1);
      check(r.out?.status === "kept" && r.artifact?.overall !== "green", "attempt 1 (0 of 2) is the baseline and is kept");
      put(s.dir, "src/a.txt", "a");
      r = attempt(s, both, 2);
      check(r.out?.status === "kept" && r.status === 1, "attempt 2 (1 of 2) is red but strictly better: kept, and the exit code still says red");
      put(s.dir, "src/a.txt", "");
      r = attempt(s, both, 3);
      check(r.out?.status === "reverted" && slurp(join(s.dir, "src/a.txt")) === "a",
        "attempt 3 (worse) is reverted and the tracked file is restored from the last kept snapshot");
      put(s.dir, "src/b.txt", "b");
      r = attempt(s, both, 4);
      check(r.out?.status === "kept" && r.artifact?.overall === "green" && r.status === 0, "attempt 4 (2 of 2) is kept and green");
    } finally { s.done(); }
  }

  section("t0 — a contract it cannot read is a usage error, not a pass");
  {
    const s = scratch("t0-missing", { git: true });
    try {
      const r = kernel(ROOT, ["verify", "t0", join(s.dir, "nope.json"), "--round", "1", "--attempt", "1", "--cwd", s.dir], { cwd: s.dir });
      check(r.status === 2, "a missing scope contract exits 2 and writes no verdict");
    } finally { s.done(); }
  }
}
