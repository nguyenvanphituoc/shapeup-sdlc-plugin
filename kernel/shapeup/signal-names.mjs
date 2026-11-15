// signal-names — the failure-class vocabulary, read off the schema, in a module light enough for a hook to import.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SCHEMA = join(dirname(fileURLToPath(import.meta.url)), "../schemas/domain.schema.json");

/** The KbSignal vocabulary. */
export const signalNames = () => JSON.parse(readFileSync(SCHEMA, "utf8")).$defs.KbSignal.enum;

/**
 * The pathology id a signal names (`pathology.PA3` → `PA3`), or null when the vocabulary lacks it — so the id a
 * hook writes is one the vocabulary holds, and renaming it in one place cannot leave the other behind.
 */
export function pathologyId(signal) {
  try { return signalNames().includes(signal) ? signal.split(".")[1] : null; } catch { return null; }
}
