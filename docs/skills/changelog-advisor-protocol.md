# Changelog for advisor-protocol

> **DECOMMISSIONED (2026-08-12).** The skill, its `adjudicate` operation, and its `WorkerName`
> entry were removed; `Operation` and `WorkerName` no longer carry them, and `harness compile`
> cannot route to it. A worker `ESCALATE` is still a first-class `WorkResult` field — it is queued
> by `harness reduce ingest` and answered by the PO at the next gate, and in the workflow lane a phase
> that produced no artifact aborts by name rather than looping. This file is kept as the record of
> what the skill did while it existed; nothing below describes shipping behaviour.

| Version | Date | Changes |
|---------|------|---------|
| 0.3 | 2026-08-02 | **ADR-0001 consumer layout** (unreleased). The two roots renamed under the skill: precedent lookup reads `shapeup/knowledge-base/*.md`, and the `--ledger` examples name the new root. No craft change — the ESCALATE grammar, the ≤3/scope/round budget, four-path adjudication, and the persist-the-instant-it-is-answered rule are untouched. Earlier (2026-07-24, skills-optimization): the frontmatter `description` folded from a `>` block scalar to one quoted line and shed its closing "does not design, build, or judge" sentence — trigger surface only. **Carried drift:** ADR-0001 moves `round-ledger.md` to the LOCAL gitignored root and `paths.mjs` resolves it there, while this skill's prose still calls it "committed, Tier A" — the ledger's tier changed, not this skill's behaviour, and the prose has not caught up. |
| 0.2 | 2026-07-14 | **Domain-layer alignment.** Documented the envelope contract: orchestrated dispatch is WorkOrder in (`--order`) / WorkResult out like every worker; standalone flags map 1:1 onto the payload fields registered in the central domain registry (`domain.schema.json` `x-payload-by-worker`), and output fields follow `x-result-by-worker`. No behavior change. |
| 0.1 | 2026-07-12 | Initial release (design spec v1.1 §3.3/§4.5, DD-1/DD-8). ESCALATE grammar (kind/question/options/default_if_silent); ≤3/scope/round budget with GATE-H overflow flagging; four-path adjudication (precedent → substrate-expansion via `ba --remap` → interactive ask → unattended default/conservative); persistence to the committed round-ledger so decisions survive zero-memory resets. |
