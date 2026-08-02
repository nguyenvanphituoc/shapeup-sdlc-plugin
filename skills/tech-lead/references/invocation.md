# Tech-Lead Invocation

Invocation examples and the complete flag table, extracted from `SKILL.md` (progressive
disclosure). Read this when you need the exact CLI shape or a flag's effect.

---

## Invocation

```bash
# Full build run from a kicked-off pitch, interactive (pause at every L-gate)
/tech-lead --pitch shapeup/checkout-vnpay/shaping/shaping.md --spec shapeup/checkout-vnpay/spec/ --lens standard

# Sub-skills unattended, tech lead pauses only at orient / plan / verdict / ship
/tech-lead --pitch ... --spec ... --auto

# Headless for CI (Agent SDK): auto-confirm all gates, stop on PASS / max_rounds / error
/tech-lead --pitch ... --spec ... --unattended --max-rounds 3

# Resume an existing run — start from a build-phase step
/tech-lead --spec shapeup/checkout-vnpay/spec/ --from build

# Skip evaluation for a trivial feature (tech-lead judgment / PO override)
/tech-lead --pitch ... --spec ... --no-eval
```

### Flags
| Flag | Effect |
|------|--------|
| `--pitch <path>` | Kicked-off pitch (shaped + bet by PO) — input to ORIENT then MAP SCOPES |
| `--spec <path>` | Spec folder (orient/ + planner output + ledger location) |
| `--lens lite\|standard\|cross-context` | Passed to ba-pitch-analyzer at step 8 |
| `--auto` | Sub-skills run unattended; tech lead pauses at L1a/L1b/L3/L4 |
| `--unattended` | Auto-confirm all L-gates (headless / CI) |
| `--max-rounds N` | BUILD→EVAL cycles before escalating (default 3) — the OUTER breaker |
| `--attempts N` | Per-scope T0 attempts before queuing a GATE H hammer proposal (default 5) — the INNER breaker; no-op on specs without scope contracts |
| `--orch-model / --exec-model / --eval-model / --qa-model <name>` | Override L0.8's resolved model matrix for this run only (highest precedence) |
| `--from orient\|plan\|build\|eval` | Resume an in-progress run at a build-phase step |
| `--no-eval` | Skip the evaluation pass this run (trivial feature) |
| `--no-qa` | Skip the post-PASS /qa-edge-hunter pass (ledger records `qa: skipped`) |
| `--tiny` | The small-change lane: orient (light) → single-task board → build → T0 → done. Implies `--no-eval --no-qa`, skips WIRE and scope contracts, collapses the gates to L0 + L4. See "The tiny lane" in SKILL.md — the L0 fit-check is mandatory and the ledger records `lane: tiny` |
| `--dimensions <list>` | Eval dimensions (default spec-conformance) |

---

