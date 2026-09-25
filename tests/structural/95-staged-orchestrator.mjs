// A run stages its own copy of the workflow scripts when it is OPENED and keeps them for its life.
// That is right for a run in flight — an upgrade must not swap the orchestrator under it — and it
// is silent: relaunching an existing run after installing a new version executes the OLD script,
// reports normally, closes normally, and every observation made of it is an observation of the
// previous release. Worse than a failed soak, because it is confident evidence about the wrong
// artifact. The state probe every launch already calls now compares, and says so.
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;
  const KERNEL = join(ROOT, "kernel/harness.mjs");
  section("147. A launch says when the orchestrator it will run is not the installed one");

  const { stagedWorkflowDrift, driftWarning, installedPluginVersion } =
    await import(join(ROOT, "kernel/probe/staged.mjs"));

  if (installedPluginVersion(ROOT) === JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version) {
    ok("installedPluginVersion reads the plugin's own declared version");
  } else fail("installedPluginVersion does not agree with the repo's own plugin.json");

  const ws = mkdtempSync(join(tmpdir(), "staged-"));
  try {
    spawnSync("git", ["init", "-q", "-b", "main"], { cwd: ws });
    const kernel = (...a) => spawnSync(process.execPath, [KERNEL, ...a, "--cwd", ws], { cwd: ws, encoding: "utf8" });
    const opened = kernel("init", "run", "--slug", "f", "--intake-text", "Add a cart badge");
    if (opened.status !== 0) { fail(`could not open a run: ${opened.stderr.slice(0, 200)}`); return; }

    const stagedDir = join(ws, ".shapeup/workflows");
    const staged = (() => { try { return readdirSync(stagedDir).filter((f) => f.endsWith(".js")); } catch { return []; } })();
    if (staged.length) ok(`opening the run staged ${staged.length} workflow script(s) into the local tier`);
    else { fail("the run opened without staging a workflow script — this fixture cannot measure"); return; }

    const same = stagedWorkflowDrift(ws, ROOT, "f");
    if (same.checked && same.drift.length === 0 && driftWarning(same) === null) {
      ok("a freshly opened run's staged copy matches the installed plugin — checked, no drift, nothing to warn about");
    } else fail(`a fresh run reported drift: ${JSON.stringify({ checked: same.checked, drift: same.drift })}`);

    // The upgrade: the installed plugin moves on, the run keeps its copy.
    const target = join(stagedDir, staged[0]);
    writeFileSync(target, readFileSync(target, "utf8") + "\n// a previous release\n");
    const drifted = stagedWorkflowDrift(ws, ROOT, "f");
    const warning = driftWarning(drifted);
    if (drifted.checked && drifted.drift.some((d) => d.file === staged[0]) && drifted.drift[0].staged_sha256 !== drifted.drift[0].installed_sha256) {
      ok("a staged script that differs from the installed one is reported as drift, with both digests");
    } else fail(`drift not detected: ${JSON.stringify(drifted.drift)}`);
    if (warning && /NOT the installed one/.test(warning) && warning.includes(staged[0])) {
      ok("the warning names the scripts that differ, and says a run keeps the copy it opened with");
    } else fail(`the warning is unusable: ${JSON.stringify(warning)}`);
    if (drifted.installed_version && warning.includes(drifted.installed_version)) ok("the warning names the installed version, so the operator can see which release they are actually measuring");
    else fail(`the warning names no version: installed=${drifted.installed_version}`);

    // Through the CLI the launch actually calls.
    const probed = kernel("probe", "resume", "--slug", "f", "--plugin-root", ROOT);
    const st = (() => { try { return JSON.parse(probed.stdout).staged_workflow; } catch { return null; } })();
    if (st && st.checked === true && st.drift.includes(staged[0]) && typeof st.warning === "string") {
      ok("`probe resume --plugin-root` carries the drift and the warning in the state the launch reads");
    } else fail(`probe resume did not report the drift: ${JSON.stringify(st)}`);

    const blind = kernel("probe", "resume", "--slug", "f");
    const stBlind = (() => { try { return JSON.parse(blind.stdout).staged_workflow; } catch { return null; } })();
    if (stBlind && stBlind.checked === false && !stBlind.warning) {
      ok("without a plugin root the probe reports `checked: false` — a comparison it could not make is not agreement");
    } else fail(`the probe claimed a comparison it could not make: ${JSON.stringify(stBlind)}`);

    // A warning, never a block: the run is still resumable and every other fact still derives.
    const full = (() => { try { return JSON.parse(probed.stdout); } catch { return null; } })();
    if (probed.status === 0 && full?.next_phase) ok(`the probe still exits 0 and still derives the phase (${full.next_phase}) — drift warns, it does not block`);
    else fail(`the drift turned the state probe into a failure: exit ${probed.status}`);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }

  // The launch reads it and puts it in the run's state warnings, where the close records it.
  const wf = readFileSync(join(ROOT, "skills/tech-lead/workflows/shapeup-run.js"), "utf8");
  if (/probe resume --slug \$\{slug\} --plugin-root/.test(wf)) ok("the workflow's first state probe hands its own plugin root");
  else fail("the workflow asks for the resume state without naming the plugin it is running from");
  if (/rs\.staged_workflow\?\.warning/.test(wf) && /stateWarnings\.push\(rs\.staged_workflow\.warning\)/.test(wf)) {
    ok("the launch logs the warning and carries it into the run's state warnings, so the close records it too");
  } else fail("the launch reads the drift and does nothing with it");
}
