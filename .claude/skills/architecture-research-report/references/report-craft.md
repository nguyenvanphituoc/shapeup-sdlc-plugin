# Report craft — house style

Contents:
1. The metadata block
2. §0 — the finding paragraph
3. Comparison tables that decide something
4. Citation discipline
5. The negative space section
6. Staged, costed recommendations
7. Falsifiers
8. Prose failures, with rewrites

---

## 1. The metadata block

Directly under the title, before §0. It exists so a reader six months later knows whether the
report is still valid — which is the question every old design doc fails to answer.

```markdown
**Question:** Do we move the RAG index off pgvector before the Q3 traffic step-up?
**Scope:** `services/search/**`, the ingest DAG. Excludes the ranking model.
**Sources:** repo @ `a3f91c2`; pgvector 0.8.0 release notes (2025-11); internal p99 dashboard
  2026-06-01→07-28; Qdrant benchmark (2026-02, vendor-published — treat as an upper bound).
**Confidence:** High on the latency measurements; medium on the cost projection, which assumes
  the 3× document growth in the current plan holds.
**Status:** Analysis only — no decision taken.
```

Two habits that make this earn its space: **date every source**, and **name each source's bias**
where it has one. "Vendor-published — treat as an upper bound" tells the reader exactly how much
weight to put on the number, and costs you five words.

---

## 2. §0 — the finding paragraph

One paragraph. No headers under it. It answers: *what is true, why, and what it costs.*

Write it before anything else, and rewrite it last.

**The moves that make it land:**

- **Open with the mechanism, not the topic.** Not "This report examines our vector search stack."
  The reader knows what they asked for. Start where the interesting part is.
- **Name the thing precisely, then compress it into a phrase the reader will repeat.** "The
  harness is an ERD without a database." "We are paying managed-service prices for a self-hosted
  failure mode." A phrase that travels is how the finding survives the meeting.
- **Refuse the softer framing explicitly** when the finding will otherwise be filed as taste:
  *"That is not an aesthetic complaint. It is the direct mechanical cause of…"*
- **Land on a number.** The paragraph should end somewhere checkable.

**Structural anti-pattern — the throat-clear:**

> This report provides a comprehensive analysis of the current state of our data ingestion
> pipeline, examining various architectural considerations and offering recommendations for
> potential improvements going forward.

That paragraph contains no information. Every clause is a promise to say something later. If your
§0 could be pasted into a different report about a different system without editing, it is not a
finding — it is a table of contents in disguise.

---

## 3. Comparison tables that decide something

A comparison table is the workhorse of an evaluation report, and it is usually built wrong: a grid
of ✅/❌ across features nobody weighted, which lets the reader confirm whatever they walked in
believing.

**Set the weights before the scores.** Publishing the weights is what makes the conclusion
arguable — a reader who disagrees can attack the weight rather than suspecting the arithmetic.

```markdown
| Criterion | Weight | Why this weight | pgvector | Qdrant | Pinecone |
|---|---|---|---|---|---|
| p99 at 50M docs | 0.35 | The Q3 step-up is the forcing function | 1.8s ❌ | 90ms ✅ | 110ms ✅ |
| Ops burden | 0.25 | Two-person platform team, no on-call depth | none ✅ | high ❌ | none ✅ |
| Cost at 50M | 0.20 | Budget is fixed through FY | $340/mo ✅ | $1.1k/mo ⚠️ | $4.2k/mo ❌ |
| Migration cost | 0.20 | Every week here is a week not on ranking | $0 ✅ | 5 wk ⚠️ | 3 wk ⚠️ |
```

Three habits that separate a useful matrix from a decorative one:

- **Include "keep what we have" as a row.** It wins more often than vendor comparisons admit, and
  omitting it quietly assumes the conclusion.
- **Put the measured value in the cell, not just the symbol.** `1.8s ❌` is checkable; `❌` is an
  opinion with a font.
- **When one criterion dominates, say so and stop scoring.** If p99 at 50M docs is a hard
  requirement and one option fails it, the weighted total is theatre. Name the disqualifier and
  move to the two survivors.

**The second table type** — mapping a framework onto a system — is what makes an analysis report
concrete instead of impressionistic:

```markdown
| Framework's slot | This system's component | Assessment |
|---|---|---|
| `inspect()` | `compile-order.mjs` | Stronger — reads facts from disk, zero LLM tokens, so state cannot be hallucinated |
| `evaluate()` | `t0-verify.mjs` then `spec-evaluator` | Stronger — deterministic run, then a judge that recomputes the artifact hash itself |
| persistent memory | *(absent)* | The gap. Every relation is re-derived per run and discarded |
```

The `*(absent)*` row is the one that matters. Do not drop rows because the system has nothing in
them — those rows *are* the analysis.

---

## 4. Citation discipline

Inline, not footnoted — the reader should never have to scroll to check a claim.

| Claim type | Form |
|---|---|
| Code behaviour | `` the retry budget is set once at construction (`client.py:88`) `` |
| Measurement | `p99 1.8s at 50M docs (internal dashboard, 2026-07-28)` |
| Document | `the paper is explicit that the progression is directional, not mandatory (§VI)` |
| External | `[pgvector 0.8.0 changelog](url), 2025-11 — HNSW build parallelism` |
| Your inference | `**Inference:** the timeout is inherited from the HTTP default; nothing sets it explicitly.` |

The **Inference** marker is not a hedge — it is a precision instrument. Reports lose credibility
by presenting reasoning as observation; they lose usefulness by refusing to reason at all. Marking
the boundary lets you do both. Use it, then keep reasoning.

Absence is citable too, and often the finding: *"There is no `run_id` on any record in
`domain.schema.json` (738 lines, 38 definitions, searched for `run_id`, `trace`, `correlation`)."*
State what you searched for, so the reader can tell a real absence from a missed grep.

---

## 5. The negative space section

Any report can list things to build. §5 says what *not* to build, and why it looks necessary but
isn't. It is the section experienced readers check first, because it is the only proof you modelled
cost rather than just capability.

Good entries share a shape: **name the tempting thing → concede why it is tempting → give the
specific reason it does not pay here.**

> **Do not add a semantic cache in front of the retriever.** It is the obvious latency win and
> every reference architecture has one. But our p99 is dominated by the ANN search on one hot
> shard (§4.2), not by repeated queries — the measured query-repeat rate is 4%. A cache would cut
> p99 by roughly 4% of 1.8s and add an invalidation surface to a system that currently has none.

> **Do not build the knowledge graph yet.** The lineage problem is real, but a graph earns its
> cost when connected queries, evolving relations, or shared world state are central (§VIII.C of
> the source). Here, two of three are absent — the queries are single-hop and the relations are
> fixed. Persist the artifacts first; that is the step this project's measured failure needs, and
> it costs zero model tokens.

Aim for two to four entries. If you cannot think of anything not worth building, you did not
consider enough options — which is itself worth knowing before you write §6.

---

## 6. Staged, costed recommendations

"Adopt X" is a wish. A recommendation has stages, order, cost, and an exit criterion per stage.

The sequencing principle worth following: **the cheapest step that produces evidence goes first,
and everything expensive is gated behind it.** This is what makes a recommendation safe to accept
— the reader is agreeing to a small measurement, not to a quarter of work.

```markdown
### Stage 1 — Shadow-index benchmark · 1.5 wk · $0 infra
Build the Qdrant index from the existing parquet snapshot, replay one week of production
queries, measure recall@10 and p99 against pgvector.
**Exit:** p99 < 150ms at 50M docs *and* recall@10 within 2pts. If either fails, stop — the
migration case collapses and Stage 2 is never funded.

### Stage 2 — Dual-write · 3 wk · ~$1.1k/mo overlap
...
**Exit:** 72h with zero divergence on the reconciliation job.
```

Costs in the units the decider controls — engineer-weeks, dollars per month, tokens per run — not
in "low/medium/high", which is a way of not answering.

---

## 7. §7 — What would change this answer

Three or four bullets. This is the section that makes the report honest, and the one that makes it
survive contact with new information instead of being quietly ignored once it is stale.

> - **If the Q3 growth projection slips below 20M docs**, pgvector stays inside its envelope and
>   the whole migration is premature — recheck against the actual document count on 2026-09-01.
> - **If pgvector 0.9 ships the parallel HNSW build** currently on the roadmap, the p99 gap may
>   close; the release is the trigger to re-run Stage 1's benchmark rather than proceed.
> - **I did not measure write amplification** under dual-write. If ingest is already near its IOPS
>   ceiling, Stage 2 has a cost this report does not price.

Note the third bullet — naming your own gap. A report that lists only external falsifiers is
claiming its own coverage was complete, which is almost never true.

---

## 8. Prose failures, with rewrites

**Hedging that carries no information.**

> It may be worth considering whether the current approach could potentially benefit from some
> form of caching layer, depending on the specific requirements.

→ *Caching does not pay here: query-repeat rate is 4% (§4.2), so the ceiling on the win is ~4% of
p99.*

**Adjectives standing in for measurement.**

> Kafka offers superior scalability and better performance characteristics.

→ *Kafka sustained 1.2M msg/s at p99 12ms in [Confluent's 2025 benchmark]. Our measured peak is
40k msg/s. Both options clear our requirement by more than an order of magnitude, so throughput
should not decide this — operational surface should.*

Notice the rewrite does more than add a number: it uses the number to *dismiss the criterion*.
That is the move. A measurement that changes which criteria matter is worth ten that merely fill
a cell.

**Manufactured balance.**

> Both options have their strengths and weaknesses, and the right choice depends on your specific
> use case and priorities.

→ *Qdrant is the better system and the wrong choice here. It wins on recall and p99 (§2), but it
needs an on-call rotation this team does not have, and the measured p99 problem is one hot shard
(§4.2) — which a partition-key change fixes in a week for zero new infrastructure.*

**Restating the structure instead of using it.**

> In this section we will examine the various components of the ingestion pipeline and discuss
> their respective roles within the overall architecture.

→ Delete it. Start with the first component and what is wrong with it. Section headers already
tell the reader where they are; a sentence that does it again spends their attention for nothing.

**The passive dodge.**

> It was determined that the timeout configuration may be suboptimal.

→ *The HTTP client's 1500ms timeout is never set explicitly (`client.py:88`); it is the library
default, and it is shorter than the p99 of the call it wraps (1.8s). Every request at p99 fails by
construction.*

Passive voice in an architecture report almost always hides the two things the reader needs: who
does it, and where. Name both.
