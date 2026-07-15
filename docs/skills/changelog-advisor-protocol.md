# Changelog for advisor-protocol

| Version | Date | Changes |
|---------|------|---------|
| 0.2 | 2026-07-14 | **Domain-layer alignment.** Documented the envelope contract: orchestrated dispatch is WorkOrder in (`--order`) / WorkResult out like every worker; standalone flags map 1:1 onto the payload fields registered in the central domain registry (`domain.schema.json` `x-payload-by-worker`), and output fields follow `x-result-by-worker`. No behavior change. |
| 0.1 | 2026-07-12 | Initial release (design spec v1.1 §3.3/§4.5, DD-1/DD-8). ESCALATE grammar (kind/question/options/default_if_silent); ≤3/scope/round budget with GATE-H overflow flagging; four-path adjudication (precedent → substrate-expansion via `ba --remap` → interactive ask → unattended default/conservative); persistence to the committed round-ledger so decisions survive zero-memory resets. |
