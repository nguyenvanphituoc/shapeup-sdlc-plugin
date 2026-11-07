// parse(text) -> { pairs, problems }. Pure; never throws; imports nothing.
// Contract: shapeup/envlint/spec/contracts/envlint.contract.md
export function parse(text) {
  const pairs = [];
  const problems = [];
  const lines = String(text).split(/\r?\n/);
  lines.forEach((raw, i) => {
    const line = i + 1;
    let s = raw.trim();
    if (s === "" || s.startsWith("#")) return;
    s = s.replace(/^export\s+/, "");
    const eq = s.indexOf("=");
    if (eq === -1) {
      problems.push({ line, message: "expected KEY=value" });
      return;
    }
    const key = s.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      problems.push({ line, message: "invalid key" });
      return;
    }
    const rest = s.slice(eq + 1).trim();
    let value = rest;
    const q = rest[0];
    if (q === "'" || q === '"') {
      if (rest.length >= 2 && rest.endsWith(q)) {
        value = rest.slice(1, -1);
      } else {
        problems.push({ line, message: "unterminated quote" });
        return;
      }
    }
    const prev = pairs.findIndex((p) => p.key === key);
    if (prev !== -1) pairs.splice(prev, 1);
    pairs.push({ key, value, line });
  });
  return { pairs, problems };
}
