export function parseArgs(argv) {
  const [command = "list", ...rest] = argv;
  return { command, rest };
}
