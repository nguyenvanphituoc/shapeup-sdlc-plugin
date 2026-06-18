# Install Shape Up SDLC Harness as Local Scaffolding (PowerShell version)
# Supports: Claude Code, Antigravity, and Codex

Param(
    [string]$Directory = ".",
    [switch]$Override,
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

# Resolve target directory path
$TargetDir = Resolve-Path $Directory
Write-Host "Installing Shape Up SDLC Harness into target directory: $TargetDir"

# Determine source directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$LocalSkills = Join-Path $ScriptDir "../skills"

if (Test-Path $LocalSkills) {
    $SourceDir = Resolve-Path (Join-Path $ScriptDir "..")
    Write-Host "Using local source directory: $SourceDir"
} else {
    Write-Host "Local source not found. Cloning source repository from GitHub..."
    $TempDir = Join-Path $env:TEMP ([Guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $TempDir | Out-Null
    git clone --depth 1 https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin.git $TempDir
    $SourceDir = $TempDir
}

# Confirmation
if (-not $Yes) {
    $Confirm = Read-Host "Proceed with installation in $TargetDir? [y/N]"
    if ($Confirm -notmatch "^[Yy]$") {
        Write-Host "Installation cancelled."
        exit 1
    }
}

# Helper to copy directory contents
function Copy-HarnessDirectory {
    param ($Src, $Dest)
    if (-not (Test-Path $Dest)) {
        New-Item -ItemType Directory -Path $Dest | Out-Null
    }
    Copy-Item -Path (Join-Path $Src "*") -Destination $Dest -Recurse -Force
}

# 1. Claude Code
Write-Host "Configuring Claude Code local scaffolding..."
$ClaudeSkillsDir = Join-Path $TargetDir ".claude/skills"
Copy-HarnessDirectory (Join-Path $SourceDir "skills") $ClaudeSkillsDir

# -- Dynamically read AGENT.md from source, stripping HARNESS comment markers --
$AgentMdSource = Join-Path $SourceDir "AGENT.md"
if (Test-Path $AgentMdSource) {
    $AgentInstructions = (Get-Content $AgentMdSource -Raw) `
        -replace '(?m)^<!-- HARNESS_START -->\r?\n?', '' `
        -replace '(?m)^<!-- HARNESS_END -->\r?\n?', ''
} else {
    Write-Host "Warning: AGENT.md not found in source directory. CLAUDE.md will be created empty."
    $AgentInstructions = ""
}

$ClaudeMdFile = Join-Path $TargetDir "CLAUDE.md"
if (Test-Path $ClaudeMdFile) {
    $Content = Get-Content $ClaudeMdFile -Raw
    if ($Content -match "<!-- HARNESS_START -->[\s\S]*<!-- HARNESS_END -->") {
        $Content = $Content -replace "<!-- HARNESS_START -->[\s\S]*<!-- HARNESS_END -->\r?\n?", ""
    }
    Set-Content -Path $ClaudeMdFile -Value ($Content.Trim() + "`r`n`r`n" + $AgentInstructions)
    Write-Host "Updated existing CLAUDE.md"
} else {
    Set-Content -Path $ClaudeMdFile -Value $AgentInstructions
    Write-Host "Created new CLAUDE.md"
}

# -- Auto-append @AGENT.md memory import tag if not already present ------------
$ClaudeContent = Get-Content $ClaudeMdFile -Raw -ErrorAction SilentlyContinue
if ($ClaudeContent -notmatch '@AGENT\.md') {
    Add-Content -Path $ClaudeMdFile -Value "`r`n@AGENT.md"
    Write-Host "Appended @AGENT.md import tag to CLAUDE.md"
} else {
    Write-Host "@AGENT.md import tag already present in CLAUDE.md"
}

# 2. Antigravity
Write-Host "Configuring Antigravity local scaffolding..."
$AgentSkillsDir = Join-Path $TargetDir ".agents/skills"
Copy-HarnessDirectory (Join-Path $SourceDir "skills") $AgentSkillsDir

$AgentSubagentsDir = Join-Path $TargetDir ".agents/subagents"
Copy-HarnessDirectory (Join-Path $SourceDir "dist/antigravity/subagents") $AgentSubagentsDir
Copy-Item -Path (Join-Path $SourceDir "dist/antigravity/subagents.json") -Destination (Join-Path $TargetDir ".agents/subagents.json") -Force

$AgentsInstructions = @"
<!-- HARNESS_START -->
# Antigravity Agent Configuration

This directory houses workspace customizations for Antigravity.

## Local Skills:
Located under \`.agents/skills/\`. These are automatically loaded and prioritized over global tools.

## Subagent Definitions:
Located under \`.agents/subagents/\`. Registered in \`.agents/subagents.json\`.

## Local Evolution:
To optimize prompts for this specific repository, use the evolved subagents and log outputs in \`docs/repair-memory.md\`.
<!-- HARNESS_END -->
"@

$AgentsMdFile = Join-Path $TargetDir ".agents/AGENTS.md"
if (Test-Path $AgentsMdFile) {
    $Content = Get-Content $AgentsMdFile -Raw
    if ($Content -match "<!-- HARNESS_START -->[\s\S]*<!-- HARNESS_END -->") {
        $Content = $Content -replace "<!-- HARNESS_START -->[\s\S]*<!-- HARNESS_END -->\r?\n?", ""
    }
    Set-Content -Path $AgentsMdFile -Value ($Content.Trim() + "`r`n`r`n" + $AgentsInstructions)
    Write-Host "Updated existing .agents/AGENTS.md"
} else {
    # Ensure parent dir exists
    $ParentDir = Split-Path -Parent $AgentsMdFile
    if (-not (Test-Path $ParentDir)) { New-Item -ItemType Directory -Path $ParentDir | Out-Null }
    Set-Content -Path $AgentsMdFile -Value $AgentsInstructions
    Write-Host "Created new .agents/AGENTS.md"
}

# 3. Codex
Write-Host "Configuring Codex local scaffolding..."
$CodexSkillsDir = Join-Path $TargetDir ".codex/skills"
Copy-HarnessDirectory (Join-Path $SourceDir "skills") $CodexSkillsDir

$CodexInstructions = @"
<!-- HARNESS_START -->
# Codex Agent Configuration

This directory contains workspace-specific skills for Codex.

## Local Skills:
- Located under \`.codex/skills/\`.
- These prompt definitions and workflow rules can be edited directly to tailor the Codex agent for this project's code quality and style guidelines.
<!-- HARNESS_END -->
"@

$CodexMdFile = Join-Path $TargetDir ".codex/AGENTS.md"
if (Test-Path $CodexMdFile) {
    $Content = Get-Content $CodexMdFile -Raw
    if ($Content -match "<!-- HARNESS_START -->[\s\S]*<!-- HARNESS_END -->") {
        $Content = $Content -replace "<!-- HARNESS_START -->[\s\S]*<!-- HARNESS_END -->\r?\n?", ""
    }
    Set-Content -Path $CodexMdFile -Value ($Content.Trim() + "`r`n`r`n" + $CodexInstructions)
    Write-Host "Updated existing .codex/AGENTS.md"
} else {
    $ParentDir = Split-Path -Parent $CodexMdFile
    if (-not (Test-Path $ParentDir)) { New-Item -ItemType Directory -Path $ParentDir | Out-Null }
    Set-Content -Path $CodexMdFile -Value $CodexInstructions
    Write-Host "Created new .codex/AGENTS.md"
}

# 4. Gitignore Setup
$GitignoreFile = Join-Path $TargetDir ".gitignore"
$GitignoreRule = "`r`n# Shape Up SDLC run workspace`r`n.shapeup-sdlc/"

if (Test-Path $GitignoreFile) {
    $Content = Get-Content $GitignoreFile -Raw
    if ($Content -notmatch "\.shapeup-sdlc/") {
        Add-Content -Path $GitignoreFile -Value $GitignoreRule
        Write-Host "Added .shapeup-sdlc/ to .gitignore"
    } else {
        Write-Host ".shapeup-sdlc/ already ignored in .gitignore"
    }
} else {
    Set-Content -Path $GitignoreFile -Value $GitignoreRule
    Write-Host "Created .gitignore and added ignore rule"
}

# 5. Initialize telemetry and memory files
$TelemetryDir = Join-Path $TargetDir "docs/shapeup-sdlc"
if (-not (Test-Path $TelemetryDir)) {
    New-Item -ItemType Directory -Path $TelemetryDir | Out-Null
}

$MetricsFile = Join-Path $TelemetryDir "metrics.jsonl"
if (-not (Test-Path $MetricsFile)) {
    New-Item -ItemType File -Path $MetricsFile | Out-Null
    Write-Host "Initialized metrics.jsonl"
}

$MemoryFile = Join-Path $TargetDir "docs/repair-memory.md"
if (-not (Test-Path $MemoryFile)) {
    $MemoryTemplate = @"
# Shape Up SDLC Repair Memory

This repository tracks historical evaluation failures, prompt modifications, and repair actions taken during local skill evolution runs. It serves as the memory store for HarnessFix diagnosis-driven skill optimization.

---

## Evolution Memory Log

| Date | Target Skill | Symptom / Failure Case | Scoped Repair Operator | Outcome / Delta |
| :--- | :--- | :--- | :--- | :--- |

---

## Repair Operator Guidelines

When fixing a skill's instructions or trigger descriptions:
1. **Trigger Adjustments**: Refine the trigger phrases in frontmatter \`description\` only. Do not overfit to specific queries.
2. **Instruction Refinements**: If a skill fails functional checks (e.g., evaluator leniency or executor code-bloat), add explicit counter-examples to the \`references/\` files.
3. **Seesaw Constraint Verification**: Ensure \`make eval-gate\` is run before committing modifications. Evolved skills must never regress previously passing baseline tests.
"@
    Set-Content -Path $MemoryFile -Value $MemoryTemplate
    Write-Host "Initialized docs/repair-memory.md"
}

# Cleanup temp dir if it was created
if (Get-Variable -Name TempDir -ErrorAction SilentlyContinue) {
    Remove-Item -Path $TempDir -Recurse -Force | Out-Null
}

Write-Host "Harness installation and scaffolding successfully completed!"
