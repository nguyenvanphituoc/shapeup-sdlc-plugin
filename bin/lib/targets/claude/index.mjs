// The Claude Code target: what `init` does for a project that runs the plugin inside Claude Code.
import { pluginInstallStep, grantStep, agentImportStep } from "./plugin-install.mjs";

export const claude = {
  name: "claude",
  steps: () => [pluginInstallStep, agentImportStep],
  next: [
    "   Next: open a Claude Code session in this directory and run /ship \"<your idea>\".",
  ],
};

// The same target for a project whose plugin is already installed — the plugin's own init command.
// It leaves the plugin's registration alone and writes the grant only, so a user-scope install is not
// joined by a second, project-scope one.
export const claudeInstalled = {
  name: "claude",
  steps: () => [grantStep, agentImportStep],
  next: [
    "   Next: start a new Claude Code session here (it reads the @AGENTS.md import at start-up) and run",
    "   /shapeup-sdlc-plugin:ship \"<your idea>\".",
  ],
};
