// signals — the failure classes an order can carry, built when the order opens.
//
// A rule's `when.signal` names one of these. The set is derived from records the kernel or a hook already
// wrote (the T0 trial ledger, the decision metrics, the previous verdict, the hunt result, the order's own
// id) — nothing is asked of the loop or a worker, and a signal can only choose which rules LOAD: it is never
// evidence that anything happened.
import { readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { signalNames, pathologyId } from "./signal-names.mjs";
import { better } from "../core/t0.mjs";
import { trials as trialsPath, resultsDir, metricsShard } from "./paths.mjs";

export { signalNames, pathologyId };

const readJson = (p) => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };
const rows = (p) => { try { return readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const LENS = { "①": "boundary", "②": "concurrency", "③": "interruption", "④": "cross-uc", "⑤": "no-go", "⑥": "residue" };
const lensOf = (tag) => {
  const t = String(tag ?? "").toLowerCase();
  for (const [sym, name] of Object.entries(LENS)) if (t.includes(sym) || t.includes(name) || t.includes(name.replace("-", ""))) return name;
  return null;
};

/**
 * The signals an order carries.
 * @param {string} cwd - Project root.
 * @param {string} slug - Feature slug.
 * @param {object} order - The order being opened.
 * @returns {string[]} Members of the KbSignal vocabulary, sorted, each present in the schema.
 */
export function signalsFor(cwd, slug, order) {
  const out = new Set();
  const m = /\/r(\d+)-a(\d+)$/.exec(order?.order_id ?? "") ?? /\/[a-z]+-r(\d+)/.exec(order?.order_id ?? "");
  const round = Number(order?.payload?.round ?? m?.[1] ?? 0); const attempt = Number(m?.[2] ?? 0);
  if (round >= 2) out.add("round.ge2");
  if (attempt >= 2) out.add("attempt.ge2");

  // A first build has no history to be classified by: failure classes are read only for a fix or a later round.
  if (order?.operation !== "fix" && round < 2) return [...out].sort();

  const scope = order?.payload?.scope_contract ? basename(String(order.payload.scope_contract), ".md") : null;
  const t = rows(trialsPath(cwd, slug)).filter((r) => !scope || r.scope_id === scope);
  const last = t.at(-1);
  if (last && last.status !== "kept") {
    const base = t.find((r) => r.trial === last.baseline_trial);
    if (base?.score && last.score) {
      if (better(base.score, last.score) === true) out.add("t0.regressed");
      else if (better(last.score, base.score) === false && better(base.score, last.score) === false) out.add("t0.flat");
    }
  }

  const r = Math.max(0, round - 1);
  const ev = readJson(join(resultsDir(cwd, slug), `evaluate-r${r}.json`));
  for (const c of ev?.verdict?.criteria ?? ev?.criteria ?? []) if (c?.verdict === "FAIL") out.add(`eval.fail.${c.dimension || "spec-conformance"}`);

  const hunt = readJson(join(resultsDir(cwd, slug), "hunt.json"));
  for (const d of hunt?.discoveries ?? []) { const l = lensOf(d?.lens); if (l) out.add(`qa.lens.${l}`); }

  if (rows(metricsShard(cwd)).some((x) => x.kind === "pathology" && x.slug === slug && `pathology.${x.pathology}` === "pathology.PA3")) out.add("pathology.PA3");

  const known = new Set(signalNames());
  return [...out].filter((s) => known.has(s)).sort();
}
