export function refuse(message) {
  process.stderr.write(`${message}\n`);
  return 1;
}
