# Hill signal — one-page-site (raw facts)

| Area | Open unknowns | Spike status |
|---|---|---|
| Build script (`build.mjs`) | name-empty and optional-field behaviour; `url` scheme policy; stale `dist/` on failure; stderr line construction | Approach resolved by reading (spike-validate-before-write.md); not executed |
| Tests (`node --test`) | test file location/name; none else (approach is spawnSync + temp dirs) | Approach clear, nothing run yet |
| Sample content / ignore rules | whether to ship a starter `content.json`; whether `dist/` is gitignored | None |

No area has an unresolved technical blocker. Spike was reading-only because probe execution was denied, so the approach carries no executed evidence yet.
