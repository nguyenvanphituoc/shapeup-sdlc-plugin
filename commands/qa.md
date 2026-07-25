---
description: Exploratory edge hunt on the running app (post-PASS; findings never block ship)
---
Use the **qa-edge-hunter** skill on $ARGUMENTS.

Runs after the evaluator's PASS, outside the build↔eval loop. It charters edges *outside* what
the evaluator probed and hunts them through six fixed lenses against the running app. Findings
are filed to the discovery ledger as `~` — QA has **no verdict and no score**, and a finding
never blocks ship.

It needs a spec folder, a PASS eval report, and a running app. If there is no PASS verdict yet,
say so and stop — QA before PASS is the evaluator's job done out of order.
