// A T0 verdict recorded `exit 0`, `pass: true` and a captured tail, and nothing about where the
// command ran. Measured on a consumer whose toolchain resolves through a cache keyed by the
// project's absolute path: the working tree built green, a clone of the same commit at another
// path failed on a registry 404, and a clone with a seeded cache produced two errors the original
// never saw. Three environments, three outcomes, one tree — three verdicts that read the same.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  section("145. A T0 verdict records the machine it was measured on, and judges nothing by it");

  const { environmentFingerprint, invokedTokens, declaredCaches, canonical, ENV_ALLOWLIST } =
    await import(join(ROOT, "kernel/verify/env.mjs"));

  // --- the parser: the token as written, because the resolved path is what a basename loses ----
  const cases = [
    ["./scripts/t0-assemble.sh", ["./scripts/t0-assemble.sh"]],
    ["cd app && DEVECO_SDK_HOME=/x /tools/hvigor/bin/hvigorw assembleHap", ["/tools/hvigor/bin/hvigorw"]],
    ["env CI=1 npm test && npm run lint", ["npm"]],
  ];
  let parserOk = true;
  for (const [cmd, want] of cases) {
    const got = invokedTokens(cmd);
    if (JSON.stringify(got) !== JSON.stringify(want)) {
      parserOk = false;
      fail(`invokedTokens(${JSON.stringify(cmd)}) = ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    }
  }
  if (parserOk) ok("the invoked token survives a cd prefix, a VAR= assignment and an env wrapper — recorded as written, not as a basename");

  // --- the fingerprint itself -----------------------------------------------------------------
  const ws = mkdtempSync(join(tmpdir(), "t0-env-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    spawnSync("git", ["config", "user.email", "p@example.invalid"], { cwd: ws });
    spawnSync("git", ["config", "user.name", "p"], { cwd: ws });
    writeFileSync(join(ws, "package-lock.json"), JSON.stringify({ name: "x", lockfileVersion: 3 }));
    spawnSync("git", ["add", "-A"], { cwd: ws });
    spawnSync("git", ["commit", "-q", "-m", "base"], { cwd: ws });

    if (environmentFingerprint(".", { commands: ["npm test"] }).cwd.startsWith("/")) {
      ok("cwd is recorded absolute even when the caller passed a relative one — a path-keyed cache is identified by its path");
    } else fail("a relative cwd was recorded as given");

    const f = environmentFingerprint(ws, { commands: ["npm test"] });
    if (f.tree?.head && /^[0-9a-f]{40}$/.test(f.tree.head) && f.tree.dirty === false && f.tree.branch === "main") {
      ok("the tree is recorded: head, branch, and a clean flag");
    } else fail(`tree not recorded: ${JSON.stringify(f.tree)}`);

    writeFileSync(join(ws, "dirt.txt"), "x");
    if (environmentFingerprint(ws, {}).tree?.dirty === true) ok("an uncommitted change reads dirty — the same commit is not always the same tree");
    else fail("a dirty tree was recorded as clean");

    if (f.lockfiles.some((l) => l.file === "package-lock.json" && /^[0-9a-f]{64}$/.test(l.sha256))) {
      ok("a lockfile at the root is digested — what was declared, though never what is installed");
    } else fail(`lockfiles: ${JSON.stringify(f.lockfiles)}`);

    // Where the command actually runs, not only where the project starts: a consumer whose fixtures
    // are `cd app && …` keeps the lockfile that decides the build one level down, and a root-only
    // scan recorded an empty list beside a build whose dependencies were the whole question.
    mkdirSync(join(ws, "app"), { recursive: true });
    writeFileSync(join(ws, "app/oh-package-lock.json5"), "{ lockfileVersion: 3 }");
    const sub = environmentFingerprint(ws, { commands: ["cd app && ./hvigorw assembleHap"] });
    if (sub.lockfiles.some((l) => l.file === "app/oh-package-lock.json5" && /^[0-9a-f]{64}$/.test(l.sha256))) {
      ok("a lockfile in the directory the command cds into is digested too, named by its path");
    } else fail(`a cd target's lockfile was missed: ${JSON.stringify(sub.lockfiles)}`);

    if (f.toolchain.some((t) => t.bin === "npm")) ok("the invoked binary is recorded with where it resolved on this machine");
    else fail(`toolchain: ${JSON.stringify(f.toolchain)}`);

    const record = JSON.stringify(f);
    if (/^[0-9a-f]{64}$/.test(f.host.hostname_sha256 || "") && !record.includes(hostname())) {
      ok("the hostname is hashed, not stored — equality is all a reader needs");
    } else fail("the record stores the hostname in the clear");

    const leaked = ENV_ALLOWLIST.filter((k) => {
      const v = process.env[k];
      return typeof v === "string" && v.length > 3 && record.includes(v);
    });
    if (!leaked.length) ok("no environment VALUE reaches the record — only the allowlist of names and one digest over their values");
    else fail(`environment values are stored in the record: ${leaked.join(", ")}`);

    // The digest is a function of the block, and only of the block.
    if (environmentFingerprint(ws, { commands: ["npm test"] }).env_sha256
        === environmentFingerprint(ws, { commands: ["npm test"] }).env_sha256) {
      ok("the digest is stable across calls on one machine — it is not a timestamp in disguise");
    } else fail("env_sha256 changed between two calls with the same inputs");

    if (environmentFingerprint(ws, { commands: ["npm test"] }).env_sha256
        !== environmentFingerprint(ROOT, { commands: ["npm test"] }).env_sha256) {
      ok("the same command in another directory digests differently — which is the disagreement the block exists to make visible");
    } else fail("two different working directories produced the same env_sha256");

    if (canonical({ b: 1, a: [2, { d: 4, c: 3 }] }) === canonical({ a: [2, { c: 3, d: 4 }], b: 1 })) {
      ok("the canonical form sorts keys at every depth, so the digest does not depend on insertion order");
    } else fail("canonical() is order-dependent");

    // Caches: declared and not-declared are different facts.
    if (declaredCaches(null) === null) ok("no profile means caches: null — `not asked` is not `none`");
    else fail("a missing profile reported an empty cache list");
    const prof = join(ws, "profile.md");
    writeFileSync(prof, "---\nschema_version: 1\ncache_dirs: [\"~/.ohpm\", \"/tmp/gradle\"]\n---\n\n# p\n");
    const caches = declaredCaches(prof);
    if (Array.isArray(caches) && caches.length === 2 && caches[0].path.startsWith("/") && typeof caches[0].exists === "boolean") {
      ok("a profile that declares cache dirs gets them recorded, resolved, with whether each is on disk");
    } else fail(`declaredCaches over a profile: ${JSON.stringify(caches)}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // --- through the real verifier ---------------------------------------------------------------
  const box = mkdtempSync(join(tmpdir(), "t0-env-run-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: box });
    mkdirSync(join(box, "shapeup/demo/scopes"), { recursive: true });
    writeFileSync(join(box, "shapeup/demo/scopes/sc-01.md"),
      ["---", "schema_version: 1", "scope_id: sc-01", "title: t",
        "allowed_file_substrate: [\"src/**\"]", "e2e_verification_fixtures:", "  - \"node -e 0\"", "---", "", "# sc-01", ""].join("\n"));
    const r = spawnSync(process.execPath,
      [KERNEL, "verify", "t0", "shapeup/demo/scopes/sc-01.md", "--round", "1", "--attempt", "1", "--no-ratchet", "--cwd", box],
      { cwd: box, encoding: "utf8", timeout: 120_000 });
    const dir = join(box, ".shapeup/demo/t0/verdicts");
    const files = (() => { try { return readdirSync(dir); } catch { return []; } })();
    if (!files.length) { fail(`verify t0 wrote no artifact (exit ${r.status}): ${(r.stderr || r.stdout).slice(0, 300)}`); return; }
    const v = JSON.parse(readFileSync(join(dir, files[0]), "utf8"));
    if (v.env?.env_sha256 && v.env.cwd?.startsWith("/") && v.env.host?.platform) {
      ok("`verify t0` writes the environment block into the verdict artifact, with an absolute cwd");
    } else fail(`the verdict carries no usable environment block: ${JSON.stringify(v.env ?? null).slice(0, 200)}`);
    if (v.overall === "green") ok("recording the environment did not change the verdict — the block measures, it does not judge");
    else fail(`a passing fixture produced ${v.overall}: ${JSON.stringify(v.fixtures).slice(0, 200)}`);
    if ((v.env?.toolchain || []).some((t) => t.bin === "node")) ok("the fixture's own binary is in the artifact's toolchain list");
    else fail(`toolchain in the artifact: ${JSON.stringify(v.env?.toolchain)}`);
  } finally {
    rmSync(box, { recursive: true, force: true });
  }
}
