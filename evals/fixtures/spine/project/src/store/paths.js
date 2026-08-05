import { join } from "node:path";

export function storePath() {
  return process.env.TODO_STORE || join(process.cwd(), "todos.json");
}
