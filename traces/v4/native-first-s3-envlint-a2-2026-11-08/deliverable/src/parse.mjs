// Pure .env parser: text in, {pairs, problems} out. No IO, no other module imports.
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnv(text) {
  const pairs = [];
  const problems = [];
  const lines = String(text).split("\n");
  lines.forEach((raw, i) => {
    const line = i + 1;
    const s = raw.replace(/\r$/, "").trim();
    if (s === "" || s.startsWith("#")) return;
    const body = s.startsWith("export ") ? s.slice(7).trim() : s;
    const eq = body.indexOf("=");
    if (eq === -1) {
      problems.push({ line, message: "missing '='" });
      return;
    }
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (!KEY_RE.test(key)) {
      problems.push({ line, message: `invalid key '${key}'` });
      return;
    }
    const q = value[0];
    if (q === "'" || q === '"') {
      if (value.length < 2 || value[value.length - 1] !== q) {
        problems.push({ line, message: "unterminated quote" });
        return;
      }
      value = value.slice(1, -1);
    }
    pairs.push({ key, value, line });
  });
  return { pairs, problems };
}
