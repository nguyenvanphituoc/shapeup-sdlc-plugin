// checks — the registry of closed checks a rule of kind `check` may name.
//
// WHY A REGISTRY AND NOT CODE IN A RULE. A rule is text a person or a reflector files, and text that runs is a way
// in. A check here is a function this plugin ships, named, with parameters that have a shape; a rule only says which
// one to run and with what. A new check arrives only with a release, and lint refuses a rule naming one that does not
// exist. Its message is written as an instruction the worker can follow, because that message is all the worker sees.
//
// A check reports; it never decides a gate and never changes a verdict.

/** One check: the parameters it takes and the function that reads a scope's fixtures. */
export const CHECKS = {
  "fixture-negation-has-twin": {
    describe: "A fixture that passes when a command FAILS also passes when the command is missing; it must run the command's normal form first.",
    params: {},
    /** @param {{fixtures: string[]}} ctx @returns {{fixture: string, message: string}[]} */
    run({ fixtures }) {
      const out = [];
      for (const f of fixtures ?? []) {
        const segs = String(f).split(/&&|\|\||;/).map((x) => x.trim()).filter(Boolean);
        const probe = (seg) => seg.replace(/^!\s*/, "").split(/\s+/).slice(0, 2).join(" ");
        segs.forEach((seg, i) => {
          if (!seg.startsWith("!")) return;
          const key = probe(seg);
          const twin = segs.slice(0, i).some((p) => !p.startsWith("!") && probe(p) === key);
          if (!twin) out.push({ fixture: f, message: `This fixture negates \`${key}\` ("!"), so it also passes when that command is missing or broken. Assert both directions in one fixture: \`${key} <normal case> && ! ${key} <mutated case>\`, so the first half proves the command runs.` });
        });
      }
      return out;
    },
  },
};

export const checkNames = () => Object.keys(CHECKS);

/** Problems with a rule's `params` against the check's declared shape (an empty list means fine). */
export function paramProblems(name, params) {
  const spec = CHECKS[name]?.params; if (!spec) return [`no check "${name}"`];
  const out = []; const p = params ?? {};
  for (const k of Object.keys(p)) if (!(k in spec)) out.push(`"${k}" is not a parameter of ${name}`);
  for (const [k, t] of Object.entries(spec)) {
    if (p[k] === undefined) { if (t.required) out.push(`${name} needs "${k}"`); continue; }
    if (t.type === "int" ? !Number.isInteger(p[k]) : typeof p[k] !== t.type) out.push(`"${k}" must be ${t.type}`);
  }
  return out;
}

/** Run the checks a load set carries against what the scope declared; the findings, each naming its rule. */
export function runChecks(checks, ctx) {
  const out = [];
  for (const c of checks ?? []) {
    const def = CHECKS[c.check]; if (!def || paramProblems(c.check, c.params).length) continue;
    for (const f of def.run(ctx, c.params ?? {})) out.push({ rule: c.id, check: c.check, ...f });
  }
  return out;
}
