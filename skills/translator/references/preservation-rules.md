# Preservation Rules

What the translator touches, what it must never touch, and how it proves the result.
Read this before translating any file. The governing principle: **translate meaning,
preserve everything that machines parse.** A `.en.md` that reads well but breaks the spec
tree's wikilinks or drops a table row is a failed translation.

---

## 1. Translate vs preserve verbatim

| Element | Action | Why |
|---------|--------|-----|
| Prose, headings (text), table cell text, list items | **Translate** | The human-readable content the harness reasons over |
| YAML frontmatter **keys** (`appetite:`, `lens:`, `feature:`) | **Preserve** | Parsed by downstream skills; translating a key breaks the schema |
| YAML frontmatter **values** that are prose | Translate | e.g. a description value |
| YAML frontmatter **values** that are enums/slugs/IDs (`lens: standard`, `feature: checkout-vnpay`) | **Preserve** | Machine-matched; must stay byte-identical |
| `[[wikilink]]` targets | **Preserve** | They resolve to filenames; translating breaks the graph. (A wikilink *alias* shown to humans may be translated: `[[UC-Login\|đăng nhập]]` → `[[UC-Login\|log in]]`) |
| `` `inline code` `` and ```` ```fenced``` ```` blocks | **Preserve** | Code, identifiers, commands — not natural language |
| Code identifiers, type names, API names, env vars, file paths | **Preserve** | `UserRepository`, `VNPAY_SECRET`, `src/modules/canvas/` stay as-is |
| URLs | **Preserve** | Links, not prose |
| Numbers, units, currency, dates, appetite/boundary values | **Preserve** | `~3 tuần` → translate the unit word only if prose (`~3 weeks`); never alter the number |
| Proper nouns / brand / product names | **Preserve** (unless an established English name exists) | VNPAY, Supabase, ReactFlow |

**Mixed-language source:** leave already-English spans exactly as written. Do not
"re-translate" English into different English.

---

## 2. Structure is 1:1

The `.en.md` must mirror the source's structure exactly:

- Same number of headings, at the same levels, in the same order.
- Same number of table rows and columns.
- Same number of list items and nesting.
- Same number of code blocks and wikilinks.
- No merging paragraphs, no reordering sections, no "tightening" prose.

Rationale: the planner extracts boundaries, rabbit holes, and breadboard elements
positionally and by count. Dropping or fusing items is silent scope change — the single
most dangerous failure mode of a translation step.

---

## 3. Glossary protocol

A `glossary.md` is the contract that keeps one source term mapped to one English term across
every doc and every run. Without it, "phiếu giảm giá" becomes "voucher" in one file and
"discount coupon" in another, and the planner's DDD pass sees two aggregates.

**Format** (`glossary.md`):

```markdown
# Glossary — <feature-slug>

| Source term | English | Note |
|-------------|---------|------|
| phiếu giảm giá | voucher | domain noun — aggregate candidate |
| người dùng | user | actor |
| VNPAY | VNPAY | do-not-translate (brand) |
| đơn hàng | order | domain noun |
```

**Rules:**
- Reuse an existing glossary (`--glossary <path>`) as the base — extend, don't replace.
- One source term → exactly one English term. If the source uses a term two ways, that is
  an **ambiguity** → resolve at GATE T1, then record both senses as distinct rows with notes.
- `do-not-translate` rows pin proper nouns / identifiers that must pass through verbatim.
- No `⏳ TBD` may remain at sign-off — every extracted term is resolved (Phase 3.3).

---

## 4. Verification scan (Phase 3)

Three checks, all must pass before GATE T2 sign-off:

1. **Residual-non-English scan.** Scan each `.en.md` for source-language characters or words
   *outside* code blocks and do-not-translate tokens. For Vietnamese: diacritic ranges
   (à á ả ã ạ â ầ … đ …) and common function words (và, của, người, là, được, …). Any hit →
   report `file:line` + the span. Does NOT pass with residuals.
2. **Structural diff vs source.** Compare counts: headings, table rows, list items,
   wikilinks, code blocks. Any mismatch → a requirement was added or dropped → fail.
3. **Glossary coverage.** Every term extracted in Phase 1 appears resolved in `glossary.md`.

A failing scan blocks sign-off even under `--auto`/`--unattended` — half-translated intake
makes the harness HARD-FAIL mid-run, which is worse and more expensive than stopping here.

---

## 5. Faithfulness (the non-negotiable)

Translation is **not** an editing pass. The `.en.md` carries exactly the requirements of the
source:

- ❌ Do not add clarifications, assumptions, or "missing" requirements (that is the planner's
  GATE 0 job, downstream).
- ❌ Do not drop content that seems redundant or unclear — translate it faithfully and let
  the planner flag it.
- ❌ Do not summarize or shorten.
- ✅ If a source sentence is genuinely ambiguous to translate, keep the most literal English
  rendering and note it in `translation-report.md` for the PO — never silently pick a meaning.
