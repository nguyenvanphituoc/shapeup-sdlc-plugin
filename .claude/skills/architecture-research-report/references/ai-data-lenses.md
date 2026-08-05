# AI and data engineering — review lenses

Lenses for reviewing AI/ML and data-platform architecture. Each is a question with a checkable
answer and a named failure mode, so a review can score a system rather than describe it.

Contents:
1. Evaluation design
2. Cost and latency modelling
3. RAG and retrieval failure modes
4. Agent and LLM-pipeline review
5. Data contracts and pipeline correctness
6. Storage and modelling choices
7. Numbers worth carrying

---

## 1. Evaluation design

The most common defect in an AI system is not the model — it is that nobody can tell whether a
change helped. Lead here.

| Ask | Failure if missing |
|---|---|
| Is there a frozen gold set, with provenance and a size? | Every "improvement" is anecdote |
| Is the eval set held out from prompt iteration? | The prompt is overfit to the eval and the number is fiction |
| Are there adversarial and near-miss cases, not just happy paths? | Passes 100% and fails in production |
| Is there a **baseline** — the trivial approach, or the current system? | No way to know the complexity earned anything |
| Is the metric decomposed by slice (doc type, tenant, language, length)? | Average success hides catastrophic subgroups |
| Is inter-rater agreement known for LLM-judge evals? | An unvalidated judge is an unmeasured instrument |
| Is cost and latency measured alongside quality? | Quality wins that no one can afford to ship |

**LLM-as-judge specifics.** A judge needs: an explicit rubric with criteria (not "rate 1–5"),
position-bias control when comparing pairs (swap and average), a calibration set scored by humans,
and a different model or prompt from the generator. A judge sharing the generator's model and prompt
mostly measures self-consistency.

**The regression question.** Ask what happens to the eval when a dependency version changes. If the
answer is "we'd notice", the answer is no.

---

## 2. Cost and latency modelling

Build the model explicitly; most disagreements about AI architecture dissolve once someone writes
the arithmetic down.

```
cost/request = Σ over calls ( tokens_in × price_in + tokens_out × price_out )
             + retrieval cost + tool-call cost
monthly      = cost/request × requests/mo × (1 + retry_rate) × (1 + eval_sampling_rate)
```

What gets missed, and is usually the dominant term:

- **Retries and fallbacks.** A 5% retry on a 3-call chain is not 5% — compounding across calls,
  plus the fallback tier's price.
- **The eval and monitoring traffic.** Sampling 10% of production through a judge adds a real line.
- **Context growth over a session.** Cost per turn grows with history; a 20-turn conversation is
  not 20× turn one, it is closer to quadratic without truncation or caching.
- **Prompt caching**, which cuts the repeated-prefix cost substantially and changes the shape of
  the answer — check whether the architecture is *arranged* to hit the cache (stable prefix first,
  variable content last) rather than merely eligible for it.

**Latency is not additive when work is parallel, and not parallel when it looks parallel.** Check
for accidental serialisation: an `await` in a loop, a shared connection pool at its ceiling, a rate
limiter. The p99 of a fan-out is the p99 of the *slowest* branch, so a fan-out over 10 calls with
p99 1s each has a p99 well above 1s — model it as the max of the branches, not the mean.

**Small-model tiering** is the highest-leverage cost lever and is usually available: extraction and
classification on a cheap model, synthesis and adjudication on a strong one. Quantify it before
recommending it — `cheap_share × price_delta × volume`.

---

## 3. RAG and retrieval failure modes

Diagnose *where* the loss is before recommending anything; the fixes are unrelated to each other.

| Stage | Failure | How to detect |
|---|---|---|
| Ingest | Parse loss — tables, PDFs, code blocks mangled | Sample 50 docs; count non-recoverable ones. Usually double the estimate |
| Chunk | Boundaries split the answer across chunks | Recall@k high but answer quality low |
| Embed | Domain vocabulary out of distribution | Retrieval fails on jargon queries specifically |
| Retrieve | Recall ceiling — the right chunk is never in top-k | Measure recall@k against a labelled set. This is the first thing to measure |
| Rerank | Absent, or reranking a bad candidate set | Precision@5 far below recall@50 |
| Generate | Ignores retrieved context, or cites the wrong chunk | Grounding/attribution score; check cited-span validity |

**Measure recall@50 before anything else.** If the correct chunk is not in the top 50, no prompt
change, no reranker, and no larger model will fix it — the problem is upstream, and every downstream
intervention is wasted. This single measurement redirects more RAG projects than any other.

**Hybrid retrieval** (BM25 + dense) is the highest-return, lowest-risk change in most stacks,
because the two fail on different queries — lexical handles rare identifiers, IDs, and exact names
that embeddings blur.

**Chunk size** is not a global constant; it depends on whether answers are local (small chunks) or
require document-level context (large chunks or parent-document retrieval). Recommending a number
without knowing which is guessing.

---

## 4. Agent and LLM-pipeline review

For agentic systems, run the six selection questions in `graph-engineering.md` §2 first — they
locate the finding faster than any checklist here. These supplement:

- **Tool schema quality.** Untyped or loosely typed arguments produce invalid calls that fail
  silently and burn a turn. Check whether tool errors are returned to the model in a form it can act
  on, or swallowed.
- **Context construction policy.** What decides what enters the window? "Everything so far" is a
  policy, and it is the one that produces both the cost curve and the lost-in-the-middle failures.
- **Termination.** What stops the loop besides success? A max-turn cap with no partial-result
  contract produces a fluent summary of nothing.
- **Idempotency of tool calls.** Retries and parallel branches will re-invoke tools. A non-idempotent
  write behind a retried call is a correctness bug waiting for load.
- **Failure surfacing.** On budget exhaustion, does the system return completed work, unresolved
  issues, and a reason — or a confident paragraph? (`graph-engineering.md` §2.)
- **Correlated errors under fan-out.** Parallel workers on the same prompt fail the same way; a
  verification pass helps only if the verifier differs in prompt, evidence, or role.

---

## 5. Data contracts and pipeline correctness

| Ask | Failure if missing |
|---|---|
| Is the schema versioned and validated at the boundary? | Downstream breaks silently, days later |
| Are pipeline steps idempotent? | Backfills and retries double-count |
| Is late-arriving data handled explicitly? | Yesterday's numbers change and nobody knows why |
| Is there a watermark / completeness signal? | Dashboards read partial partitions as real dips |
| Is lineage recorded per run, not per table? | "Where did this number come from" is unanswerable |
| Are freshness and volume alerted, not just job success? | A job that succeeds on zero rows looks healthy |

**Job success is the wrong alert.** The failures that matter are silent: schema drift absorbed by a
permissive parser, an upstream that starts returning empty, a join that quietly becomes a fan-out.
Alert on row-count deltas and freshness.

**Batch vs. streaming** is decided by the *decision latency requirement*, not by the data's arrival
pattern. Data arriving continuously that feeds a daily report is a batch problem. Ask what decision
consumes the output and how stale it can be — that number, not the ingest shape, is the answer.

**Reprocessing.** Ask how a bug found today gets fixed in six months of history. If the answer needs
a hand-written script, the architecture has no backfill story and that is a finding.

---

## 6. Storage and modelling choices

- **Postgres until it hurts, and name where it hurts.** Most "we need a specialised store" arguments
  fail against a measured Postgres ceiling. Name the specific limit reached — index build time,
  p99 under concurrency, storage cost — with a number.
- **pgvector's real limits** are index build time and recall-at-scale under HNSW memory pressure,
  not raw query speed at small scale. Recommend migration on a measured recall or p99 curve, never
  on document count alone.
- **Lakehouse table formats** (Iceberg/Delta) earn their cost with schema evolution, time travel,
  and concurrent writers. With one writer and stable schema, they are overhead — parquet plus a
  catalogue is enough.
- **OLTP/OLAP split** is warranted when analytical scans measurably degrade transactional p99. Show
  the degradation before recommending the split.
- **Denormalisation** trades write amplification for read latency. Price both sides; reports usually
  price only the win.

---

## 7. Numbers worth carrying

Use as order-of-magnitude anchors to sanity-check a claim — always replace with the reader's own
measurements before publishing, and never cite these as sources.

- Embedding a document: single-digit milliseconds on a hosted API; the bottleneck is batching and
  rate limits, not compute.
- ANN search at ~1M vectors: single-digit to low-tens of milliseconds. At 50M+, index memory and
  shard balance dominate, and p99 diverges sharply from p50.
- LLM output generation dominates latency; input processing is comparatively cheap. Reducing output
  tokens is a far larger latency lever than reducing input tokens — though input still drives cost.
- Prompt caching on a stable prefix substantially cuts repeated-prefix cost; arrange the prompt so
  the stable part comes first.
- A parse failure rate of 5–15% on real-world PDF corpora is normal. Estimates below that are
  usually made without sampling.

For any current model's pricing, context limits, or capabilities, consult the `claude-api` skill or
current vendor documentation rather than these anchors — model specifications change frequently
enough that a hardcoded number in a report is a liability.
