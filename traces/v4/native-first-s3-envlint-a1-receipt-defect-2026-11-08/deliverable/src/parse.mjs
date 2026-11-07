// Pure .env parser. Contract: parse(text) -> { pairs: [{key,value,line}], problems: [{line,message}] }
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export function parse(text) {
  const pairs = [];
  const problems = [];
  const lines = String(text ?? "").split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    let s = raw.trim();
    if (s === "" || s.startsWith("#")) return;
    if (/^export\s+/.test(s)) s = s.replace(/^export\s+/, "");
    const eq = s.indexOf("=");
    if (eq === -1) {
      problems.push({ line, message: "missing '=' in line" });
      return;
    }
    const key = s.slice(0, eq).trim();
    if (key === "" || !KEY_RE.test(key)) {
      problems.push({ line, message: "invalid or empty key" });
      return;
    }
    let value = s.slice(eq + 1).trim();
    const q = value[0];
    if (q === '"' || q === "'") {
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
