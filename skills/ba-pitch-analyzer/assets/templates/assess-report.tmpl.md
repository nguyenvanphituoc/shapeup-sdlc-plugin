---
type: assess-report
feature: FEATURE_SLUG
generated_at: YYYY-MM-DD
pitch_hash: HASH
skill_version: "2.5"
l0_preview_score: 0
codebase_confidence: 0
recommended_lens: lite | standard
proceed: go | go+fix | no-go
multi_context_detected: false
---

# Assess Report: FEATURE TITLE

> **Read Decision Summary only — open sections below if you need to know why.**

---

## ⚡ Decision Summary

```
Recommended lens : LENS
Estimated tokens : ~MIN–MAX tokens
Estimated cost   : ~$MIN–$MAX
Input quality    : SCORE/100
Codebase fit     : CONFIDENCE%
Proceed?         : PROCEED_STATUS
```

---

## Input Quality (L0 Preview)

Score: SCORE/100 — STATUS

| Check | Result | Note |
|-------|--------|------|
| Appetite stated | ✅ / ❌ | value |
| In-scope boundaries (≥ 2) | ✅ / ❌ | count found |
| Non-go list (≥ 1) | ✅ / ❌ | count found |
| Rabbit hole identified | ✅ / ❌ | — |
| Rabbit hole has mitigation | ✅ / ❌ | — |
| Third-party declared (if any) | ✅ / ❌ / N/A | — |

**Fix list** *(only present when proceed = go+fix or no-go):*
- [ ] [issue] — [actionable suggestion]
- [ ] [issue] — [actionable suggestion]

---

## Codebase Fit

Confidence: CONFIDENCE%

| Signal | Found | Weight |
|--------|-------|--------|
| CLAUDE.md readable | ✅ / ❌ | +25 |
| Schema pattern (*.schema.ts) | ✅ / ❌ | +25 |
| Repository layer | ✅ / ❌ | +25 |
| Monorepo structure clear | ✅ / ❌ | +15 |
| Test pattern consistent | ✅ / ❌ | +10 |

**Warnings** *(if any):*
- ⚠️ [what was not found] → [recommendation]

---

## Estimated Output

```
Lens          : LENS
Documents     : N files
Use Cases     : ~N UCs (estimated)
Tasks         : ~N–N tasks
SPIKE tasks   : N (third-party APIs detected: [list])
```

<!-- MULTI-CONTEXT BLOCK — include only when multi_context_detected: true -->
## ⚠️ Multi-Context Detected

This pitch touches N bounded contexts: [context-a], [context-b], [context-c]

**Option A — Single standard run** *(faster, boundaries may be blurry)*
```bash
/ba-pitch-analyzer --lens standard docs/pitch.md
```
Estimated tokens: ~N tokens

**Option B — Split + cross-context** *(slower, precise boundaries)*
```bash
/ba-pitch-analyzer --lens standard docs/pitch-[context-a].md
/ba-pitch-analyzer --lens standard docs/pitch-[context-b].md
/ba-pitch-analyzer --cross-context FEATURE_SLUG \
    docs/shapeup-sdlc/[context-a]/spec/ \
    docs/shapeup-sdlc/[context-b]/spec/
```
Estimated tokens: ~N total (reusable per context)

Choose: **[A]** or **[B]**
<!-- END MULTI-CONTEXT BLOCK -->

---

## Lens Options

| Lens | Tokens | Cost | Recommended |
|------|--------|------|-------------|
| `--lens lite` | ~6,000–8,000 | ~$0.03–$0.04 | [✅ if applicable] |
| `--lens standard` | ~14,000–22,000 | ~$0.07–$0.11 | [✅ if applicable] |
| `--cross-context` | ~N | ~$N | [✅ if applicable] |

---

## Next Steps

```bash
# Proceed with recommended lens
/ba-pitch-analyzer --lens LENS docs/pitch.md

# Override lens
/ba-pitch-analyzer --lens lite docs/pitch.md
/ba-pitch-analyzer --lens standard docs/pitch.md

# Skip assess on next run (pitch already reviewed)
/ba-pitch-analyzer --lens LENS --skip-assess docs/pitch.md
```
