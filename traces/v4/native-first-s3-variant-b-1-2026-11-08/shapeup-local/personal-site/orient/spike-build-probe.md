# Spike — build probe / test discovery (`node --test` at the project root)

**Status: RESOLVED**

## Why this area

The feature code itself is small and standard: string templating, escaping, `fs`, exit codes. Nothing in the
pitch depends on a third-party seam. The unproven seam is the round build gate. `build_probe: "node --test"`
(`shapeup/personal-site/project-profile.md:5`) runs from a root that holds hundreds of vendored test files
under `.claude/` and `.plugin-under-test/`, and today it holds no project test at all. If that gate is
mis-scoped, every round's verdict depends on the wrong thing.

- **Question:** what does bare `node --test` (Node v24.15.0) discover from this root, and what does it report
  when there is no project test?
- **Time-box:** 20 min. **Fallback:** ba plans an explicit test path in the run command.

## Method

1. A throwaway fixture in the session scratchpad, outside the project. Each file holds one passing test:
   `.hidden/deep/h.test.mjs`, `.claude/x/deliverable/build.test.mjs`, `test/t.test.mjs`, `test/plain.mjs`,
   `sub/s.test.mjs`, `top.test.mjs`, `build.test.mjs`, plus an `empty/` dir.
2. `node --test --test-reporter=tap` run in the fixture root and in `empty/`.
3. The same command at the real project root. It is read-only, because nothing was discovered.

## Findings

Fixture root output:
```
ok 1 - build.test.mjs
ok 2 - sub/s.test.mjs
ok 3 - test/plain.mjs
ok 4 - test/t.test.mjs
ok 5 - top.test.mjs
# tests 5
```
`empty/`: `# tests 0 # pass 0 # fail 0`, **exit 0**.
Real project root: `# tests 0 # pass 0 # fail 0`, **exit 0**.

1. **Dot-directories are skipped.** `.hidden/**` and `.claude/**` were not run. The ~333 vendored test-like files
   under `.claude/shapeup-sdlc-plugin/**` and `.plugin-under-test/**` therefore never reach the build probe.
   There is no collision risk.
2. **Zero tests is green.** With no test file, `node --test` exits 0. The build gate
   (`project-profile.md:5`) is green right now with nothing built. A round where the test file is missing,
   misnamed (e.g. `build.spec.mjs`, which is not in the default pattern) or placed under a dot-dir passes
   the gate vacuously. T0/EVAL must check that a non-zero `# tests` count ran, or the run command must name
   the test file explicitly.
3. **Every `.mjs` under a `test/` directory runs as a test**, including `test/plain.mjs`, which has no
   `.test.` infix. A helper module or fixture generator placed in `test/` runs as a test file. Keep fixtures
   as `.json` or keep helpers outside `test/`.
4. Discovered names that do run: root `*.test.mjs` and `**/*.test.mjs` in non-dot directories. A root
   `build.test.mjs` or `test/build.test.mjs` both qualify.

## Consequence for planning

- Plan the test file as a first-class deliverable with a discoverable name (`*.test.mjs`).
- Plan a gate check that the test count is above zero, or pin `node --test build.test.mjs` (or the chosen path).
  As written, the profile's `build_probe` cannot tell "built and passing" from "nothing exists".
- The `dist/` output does not interfere: it only holds `index.html`.
