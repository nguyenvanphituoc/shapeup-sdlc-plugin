---
name: translator
description: "Use this skill whenever intake for the harness (pitch, PRD, requirement, transcript, or any spec input) is in a non-English language and must be normalized to English BEFORE planning/building. The single language gate for the planner→generator→judge harness — downstream skills (ba-pitch-analyzer, task-executor, spec-evaluator) are English-only and HARD-FAIL otherwise. Triggers on: \"translate this pitch\", \"normalize to English\", \"this requirement is in Vietnamese\", \"prepare intake for the harness\", \"make the spec English\", \"check if this is English\", and Vietnamese \"dịch sang tiếng Anh\", \"chuẩn hoá tiếng Anh\", \"dịch pitch\", \"chuyển yêu cầu sang tiếng Anh\". Input-normalization only: translates source docs into faithful English copies (original never overwritten) plus a persisted glossary and verification report. Does NOT plan, build, judge, or translate harness output back. tech-lead auto-invokes it at GATE L0 when intake is non-English; also runs standalone."
---

# Translator (harness language gate)

The one job upstream of the whole harness: **make the input English, faithfully, once.**
The harness is English-only end to end — the planner, generator, and judge all assume
English and HARD-FAIL on anything else. This skill is the single component that guarantees
that assumption holds. It is **not** a translator that rewrites; it normalizes language
while preserving every requirement, number, boundary, and structural element 1:1.

```
PO writes intake (any language)  →  TRANSLATOR  →  <name>.en.md (English)  →  ba-pitch-analyzer → …
                                    (this skill)     + glossary.md + report
```

**Scope is deliberately narrow (simplicity first):**
- ✅ Translate **input** docs (pitch / PRD / requirement / transcript) into English copies.
- ✅ Emit a persisted **glossary** so domain terms map consistently across docs and runs.
- ✅ **Verify** the output is English and structurally identical to the source.
- 🚫 Does NOT plan, build, or judge — that is the harness's job.
- 🚫 Does NOT translate harness **output** back to the PO's language (input-normalization only).
- 🚫 Does NOT summarize, add, drop, or "improve" content — faithful 1:1 only.

> **What is preserved verbatim vs translated, glossary protocol, verification scan**
> → `references/preservation-rules.md` — read it before translating any file.

---

## Workflow Overview

```
INPUT: doc(s) in any language
          │
⏸ GATE T0 │  Detect & Scope ──────► per-file source-language detection; list files to
          │                        translate; already-English files → skipped (idempotent)
          │
▶ Phase 1 │  Glossary ────────────► extract domain terms + proper nouns + do-not-translate
          │                        tokens; map source→English; reuse existing glossary.md
⏸ GATE T1 │  Glossary Review ──────► PO confirms term mappings; ambiguous terms resolved here
          │                        (never guessed). lite/auto: auto-proceed on unambiguous.
          │
▶ Phase 2 │  Translate ───────────► WRITE <name>.en.md (original untouched): prose → English,
          │                        glossary applied; frontmatter keys, wikilinks, code, URLs,
          │                        numbers preserved
          │
▶ Phase 3 │  Verify ──────────────► residual-non-English scan + structural diff (heading /
          │                        link / code-block / list-item counts must match source)
⏸ GATE T2 │  Output Sign-off ──────► confirm clean scan + matching structure, then emit
          │                        glossary.md + translation-report.md (the .en.md is already
          │                        written in Phase 2)
✅ Done   └─► English intake ready for the harness
```

---

## GATE T0 — Detect & Scope

**Purpose:** Decide what needs translating before spending tokens, and stay idempotent.

```
T0.1  For each input file/path, detect source language (sample headings + body prose,
      ignore code blocks / identifiers / URLs).
T0.2  Classify:
        already-English  → SKIP (no .en.md written; report it as pass-through)
        non-English      → queue for translation
        mixed            → queue; flag the English spans to keep verbatim
T0.3  In --check mode: print the classification table and STOP. Write nothing.
      (This is the mode tech-lead calls at GATE L0 to decide whether to run a full pass.)
```

**GATE T0 Output:**
```
⏸ GATE T0 — Detect & Scope
Files        : [N]   (translate: [k]  ·  already-English: [N-k])
Source lang  : [vi | mixed | …]
Glossary     : [reuse docs/glossary.md | build new]
Mode         : [full | --check (detect only)]
```
Under `--check`: stop here. Otherwise proceed to Phase 1 (auto) or wait for confirm (interactive).

---

## Phase 1 — Glossary

**Goal:** One consistent English term per source term, across every doc and every run.
Inconsistent vocabulary is the failure that poisons downstream DDD extraction (the planner
treats two spellings as two concepts). Read `references/preservation-rules.md#Glossary` first.

```
1. Reuse: if a glossary.md exists (or --glossary <path> given), load it as the base map.
2. Extract from the source: domain nouns, actor names, status/enum values, screen names,
   feature jargon. Propose source→English for each new term.
3. Mark do-not-translate tokens: proper nouns, brand/product names, code identifiers, API
   names, env vars, file paths — these pass through verbatim (see preservation-rules).
4. Flag ambiguous terms (one source word → multiple valid English terms) for GATE T1.
```

**Output:** draft `glossary.md` (source term · English · note/do-not-translate flag).

---

## GATE T1 — Glossary Review

**Purpose:** Lock vocabulary with the PO before it propagates into every translated doc.

```
Print the new/changed term rows + any ambiguous terms.
Ask (max 2): confirm the English term for each ambiguous entry; any term to force
verbatim (do-not-translate)?
```
Never guess an ambiguous domain term — a wrong canonical term cascades into the spec.
`--auto` / `--lite`: auto-proceed when no term is ambiguous; if any is, still pause (a
wrong term is more expensive than a pause).

---

## Phase 2 — Translate

**Goal:** Faithful English copy. Read `references/preservation-rules.md` first.

```
For each queued file, write <name>.en.md (sibling of the source; original untouched):
  - Translate prose values only. Apply the glossary to every domain term.
  - PRESERVE verbatim: YAML frontmatter KEYS, [[wikilink]] targets, `code`/```fenced```,
    URLs, file paths, numbers, units, appetite/boundary values, do-not-translate tokens.
  - Keep document structure 1:1: same headings, same table rows, same list items, same
    order. No merging, no reordering, no summarizing.
  - Mixed-language source: leave already-English spans as they are.
```
Faithfulness rule: the `.en.md` must carry exactly the requirements of the source — nothing
added, nothing dropped, no editorializing. Translation ≠ rewriting.

---

## Phase 3 — Verify

**Goal:** Prove the output is English and structurally identical before sign-off.

```
3.1  Residual-non-English scan: scan every .en.md for source-language characters/words
     outside code blocks / do-not-translate tokens. Any hit → list file:line, do NOT pass.
3.2  Structural diff vs source: heading count, table-row count, list-item count, wikilink
     count, code-block count must match. Mismatch → a requirement was dropped/added → fail.
3.3  Glossary coverage: every extracted term resolved (no "⏳ TBD" left in glossary.md).
```
A failing scan blocks GATE T2 — emit the residual list and fix before signing off.

---

## GATE T2 — Output Sign-off

```
⏸ GATE T2 — Output Sign-off
Translated   : [k] files → <name>.en.md
Glossary     : glossary.md ([t] terms, [a] resolved-ambiguous)
Residual scan: ✅ clean | 🔴 [n] non-English spans → [file:line …]
Structure    : ✅ matches source | 🔴 [diff]
```
On clean → `✅ Intake English-ready: [files]. Point the harness at the .en.md copies.`
Under `--auto`/`--unattended`: auto-sign-off only if the residual scan is clean; a dirty
scan always stops (never ship half-translated intake to the harness).

---

## Output files

| File | Purpose | Notes |
|------|---------|-------|
| `<name>.en.md` | The English copy the harness consumes | One per translated source; **original is never overwritten** |
| `glossary.md` | source→English term map | Persisted + reused; the shared vocabulary for this feature |
| `translation-report.md` | detect table, glossary diff, verification result | Audit trail; what was skipped/flagged |

---

## Invocation

```bash
# Translate one intake file → docs/pitch.en.md (+ glossary.md, translation-report.md)
/translator docs/pitch.md

# Translate a folder of intake docs (already-English files are skipped)
/translator docs/intake/

# Reuse / extend an existing glossary for consistent vocabulary across runs
/translator --glossary docs/glossary.md docs/pitch.md

# Detect-only: is this English? print the table and stop (what tech-lead L0 calls)
/translator --check docs/pitch.md

# Headless: skip gates; still HARD-STOPS on a dirty residual scan
/translator --auto docs/pitch.md
```

### Flags
| Flag | Effect |
|------|--------|
| `--check` | Detect source language and report; write nothing, stop at GATE T0 |
| `--glossary <path>` | Load an existing glossary as the base map (consistency across docs/runs) |
| `--auto` | Skip T0/T1 confirmation gates; still pauses on ambiguous terms + dirty scan |
| `--unattended` | Auto-sign-off all gates; stop only on a dirty residual scan or hard error |
| `--out <dir>` | Write `.en.md` copies into a target dir instead of beside the source |

---

## Hard Rules (never override without explicit user instruction)

| Rule | Rationale |
|------|-----------|
| Never overwrite the source; always write a `.en.md` copy | The PO still needs to read their original |
| Never summarize, add, or drop content — faithful 1:1 | The harness builds exactly what the spec says; drift here is silent scope change |
| Preserve frontmatter keys, wikilink targets, code, URLs, numbers verbatim | Structure is load-bearing for downstream parsing; translating it breaks the spec tree |
| One source term → one English term, via the glossary | Two spellings read as two concepts to the planner's DDD pass |
| Ambiguous term → ask at GATE T1, never guess | A wrong canonical term cascades into every doc and every build round |
| Already-English input → no-op (idempotent) | Re-runs and `--check` must be safe and cheap |
| Dirty residual scan blocks sign-off, even under `--auto` | Half-translated intake makes the harness HARD-FAIL mid-run — worse than stopping here |
| Input-normalization only — never translate harness output back | This is the upstream gate; output language is a separate, out-of-scope concern |

---

## Relationship to the harness

```
TRANSLATOR (this skill)  →  ba-pitch-analyzer (PLAN)  →  task-executor (BUILD)  →  spec-evaluator (JUDGE)
   language gate                 English-only specs        English-only code         English-only verdict
```
- The harness is **English-only end to end**; the downstream skills HARD-FAIL on non-English.
- `tech-lead` does **not** translate — at GATE L0 it runs `/translator --check`, and if intake
  is non-English it runs a full `/translator` pass first, then orchestrates against the `.en.md`
  copies. Orchestration and language normalization are separate single-purpose concerns.

---

## Changelog
| Version | Date | Changes |
|---------|------|---------|
| 0.1 | 2026-06-10 | Initial language gate split out of tech-lead. Input-normalization only: detect (T0) → glossary (T1) → translate (T2 prep) → verify → sign-off. Strict English-only policy for the whole harness; faithful 1:1 with structure/frontmatter/wikilink/code/number preservation; persisted reusable glossary; idempotent already-English no-op; `--check` mode for tech-lead's GATE L0; residual-non-English scan blocks sign-off even under --auto. |
