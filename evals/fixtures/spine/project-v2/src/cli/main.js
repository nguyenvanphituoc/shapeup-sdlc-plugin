// Composition root. The project profile names this file as `entry_point`; everything the running
// CLI can reach, it reaches from here.
import { parseArgs } from "./args.js";
import { dispatch } from "./dispatch.js";

export function main(argv) {
  const { command, rest } = parseArgs(argv);
  return dispatch(command, rest);
}

if (process.argv[1] && process.argv[1].endsWith("main.js")) {
  process.exit(main(process.argv.slice(2)));
}
