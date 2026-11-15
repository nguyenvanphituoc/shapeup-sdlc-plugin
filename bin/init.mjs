#!/usr/bin/env node
// npx shapeup-sdlc init — cross-platform scaffolding installer.
//
// Registers the plugin at project scope (so teammates who pull the repo inherit it) and writes the
// kernel grant, the harness block, the ignore rules and the scaffold. The installer itself lives in
// lib/run-init.mjs, shared with bin/init-plugin.mjs.
//
// Usage:
//   npx shapeup-sdlc init [-d <dir>] [-y] [-o] [--dry-run] [--check]
import { runInit } from "./lib/run-init.mjs";

await runInit(process.argv.slice(2), { prog: "npx shapeup-sdlc init", registerPlugin: true });
