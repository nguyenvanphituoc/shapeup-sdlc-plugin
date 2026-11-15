#!/usr/bin/env node
// The plugin's own init command — what `/shapeup-sdlc-plugin:init` runs, from the installed plugin.
//
// The plugin is already installed when this runs (usually at user scope, from the marketplace), so it
// does everything `npx shapeup-sdlc init` does except register the plugin again at project scope: the
// kernel grant, the harness block, the @AGENTS.md import, the ignore rules and the scaffold. It also
// runs the copy of the installer that came with the plugin, so the two are always the same version.
//
// Usage:
//   node <plugin root>/bin/init-plugin.mjs [-d <dir>] [-y] [--dry-run] [--check]
import { runInit } from "./lib/run-init.mjs";

await runInit(process.argv.slice(2), { prog: "/shapeup-sdlc-plugin:init", registerPlugin: false });
