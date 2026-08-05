// The one seam every command engine attaches to. A command engine that is not imported here is
// not reachable from the entry point, however complete it looks.
import { addTodo } from "../capture/add.js";
import { listTodos } from "../review/list.js";
import { searchTodos } from "../review/search.js";
import { markDone } from "../complete/done.js";
import { removeTodos } from "../complete/remove.js";
import { archiveDone } from "../archive/archive-engine.js";

const TABLE = {
  add: addTodo,
  list: listTodos,
  search: searchTodos,
  done: markDone,
  rm: removeTodos,
  archive: archiveDone,
};

export function dispatch(command, rest) {
  const engine = TABLE[command];
  if (!engine) {
    process.stderr.write(`unknown command: ${command}\n`);
    return 1;
  }
  return engine(rest);
}
