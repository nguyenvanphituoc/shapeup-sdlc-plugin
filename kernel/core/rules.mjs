// rules — one rule per file: parse, normalise, hash, and decide whether a rule applies. Free of any workflow.
//
// A rule is a small markdown file: a frontmatter of `key: value` lines (a composite value is one line of
// JSON) and a body. This module knows nothing about WHICH keys a workflow allows or what its readers are
// called; it holds the mechanism a selector and a linter both stand on, so the two cannot disagree about
// what a file says.
//
// WHY A HASH AND NOT A NUMBER. Two machines that each append "the next rule" mint the same id and collide
// in git; an id derived from the text cannot. The identity (`id`) is minted once and never changes; the
// revision (`rev`) follows the text, so a reader can tell "the same rule, edited" from "a different rule".
import { createHash } from "node:crypto";

/** Fields of a rule that are JSON on one line. */
const JSON_FIELDS = new Set(["when", "aliases", "overrides", "params"]);

/**
 * Normalise text so the same content hashes the same on every machine: UTF-8 line feeds, no trailing
 * blanks, one blank line between blocks, trimmed.
 * @param {string} text - Raw text.
 * @returns {string} The normalised text.
 */
export function normalizeText(text) {
  return String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Parse a rule file. A broken frontmatter is an ERROR, never "a rule with no conditions": a rule that
 * was meant to apply in one place and silently applies everywhere is worse than one that does not load.
 * @param {string} text - The file's text.
 * @returns {{meta: object, body: string, errors: string[]}} The fields, the body, and why it did not parse.
 */
export function parseRule(text) {
  const t = String(text).replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const errors = [];
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(t);
  if (!m) return { meta: {}, body: normalizeText(t), errors: ["no frontmatter block"] };
  const meta = {};
  for (const line of m[1].split("\n")) {
    if (!line.trim()) continue;
    const i = line.indexOf(":");
    if (i < 1) { errors.push(`frontmatter line is not "key: value": ${line.slice(0, 60)}`); continue; }
    const key = line.slice(0, i).trim(); const raw = line.slice(i + 1).trim();
    if (JSON_FIELDS.has(key)) { try { meta[key] = JSON.parse(raw || "null"); } catch { errors.push(`"${key}" is not one line of JSON`); } }
    else meta[key] = raw;
  }
  return { meta, body: normalizeText(m[2]), errors };
}

/**
 * The canonical form of a `when` map: keys sorted, each list sorted and de-duplicated, serialised without
 * spaces. Order of keys or values in the file never changes a hash.
 * @param {(object|null|undefined)} when - The predicate.
 * @returns {string} Canonical JSON.
 */
export function canonicalWhen(when) {
  const out = {};
  for (const k of Object.keys(when ?? {}).sort()) {
    const v = when[k];
    out[k] = Array.isArray(v) ? [...new Set(v.map(String))].sort() : v;
  }
  return JSON.stringify(out);
}

/** `sha256` of normalised text, as hex. */
export const sha = (text) => createHash("sha256").update(normalizeText(text)).digest("hex");

/**
 * The revision: 12 hex of the hash of what the rule SAYS and where it applies — reader, kind, `when`, body.
 * Status is excluded on purpose: promoting or retiring a rule is not editing it.
 * @param {{reader: string, kind: string, when: object, body: string}} r - The rule's content.
 * @returns {string} 12 hex characters.
 */
export const revOf = ({ reader, kind, when, body }) => sha(`${[].concat(reader).sort().join(",")}\n${kind}\n${canonicalWhen(when)}\n${normalizeText(body)}`).slice(0, 12);

/**
 * The identity, minted once: a short code plus 8 hex of the body's hash at creation.
 * @param {string} code - A short reader code.
 * @param {string} body - The body at creation.
 * @returns {string} e.g. `te-3f2a9c1d`.
 */
export const idOf = (code, body) => `${code}-${sha(body).slice(0, 8)}`;

/** A slug for the file name, from the body's first words. */
export const slugOf = (body) => normalizeText(body).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").split("-").slice(0, 6).join("-") || "rule";

/**
 * Whether a rule's `when` holds against facts. AND between keys, OR inside a list, a missing key means
 * "any value". A key the facts do not carry never matches — absence of evidence is not a match.
 * @param {(object|null|undefined)} when - The predicate.
 * @param {Object<string, string[]>} facts - Each key's present values.
 * @returns {boolean} Whether the rule applies.
 */
export function whenMatches(when, facts) {
  for (const [k, want] of Object.entries(when ?? {})) {
    const have = facts?.[k] ?? [];
    if (!have.length || ![].concat(want).some((w) => have.includes(String(w)))) return false;
  }
  return true;
}

/** How many keys a `when` names — its specificity. */
export const specificity = (when) => Object.keys(when ?? {}).length;

/** A cheap token estimate, the same on every machine. */
export const tokensOf = (text) => Math.ceil(String(text).length / 4);
