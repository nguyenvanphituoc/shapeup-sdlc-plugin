// 12. The report ships the same CLAIMS in both formats, or it ships in neither.
//
// WHY THIS EXISTS. `runner/aggregate.mjs` in the benchmark states the rule outright — "the
// arm-level correction ships in BOTH formats or it ships in neither" — and then nothing checked it.
// The report is two hand-maintained files, `report/sdd-harness-benchmark.md` and `.html`, with no
// generator between them, so every edit is made twice by hand and a figure can silently land in one.
//
// It had. Found by diffing the claim-like figures out of both:
//
//   - "**4.6×** the price of a one-sentence control" — the §6 Q8 clause 5 disclosure that the
//     author's own arm won its one cell only at 4.6x the cost of one sentence — was in the HTML
//     and ABSENT FROM THE MARKDOWN ENTIRELY. That is the single sentence the conflict-of-interest
//     rule exists to force into print, missing from one of the two published artifacts.
//   - the run-total footer ($56 across 108 sessions, $5 of P4's fresh $150) was in the markdown
//     and absent from the HTML.
//
// A reader who found the project through one format got a materially different account of what it
// cost to reach the result than a reader who found the other. That is exactly the class of defect
// this benchmark publishes findings about, occurring in its own report.
//
// WHAT IS COMPARED. Claim-like numeric figures only: p-values, dollar amounts, n=N, X/Y ratios,
// percentages, and multipliers. Not prose — the two formats legitimately differ in wording, and a
// prose diff would be noise that nobody would act on.
//
// WHAT IS DELIBERATELY EXEMPT. Figures that appear only inside an <svg> are chart furniture — axis
// ticks like 33%/67% — and cannot exist in the markdown. They are stripped before comparison rather
// than whitelisted one by one, so a new chart never has to be added to an allow-list.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MD = "report/sdd-harness-benchmark.md";
const HTML = "report/sdd-harness-benchmark.html";

// Claim-like figures: p = 0.048 | $114.52 | 6/12 | n=7 | 47% | 4.6×
const FIGURE = /(?:p\s*=\s*0\.\d+|\$\d[\d,]*(?:\.\d+)?|\b\d{1,3}\s*\/\s*\d{1,3}\b|\bn\s*=\s*\d+|\b\d{1,3}(?:\.\d+)?\s*%|\b\d+(?:\.\d+)?\s*×)/g;

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ").replace(/&times;/g, "×").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&[a-z]+;/g, " ");
}

/** Figures present in a document, normalised so "n&nbsp;=&nbsp;7" and "n=7" are the same claim. */
export function figuresIn(text, { isHtml = false } = {}) {
  let t = text;
  if (isHtml) {
    // Chart furniture cannot exist in markdown. Drop <svg> wholesale rather than allow-listing ticks.
    t = t.replace(/<svg[\s\S]*?<\/svg>/gi, " ");
    // NOR CAN STYLESHEETS OR SCRIPTS. Their bodies survive tag-stripping because the content sits
    // BETWEEN the tags, so every hex colour, viewBox and CSS comment was being read as prose. That
    // is not hypothetical: adding a validated chart palette put the comment "CVD ΔE 10.8/11.0" in
    // :root, whose "8/11" matched the ratio pattern and failed this check against a markdown file
    // that has no stylesheet and never could. A number in a stylesheet is not a published claim.
    t = t.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ");
  }
  t = decodeEntities(t).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return new Set((t.match(FIGURE) || []).map((x) => x.replace(/\s+/g, "")));
}

export async function run(ctx) {
  const { ROOT, ok, fail, section } = ctx;

  section("12. The report ships the same claims in both formats, or in neither");

  const mdPath = join(ROOT, MD), htmlPath = join(ROOT, HTML);
  if (!existsSync(mdPath) || !existsSync(htmlPath)) {
    // Not every checkout of this plugin carries the report; absence is not a failure.
    ok("no two-format report in this tree — parity check not applicable");
    return;
  }

  const inMd = figuresIn(readFileSync(mdPath, "utf8"));
  const inHtml = figuresIn(readFileSync(htmlPath, "utf8"), { isHtml: true });

  const onlyMd = [...inMd].filter((x) => !inHtml.has(x)).sort();
  const onlyHtml = [...inHtml].filter((x) => !inMd.has(x)).sort();

  if (!onlyMd.length && !onlyHtml.length) {
    ok(`report parity: ${inMd.size} claim-like figures, identical in both formats`);
    return;
  }
  if (onlyMd.length) {
    fail(`${onlyMd.length} figure(s) in the MARKDOWN report but not the HTML: ${onlyMd.join(", ")}\n` +
         `    A reader who finds one format gets a different account than a reader who finds the\n` +
         `    other. Put the claim in both, or in neither.`);
  }
  if (onlyHtml.length) {
    fail(`${onlyHtml.length} figure(s) in the HTML report but not the markdown: ${onlyHtml.join(", ")}\n` +
         `    Same rule. If a figure is chart furniture, it belongs inside <svg>, which this check\n` +
         `    already strips — so its appearing here means it is in the prose.`);
  }
}
