// The Claude Code target: what `init` does for a project that runs the plugin inside Claude Code.
import { pluginInstallStep, agentImportStep } from "./plugin-install.mjs";

export const claude = {
  name: "claude",
  steps: () => [pluginInstallStep, agentImportStep],
  next: [
    "   Next: open a Claude Code session in this directory and run /ship \"<your idea>\".",
  ],
};
