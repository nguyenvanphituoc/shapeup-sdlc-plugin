# The stranded tag — evidence packet (HD-022)

**Purpose.** Evidence only, for the PO to decide port / cherry-pick-a-subset / abandon. This
document makes no recommendation; any recommendation-shaped observation belongs in the
`notes_for_po` field of this stage's structured result, marked there as an observation, not a
decision.

**Subject.** `archive/lesson-loop-g0-k` is a tag, not a branch — the local branch
`plan/lesson-loop-g0-k` points at `e511b7e` (3.3.0), an ancestor of `main`. The tag carries 22
commits; `git cherry main archive/lesson-loop-g0-k` marks every one `+` (all 22 are still distinct
from anything on `main` by commit id — which is exactly why this packet checks by *content*
instead, per row 6 below).

**Baseline.** `main` = `78d3c6e` (3.5.0, `plan/requirements-reach-the-verdict` merged). Tag base =
`e511b7e` (3.3.0).

## Method

- **Path spelling.** A file that exists only on the tag is written in git's own `<ref>:<path>`
  form — `archive/lesson-loop-g0-k:tests/invariants.mjs` — never as a bare path. A bare path in a
  living document is a claim that the file is on disk here, and for these it is not; the repo's
  doc-drift check reads it that way too, and was right to.

- **"On main by content?"** — derived by executing a search against the actual code (`grep`,
  `git show --stat`, `git log -- <path>`), never by reading commit prose. Every claim below cites
  the file:line or command that produced it.
- **"Still applies?"** — an *isolated* trial: `git worktree add --detach <scratch> main`, then for
  each commit in turn `git reset --hard main && git cherry-pick -n <sha>`, record CLEAN / NO-OP /
  CONFLICT (and the conflicted paths), then `git cherry-pick --abort && git reset --hard main`
  before the next commit. Every trial started from the same clean `main`, never from a prior
  commit's result — so the header below reads **isolated** only. Where a conflict looked like it
  might be pure stack order (an earlier tag commit not yet applied) rather than a real collision
  with something `main` did independently, that was tested directly — see **Order sensitivity**
  below — instead of asserted from stack position. The worktree was removed after use
  (`git worktree remove`); nothing in `/Users/teo/workspace/proj-harness-plugin`'s own working tree
  was touched at any point — every `reset --hard` / `checkout` / `cherry-pick` ran inside the
  scratch worktree only.
- **"What 3.5.0 rewrote underneath it"** — checked per file with
  `git log --oneline e511b7e..main -- <file>`, never assumed from the three files being adjacent in
  one commit.

## Two register claims re-derived, not inherited

**1. "The tag converts six items from *implement* to *port*."** Not measured, and re-derivation
confirms it is wrong. Walking all 22 commits against every register entry (§ *Register impact*,
below) finds:

- **1 entry closed in full**: HD-011 (rows 1+10 together — see there).
- **2 entries half-closed**: HD-019 (row 22 — the `gate` export table, not the L0/L4/COACH-1 rows)
  and HD-016 (row 14 — the unrecognised-output half, not the missing-line-number half).
- **1 entry made *worse* if ported alone**: HD-016 again (row 18 — `a5ce8af`'s `own_errors` axis is
  what the register's own text identifies as the weld; porting it without first extending the
  digester is what turns a missing signal into a self-reinforcing one).
- **Everything else the tag touches** (rows 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20,
  21 — seventeen rows, which with 1, 10, 14, 18 and 22 above accounts for all 22) either
  has no numbered register entry to close, or — row 6, `97af8a2` — closes a gap that was already
  independently closed on `main`.

This matches the count the register's own prose already carries after its first-filing correction
("one entry closed, two halves, one made worse") — re-derived here from the code rather than
inherited from that sentence. **Six is confirmed wrong; the register's already-corrected number is
confirmed right, independently.**

**2. The `9da0f14` / digester claim.** Re-derived from the code, not from HD-016's prose:

- `main`'s `kernel/probe/digest.mjs` recognises **zero** hvigor/ArkTS/Hypium output today —
  `grep -n "hvigor\|arkts\|ArkTS\|Hypium" kernel/probe/digest.mjs` returns nothing.
- `9da0f14`'s own diff adds `AT_FILE = /^(.*?)\s*At [Ff]ile:\s*(.+?):(\d+)(?::\d+)?\s*$/` — the
  capturing group for the line number, `(\d+)`, is **not optional**. A diagnostic with a file and no
  line still cannot match this pattern.
- So: porting `9da0f14` would take `main` from "recognises nothing" to "recognises hvigor/ArkTS
  output that carries a line number" — the unrecognised-output half — and would do nothing for a
  diagnostic that names a file with no line, because the commit's own regex still requires one.

This is the same conclusion HD-016's prose already states. Independently re-derived here by
executing the regex against the claim rather than trusting the sentence — it holds.

## The 22 rows

Chronological order (oldest first), matching `git cherry`'s own order and `git cherry-pick`'s
natural application order. "Still applies" is the isolated trial only (see Method); order-sensitive
cases are cross-referenced into **Order sensitivity** below rather than asserted inline.

| # | commit | subject | on `main` by content? | still applies (isolated)? | register entry |
|---|---|---|---|---|---|
| 1 | `01aea8f` | feat(report): record every close of a run and pin the rules each order reads | **No.** `kernel/lib/kb.mjs`, `kb_sha256`, `report harvest` and any `closeOut` sequencing are absent from `main` (`grep -rn "kb_sha256\|closeOut" kernel/ skills/` — no hits; `find kernel -iname kb.mjs` — none). | CONFLICT — `CHANGELOG.md`, `tests/structural.mjs`. Every other file it touches (`AGENTS.md`, `skills/tech-lead/SKILL.md`, `references/gates.md`, `references/protocol.md`, `schemas/domain.schema.json`, `schemas/work-order.schema.json`) merges **clean** — see doc-risk note below. | HD-011 (closes in full, together with row 10) |
| 2 | `bae0aeb` | feat(eval): key every criterion verdict to the spec row it grades | **No.** No `kernel/lib/spec-ids.mjs`, no `criterion_ref`/`criterion_class` anywhere (`grep -rn` — no hits). `main`'s existing `criterion_verdict` export row (`kernel/report/export.mjs:145 criterionRows()`) carries a raw `criterion` string and drops the `traces_to` the ledger line already records — it is a different, earlier mechanism — `criterionRows()` comes from `4b8b353`, which `git merge-base --is-ancestor 4b8b353 e511b7e` confirms PRE-DATES the tag base, not from `9106bc8` (`git show --name-only --format="" 9106bc8 | grep -c kernel/report/export.mjs` = 0). Not this commit's mechanism either way. | CONFLICT — `CHANGELOG.md`, `kernel/reduce/graph.mjs`, `kernel/reduce/ingest.mjs`, `tests/structural.mjs`. The `graph.mjs` conflict is a real, independent collision, and its two sides read the other way round from how the first filing had them: `main`'s side carries `reqId` on the `../lib/contract.mjs` import (added post-tag-base by `531c9ed`, per `git log -S'reqId' e511b7e..main -- kernel/reduce/graph.mjs`), while `bae0aeb` adds `roundBuildDir, evaluationDir` to the `../lib/paths.mjs` import plus a new `../lib/spec-ids.mjs` import. `main` has neither of the tag's symbols in that file — `git show main:kernel/reduce/graph.mjs | grep -c roundBuildDir` = 0 — and `9106bc8` never touches the file at all (`git show --name-only --format="" 9106bc8 | grep -c kernel/reduce/graph.mjs` = 0). Both sides changed the same import statement for unrelated reasons; only the attribution changes, not the collision. | none numbered |
| 3 | `614ecdb` | fix(hill-chart): show the build and criterion nodes the run graph now emits | **No** (depends on row 2's node types, which do not exist). | CONFLICT — `archive/lesson-loop-g0-k:tests/structural/57-criterion-keys.mjs`. Not a logic collision: `main` already uses the number 57 for an unrelated suite (`57-derivation-boundaries.mjs`, confirmed inside the `97af8a2` conflict hunk, row 6) — a number collision, not competing content. | none numbered |
| 4 | `12a38ef` | docs(design): record the harvest verb, ten fact tables and the kernel's real subcommands | **No**, and stale where it would apply — see doc-risk note below. | **CLEAN** (3 files, 13 insertions / 10 deletions). | HD-022 (named doc-touching commit) |
| 5 | `a40d359` | docs(schema): say that nothing checks `traces_to` yet | **No.** `main`'s three `traces_to` descriptions in `domain.schema.json` are still byte-identical to this commit's "before" text — confirmed at all three call sites (findings, criterion-verdict ×2) — still say *"trace-lint only checks the id resolves in the registry,"* which nothing does. | **CLEAN** (1 file, 3/3). | none numbered — HD-022 discusses doc-touching risk generically but does not name this commit |
| 6 | `97af8a2` | fix(spec): lint every scope contract against the schema `compile` applies | **Yes, independently, by a different route.** `9a8641e` (`fix(spec-lint): a contract that parses but fails its schema is red at the gate`, already on `main`) adds `export function lintContractSchema(contracts, domainSchema)` at `kernel/verify/spec.mjs:756`, wired in as `rule: "CONTRACT-SCHEMA"`. Verified by execution: `git grep lintContractSchema main` finds it; `git grep contractsFailingSchema main` — the symbol name an earlier draft of this table used — finds **nothing**, on `main` or on the tag. | CONFLICT — `kernel/lib/contract.mjs`, `kernel/verify/spec.mjs`, `tests/structural.mjs`. **Re-attributed by hunk inspection, not by proximity:** the `contract.mjs` conflict's `main`-side text is `7f9db51`'s (`fix(contract): a table field declared in frontmatter too is reported, not dropped`) `FRONTMATTER_COPY` block verbatim — `9a8641e` never touches `contract.mjs` at all (`git show --stat 9a8641e` = `kernel/verify/spec.mjs` + `tests/structural/46-contract-md.mjs` only; `git log --oneline e511b7e..main -- kernel/lib/contract.mjs` = `531c9ed`, `7f9db51`, `b49d24d`). The `spec.mjs` conflict genuinely is against `9a8641e`'s own addition, `...lintContractSchema(contracts, domainSchema),`. `tests/structural.mjs` conflicts on the same registration-list region both sides add numbered suites to (56–59 exist on `main`; this commit adds its own 56–58). | closed independently by `9a8641e` |
| 7 | `6e6b4c8` | fix(resume): count a planning phase only once its dispatch has answered | **No.** No `unanswered_phases`, no `kernel/lib/orders.mjs`. `hooks/sandbox-guard.mjs` still owns `answered()`/`pastItsPhase()` itself, unmoved. | CONFLICT — `hooks/sandbox-guard.mjs`. Real collision, not stacking: `f9310f2` (`fix(hooks): a frozen path stays frozen inside the run trace`) independently touched the exact function region this commit tries to extract, after `e511b7e`. | none numbered |
| 8 | `8673baa` | fix(build): hold a scope whose dependency never reached a worker | **No.** No "undispatched" scheduling state in `skills/tech-lead/workflows/shapeup-run.js` (`grep -n "undispatched"` — no hits). | CONFLICT — `skills/tech-lead/workflows/shapeup-run.js`. Not resolved to a specific named collision here (the file is under heavy independent development on `main`, including `9106bc8`'s requirements dispatch); flagged as an "improvement whose premise needs re-checking," per the register, rather than a clean port. | none numbered (register: needs re-check against 3.4.0's round-loop rewrite) |
| 9 | `5574f0c` | fix(eval): send the judge only a round in which every scope is t0-green | **No.** No "not gradeable" round-skip in `shapeup-run.js`; only the unconditional `--no-eval` skip exists. | **CLEAN** (4 files, 33/2). | none numbered (register: needs re-check) |
| 10 | `6301eca` | fix(report): append the run graph at every close | **No.** `main`'s actual Ship sequence is `report export` **then** `setRunStatus("shipped")` — the opposite order from a unified close-out, and there is no `harvest` step to include (row 1 is absent). | CONFLICT — `skills/tech-lead/references/gates.md`, `shapeup-run.js`, `archive/lesson-loop-g0-k:tests/structural/56-run-close.mjs`. The test-file conflict is a second instance of the 56–59 number range (row 6): `main` already has `56-hook-decision-table.mjs`. | HD-011 (closes in full, together with row 1) |
| 11 | `ea77675` | fix(init): let a headless session read the plugin's own files | **No**, and self-superseded within the tag itself — rows 15–16, four and five commits later on the same branch (`ea77675` is position 11, `b0f9284` position 15, `bc8b68b` position 16, in `git log --reverse --oneline e511b7e..archive/lesson-loop-g0-k`), remove exactly the Read grant this one adds. `main` took neither of the tag's own two positions; see row 16. | **CLEAN** (8 files, 118/18). | superseded before it would matter — see rows 15–16 |
| 12 | `0ffc133` | docs(changelog): record the fixes a real consumer run exposed | **No**, in substance: it is a changelog entry *describing* fixes — its seven bullets describe rows 6 and 13 (CONTRACT-SCHEMA + the affordance list cell), 8, 7, 9, 10, 11 and 5, in that order, and never mention row 14 (`git show 0ffc133`, grepped separately for `hvigor` and for `arkts`, hits neither) — that are themselves mostly not on `main` (only row 6's outcome is). Porting the text alone would misdescribe what shipped. | **CLEAN** (1 file, 28 insertions — pure append, no revert risk; see doc-risk note). | HD-022 (named doc-touching commit) |
| 13 | `383a4c4` | fix(contract): read a yaml block scalar in a contract's frontmatter | **No.** No block-scalar/chomping logic in `kernel/lib/contract.mjs`; the only hits for "literal"/"folded" there are unrelated English prose in comments. | CONFLICT — `CHANGELOG.md`, `archive/lesson-loop-g0-k:tests/structural/58-contract-parity.mjs`. Second instance of the 56–59 number collision (rows 6, 10): `main` already has `58-relaunch-memory.mjs`. | the "YAML block-scalar reader," named but not numbered in HD-022 |
| 14 | `9da0f14` | fix(digest): read hvigor and arkts output in the t0 digester | **No** — confirmed directly by execution; see re-derivation above. | CONFLICT — `CHANGELOG.md` only. Pure append-position conflict, not a logic collision. | HD-016 (closes the unrecognised-output half only — see re-derivation above) |
| 15 | `b0f9284` | fix(init): stop granting a read of the plugin's own install | **No**, and `main` didn't take this commit's position either. This commit's own end-state is "no grant, but an `ADVISED_READ_RULE` string naming `~/.claude/plugins/cache/*/<plugin>/**`." `main` has neither the grant (confirmed absent from `bin/lib/grant.mjs`) nor that advised string (confirmed absent from `AGENTS.md`, `README.md`, `docs/install.md`, `docs/upgrading.md`, `.claude/settings.local.example.json`). | CONFLICT — `.claude/settings.local.example.json`, `AGENTS.md`, `CHANGELOG.md`, `bin/lib/grant.mjs`, `tests/grant/executing-grant.mjs`, `tests/grant/last-verified.json`, `tests/structural/14-invocation-paths.mjs`. | "the permission-grant correction" HD-022 references generically — no number |
| 16 | `bc8b68b` | fix(init): state the unattended read cost without naming a path | **The outcome is on `main`; the text is not.** `AGENTS.md:69` states the same consequence this commit states — a headless run gets the deterministic entry points and nothing else, and a real unattended run needs a Claude Code permission mode on top — **without** naming the cache path, matching this commit's stance. But it is not this commit's sentences: no `ADVISED_READ_RULE`, no matching text in `README.md`/`docs/install.md`/`docs/upgrading.md`, and no structural guard specifically forbidding a hard-coded cache path was found — `grep -rln "plugins/cache" tests/structural/` returns **zero** files; the only related hits in that directory are for the unrelated `${CLAUDE_PLUGIN_ROOT}` templating token (six files, all pre-existing invocation-path checks, not a guard against a literal cache path). **HD-022's "arrived by another route" is confirmed true in outcome, and confirmed not a byte-identical port.** | CONFLICT — `.claude/settings.local.example.json`, `CHANGELOG.md`, `README.md`, `bin/init.mjs`, `bin/lib/grant.mjs`, `docs/install.md`, `docs/upgrading.md`, `tests/grant/executing-grant.mjs`, `tests/grant/last-verified.json`, `tests/structural/14-invocation-paths.mjs`. | same as row 15 — already resolved in spirit on `main` |
| 17 | `dd028ae` | fix(skills): say when a reference could not be read | **No.** No "declare an unreadable reference" line in any `skills/*/SKILL.md`. Its own payload also amends `shapeup/knowledge-base/harness-defects.md` (39 insertions, an open Betting-Table question) — that filing is **not** in the current register either, so porting this commit would reintroduce a filing the register lost, not merely a code change. | **CLEAN** (5 files, 44 insertions). | none numbered — files its own (currently absent) register entry |
| 18 | `a5ce8af` | fix(t0): score an attempt by the failures in its own substrate | **No.** `kernel/verify/t0.mjs`'s `score()` (line 186) still returns only `regressions`, `fixtures_passed`, `fixtures_total`, `db_probe` — no `own_errors` field anywhere. | **CLEAN** (4 files, 195/6). | HD-016 — **this is the commit the register calls the weld.** Porting it *makes HD-016 worse*, not better, unless a digester fix for the missing-line-number case lands first — the register's own `harness-defects.md:159` closing line for HD-016 says so directly: "Sequenced before `a5ce8af`, never after." |
| 19 | `96f6c89` | test(invariants): check run-state propositions without a live run | **No.** `archive/lesson-loop-g0-k:tests/invariants.mjs`, `tests/invariants/`, `archive/lesson-loop-g0-k:tests/lib/scenario.mjs` do not exist on `main`. | CONFLICT — `package.json` only, and trivially so: the entire hunk is the version line (`3.3.0` → `3.5.0`, plus a literal-vs-unicode-escape difference in the description string). Not a logic collision. | scaffolding only — no direct closure |
| 20 | `db92a76` | fix(invariants): read the exporter's own answered field, cover the open-run branch | **No** (depends on row 19's scaffolding, absent). | CONFLICT — `archive/lesson-loop-g0-k:tests/invariants/L-closed-run-has-no-live-dispatch.mjs` (the file does not exist without row 19 first). | scaffolding only |
| 21 | `b5f3d0a` | test(invariants): add J, K and I2, and stop miscounting stateless ones | **No** (depends on rows 19–20). | CONFLICT — `archive/lesson-loop-g0-k:tests/invariants.mjs` (same dependency). | surfaces HD-015 as a **test**, does not fix it (see note below); documents the deliberate decision *not* to add an invariant for HD-016's `own_errors` boundary |
| 22 | `29cf0be` | feat(export): carry a run's gate decisions, and query them as an invariant | **No.** `kernel/report/facts.mjs:27-30` `TABLES` still has exactly the same nine entries HD-019 was filed against (`run, dispatch, ac_result, discovery, file_touched, trial, t0_verdict, criterion_verdict, hook_decision`) — no `gate` table. (`resolveAbandonedOrders()`, which this commit's message discusses, already exists on `main` at `kernel/init/run.mjs:270` — independently, from a commit that predates and is outside this 22-commit set; it is not part of this commit's own diff.) | CONFLICT — `kernel/report/export.mjs`, `kernel/report/facts.mjs`, `archive/lesson-loop-g0-k:tests/invariants.mjs`, three `tests/invariants/*` files, `archive/lesson-loop-g0-k:tests/lib/scenario.mjs` (depends on rows 19–21 for the test-side files; `export.mjs`/`facts.mjs` conflicts are against `main`'s own independent evolution of those files). | HD-019 (closes the export-table half only — not the L0/L4/COACH-1 rows) |

## Doc-risk: what 3.5.0 rewrote underneath the doc-touching commits

The register's HD-022 text names three commits generically at risk of reverting 3.5.0 prose:
`01aea8f`, `0ffc133`, `12a38ef`. A fourth, `a40d359`, also touches doc-shaped content (schema
`description` strings) but isn't named. Re-derived per file, not asserted as a set:

| file | touched since `e511b7e` by | net diff-lines `e511b7e→main` (excl. `a`/`b` headers) | would the named commit revert it? |
|---|---|---|---|
| `docs/design/03-system-design.md` | `892b9b5` (3.5.0), `aed53b9` (docs audit) | 17 | **No.** Main's only post-`e511b7e` hunks in this file are `@@ -68,7 +68,7 @@` (`aed53b9`, 15→17 operations) and `@@ -458,6 +458,21 @@` (`892b9b5`, a pure +15-line insertion); `12a38ef`'s hunks are `@@ -380,9 +380,10 @@` and `@@ -391,7 +392,7 @@`, and the two lines it removes blame to `c5ec50f0` (2026-08-13) and `ebf9f6a4` (2026-08-21) — both ancestors of `e511b7e`, so neither is 3.5.0 text. |
| `docs/design/06-appendix.md` | *(none)* | 0 — byte-identical, md5 `1c40cc12ade385c26ecffe89abfa3649` at both `e511b7e` and `main` | No file-level revert (nothing else touched it) — but see the sharpest loss, below. |
| `docs/design/07-domain-erd.md` | `aed53b9` only | 2 | **No.** Two disjoint regions: `aed53b9` edits line 68 (the operation count, 15→17); `12a38ef` edits line 245 (the `MetricsRow` row), which blames to `4b8b3539` — an ancestor of `e511b7e`, pre-tag. The isolated trial applies **CLEAN**, zero conflicted files. |
| `AGENTS.md` (the two bullets `01aea8f` edits) | `892b9b5` | 0 on those two bullets specifically — the isolated trial applied **clean**, meaning `892b9b5` never touched the same lines | No. |
| `CHANGELOG.md` (`0ffc133`, and `01aea8f`'s entry) | continuously, by every release since | n/a — append-only file, conflicts are position, not content | No — a changelog conflict is not a revert. |
| `domain.schema.json` `traces_to` descriptions (`a40d359`) | *(none)* — confirmed byte-identical to the "before" state at all three sites | 0 | No — nothing has touched this text since the tag's base, which is also why it is still wrong on `main` today. |

**Conclusion, stated once:** **ZERO** of HD-022's three named doc-touching commits reverts any text
`3.5.0` shipped. `01aea8f` and `0ffc133` apply clean with no collision on any line `3.5.0` touched.
`12a38ef` also applies clean, and by execution touches no region `3.5.0` has rewritten either: the
two lines it removes both predate the tag base (`c5ec50f0`, 2026-08-13; `ebf9f6a4`, 2026-08-21 —
see the `03-system-design.md` row above) and its `07-domain-erd.md` edit lands on a pre-tag line
(`4b8b3539`) that `aed53b9` never touched. `a40d359`, a fourth doc-shaped commit the register
doesn't name, carries no revert risk either, for the same underlying reason: nothing has rewritten
its target text — which is also why that text is still wrong on `main` right now, independent of any
porting decision. This resolves the two ways the brief text could be read (a "two" count from the
register's own already-corrected-claims section and a "three" count naming HD-022's set are
different things) by naming exactly one number for exactly one set: **zero of HD-022's three named
commits is a revert risk.**

`12a38ef`'s real cost, demonstrated by execution below, is not a revert — it is content loss and
content falsification, and both survive a clean, zero-conflict apply precisely because nothing else
touched the same lines. It silently drops two entries true on `main` (`verify ratchet-tree`,
`reduce leftovers`) and silently introduces entries false on `main` (`report harvest`, `lib kb`,
`lib spec-ids` — none exist; a `MetricsRow` row retyped `LOCAL` with a writer, `harness report
harvest`, that does not exist either), and states `ten` fact tables where `main`'s `TABLES` constant
has nine (`kernel/report/facts.mjs:27-30`). This is the correction HD-022's "confirmed revert risk"
framing should be read against: the risk in porting `12a38ef` as written is real, but it runs in the
opposite direction from a revert — a reader who trusts the merged doc is misled about what exists on
`main` today, not shown text `3.5.0` already superseded.

**The sharpest loss is in the file with *no* revert conflict.** Applying `12a38ef` cleanly (verified
by actually running the cherry-pick, not just reading the commit) drops **`verify ratchet-tree`**
(`kernel/verify/ratchet-tree.mjs` exists on `main`) and **`reduce leftovers`**
(`kernel/reduce/leftovers.mjs` exists on `main`) from `06-appendix.md`'s subcommand tree, and adds
**`report harvest`**, **`lib kb`** and **`lib spec-ids`**, none of which exist on `main`
(`kernel/report/harvest.mjs`, `kernel/lib/kb.mjs`, `kernel/lib/spec-ids.mjs` — confirmed absent by
`ls`). None of this shows up as a git conflict, because nothing else changed these exact lines — it
is silent content loss and silent content falsification, not a merge failure, which is why the
file-level "0 diff-lines, untouched" fact above is not the same claim as "safe to overwrite."

**Two corrections against earlier readings of this same evidence — the same mistake made in opposite
directions, reading a replacement line without checking what main actually has in the same slot.**

An earlier pass claimed `12a38ef` also drops `lib breadboard` "present on main." Re-run directly:
`main`'s **current** `lib/` line reads `argv · contract · paths` — it does **not** list `breadboard`,
even though `kernel/lib/breadboard.mjs` exists as a real file (confirmed: `ls kernel/lib/` lists
`argv.mjs breadboard.mjs contract.mjs paths.mjs`). `12a38ef`'s own replacement line reads
`argv · breadboard · contract · kb · paths · spec-ids` — it *has* `breadboard`. Applying it (verified
by executing the cherry-pick and reading the resulting file, not by comparing snapshots) **adds**
`breadboard` to the doc rather than dropping it; `main`'s doc is the one currently missing it,
independent of this tag.

A later pass claimed `12a38ef` drops `requirements` from the same appendix — the identical error, the
opposite direction. Re-run directly: `requirements` occurs nowhere in `main`'s `06-appendix.md`
(`git show main:docs/design/06-appendix.md | grep -i requirements` exits 1, and the file is
byte-identical between `e511b7e` and `main`, md5 `1c40cc12ade385c26ecffe89abfa3649` at both;
`9106bc8`, the 3.5.0 commit that added `kernel/probe/requirements.mjs`, never touched this file —
`git log --oneline e511b7e..main -- docs/design/06-appendix.md` is empty). `main`'s `probe` line
reads `resume · t0 · stats · digest`; `12a38ef`'s replacement, `resume · t0 · stats · digest ·
concurrency · leg · eval · owner`, adds four verbs and drops none. Both corrections are flagged as
re-derived, not silently carried forward — see `blocker` in the structured result for the same
evidence in one place.

## Order sensitivity

Four conflicts above are plausibly about stack order rather than a real collision with `main`.
Rather than assert that from position in the list, each was tested directly with a two-commit
pairwise cherry-pick (apply the earlier commit to a fresh `main` first, commit it, then trial the
later one), isolated trial style, worktree discarded after each:

- `a5ce8af` after `a40d359`: **CLEAN**.
- `a5ce8af` after `9da0f14`: **CLEAN**.
- `5574f0c` after `01aea8f`: **CLEAN**.
- `dd028ae` after `01aea8f`: **CLEAN**.

These four are genuinely order-sensitive-only conflicts inside the tag's own file-sharing (not
collisions with anything `main` did independently) — `a5ce8af` shares `domain.schema.json` with
rows 1, 2, 5, 7 and `tests/structural/05-tech-lead.mjs` with row 14; `5574f0c` shares `AGENTS.md`,
`gates.md` and `shapeup-run.js` with several rows; `dd028ae` shares `skills/tech-lead/SKILL.md` with
row 1, among others — but among the 22, `dd028ae` is the *sole* commit touching
`shapeup/knowledge-base/harness-defects.md` (confirmed: `git show --stat` on each of the other 21
finds no hit for that path). `main` touches that file only through its own four post-`e511b7e`
commits — `17f60be`, `7f9db51`, `3a1547f`, `ef8b43b` — none of which are in this 22-commit set. None
of the eleven rows above (6, 7, 8, 10, 13, 15, 16, 19, 20, 21, 22) were re-tested this way, because
their conflicts were already confirmed, by inspecting the actual hunk, to be against content `main`
added independently — not against another tag commit not yet applied. This is a narrower claim than
a full sequential replay:
it says these four specific pairs are order-only, not that the whole 22-commit stack applies
cleanly end to end, which was not attempted (see the scope note below).

**What this does not establish.** A true sequential trial — applying all 22 in order with hand
resolution at each real conflict, the way a port would actually be done — was not performed. Doing
that requires editorial judgement at every real-collision row above (2, 7, 8, 10, 15, 16, 22) that
is exactly the kind of choice this packet exists to leave to the PO rather than pre-bake. What is
established: which conflicts are pure order artifacts (the four pairs above) versus which are real
content collisions with independent `main` work (every other CONFLICT row, with its specific
colliding commit named where found).

The two enumerations just above partition the CONFLICT rows on different criteria and neither is
the complement of the other: the first names the rows re-tested against independently-added `main`
content, the second the rows whose collision is one of content. Rows 1, 3, 13 and 14 fall in a third
category the prose did not name — a conflict of *bookkeeping* rather than of logic: an append
position in `CHANGELOG.md`, a test-module number already taken on `main`, a registration list.
Those resolve mechanically and are called out per row rather than pooled here.
## What a port actually costs, restated at the right grain

An earlier reading of this evidence claimed rows 18 (`a5ce8af`), 9 (`5574f0c`) and 17 (`dd028ae`)
"touch no code any other commit here or on `main` has rewritten." False at file level — re-derived
directly:

- `a5ce8af` shares `skills/tech-lead/schemas/domain.schema.json` with rows 1, 2, 5 and 7, and
  `tests/structural/05-tech-lead.mjs` with row 14.
- `5574f0c` shares `AGENTS.md`, `skills/tech-lead/references/gates.md` and
  `skills/tech-lead/workflows/shapeup-run.js` with several other rows in this set.
- `dd028ae` shares `skills/tech-lead/SKILL.md` with row 1, among others. It is, among the 22, the
  sole commit touching `shapeup/knowledge-base/harness-defects.md` — the sharing on that file is with
  `main`'s own four post-`e511b7e` commits (`17f60be`, `7f9db51`, `3a1547f`, `ef8b43b`), not with row
  1 or any other row in this set.

What is true, verified by execution rather than by file-list inspection: **none of the three has a
consequence from that sharing.** `a5ce8af` cherry-picks CLEAN whether trialled after `a40d359` or
after `9da0f14` (Order sensitivity, above); `5574f0c` and `dd028ae` both cherry-pick CLEAN after
`01aea8f`. The correct claim is at the region level — these three touch no *region* any other row
or `main` has rewritten, which is a narrower and true statement, not the file-level one, which is
false and would mislead a reader checking it against `git log -- <file>` the way row 4's false claim
was caught.

## Register impact — every entry this set touches

- **HD-011** (abort at L3 leaves the trace reading as still running) — **closed in full** by rows 1
  + 10 together (harvest + `closed_at` stamping + close-out sequencing). Verified: the tag's
  `kernel/probe/resume.mjs:449 setRunStatus()` stamps `closed_at` for every status in
  `CLOSING_STATUSES`; `main`'s current `kernel/init/run.mjs:226` still writes the literal `~` once
  and nothing else updates it (matches HD-011's own citations exactly, still current).
- **HD-016** (locationless diagnostic loses its location; welds the ratchet under the branch's own
  scoring model) — **half-closed, half-worsened**. Row 14 (`9da0f14`) closes the unrecognised-output
  half by execution (re-derived above). Row 18 (`a5ce8af`) introduces the `own_errors` axis HD-016
  names as the weld mechanism — porting it alone, without a digester fix for the missing-line-number
  case, is what turns "no signal" into "a welded ratchet." The register's own closing line for
  HD-016 ("Sequenced before `a5ce8af`, never after," `harness-defects.md:159`) is the answer to this
  ordering already on record, not a new one filed here.
- **HD-019** (three of ten gates never resolved; no gate data in the export) — **half-closed** by
  row 22: the `gate` fact table, if ported, would exist; the L0/L4/COACH-1 `crossGate` call sites it
  is missing are untouched by any of the 22 commits (confirmed: no commit diff among the
  22 ADDS, REMOVES or MODIFIES a `crossGate` call site, and none of the seven unchanged context
  occurrences in `01aea8f` is L0, L4 or COACH-1 — they are L1a, L1a.5, L1b, L2, L3, QA and H).
- **HD-015** (ownership disagreement; a shared-only path reports `unowned`) — **not fixed**. Row 21
  adds a regression *test* for the exact symptom HD-015 describes (the J finding in its own commit
  message), but no commit in this set touches `kernel/probe/owner.mjs`, which is where HD-015's fix
  would live. Filing a test for an unfixed defect does not close it.
- **HD-010, HD-012, HD-014, HD-017, HD-018, HD-020, HD-021** — **untouched** by any of the 22.
  (HD-010: no commit in this set touches `kernel/verify/budget.mjs` or the `budgets`/`wallClockS`
  RunArgs field in `shapeup-run.js`; grepping all 22 diffs for `wallClockS` — the exact field name —
  returns nothing. HD-018 in particular: the tag's own `kernel/report/harvest.mjs:161` calls the
  *same* `roundsUsed()` from `kernel/reduce/ship.mjs`, imported directly — confirmed by reading the
  tag's source — so porting the close-out machinery adds a second consumer of HD-018's defect rather
  than fixing it.)
- **HD-013, HD-023, HD-024, HD-025** — out of this tag's scope entirely (no commit here touches
  them); unaffected either way.
- The scope-contract schema gap and the YAML block-scalar reader (rows 6, 13) were never filed as
  their own numbered HD entries — they are named only inside HD-022's own prose. Row 6's gap is
  independently closed (`9a8641e`). Row 13's is not.
- `dd028ae` (row 17) would, if ported, reintroduce a Betting-Table filing (the "how does a worker
  keep its craft when a reference is unreadable" open question) that the current register does not
  carry under any heading searched (`unreadable`, `deferred reference`, `references are
  unreachable`, `SKILL.md carrying`).

## Things this packet does not decide

- Whether to port, cherry-pick a subset, or abandon the tag. **That is the PO's call.**
- Whether HD-016's sequencing gate ("`a5ce8af` must not land before a genuine location-losing fix")
  should bind — verified here only that its two factual supports hold (row 14 does not fix the
  missing-line-number case; row 18 is the only own_errors source in this set), not whether the gate
  itself is the right policy.
- Any code fix. Nothing outside this new file was edited to produce this packet.

---

*Method addendum: isolated trials ran against `git worktree add --detach <scratchpad>/wt-main main`
(HEAD `78d3c6e`), cherry-picking each of the 22 shas with `-n`, recording the result, then
`git cherry-pick --abort && git reset --hard main && git clean -fd` before the next trial. The
worktree was removed after use. `npm test` was not run for this stage — no code changed —
`test_count_after` is reported as `-1` in the structured result, per the brief.*
