---
description: The Cut-List Review gate — must-have census, baseline comparison, cut list + ship verdict
---
Use the **building** skill's `stop` sub-command on $ARGUMENTS.

The stop decision. Censuses the open items (QA findings, discovered-ledger rows, attempt-budget
proposals), compares the product to the **pitch's baseline — what customers live with today, never
the ideal** — and returns a cut list plus a ship verdict for the TL/PO to confirm. You do it in this
session, and every ownership, exhaustion and requirement claim cites the file it came from — the scope
contracts, the dispatch receipts and trials, the verdict and `requirements.md`.

Handles all three arrival paths: the normal stop (all scopes finished), an exhausted round
budget, and an exhausted per-scope attempt budget. The verdict is a proposal — promotion of cut
items is the human's call at the gate, not the census's — and it is written as data to
`reports/hammer-census.json` under the run's local root, which the Ship Sign-off gate reads before any answer set
may say `ship`.
