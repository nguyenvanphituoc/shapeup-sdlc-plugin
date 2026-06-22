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

# Determine source directory via the shared lib (local clone or GitHub clone).
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib/lib-harness.ps1")

$Source = Resolve-HarnessSource
$SourceDir = $Source.SourceDir

# Confirmation
if (-not $Yes) {
    $Confirm = Read-Host "Proceed with installation in $TargetDir? [y/N]"
    if ($Confirm -notmatch "^[Yy]$") {
        Write-Host "Installation cancelled."
        exit 1
    }
}

# Install/replace skills for all CLIs via the shared lib (per-skill replace + antigravity subagents).
Invoke-HarnessReplaceSkills -Target $TargetDir -Clis @('claude', 'antigravity', 'codex') -Source $Source

# 1. Claude Code
Write-Host "Configuring Claude Code local scaffolding..."

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

$AgentsInstructions = @"
<!-- HARNESS_START -->
# Antigravity Agent Configuration

This directory houses workspace customizations for Antigravity.

## Local Skills:
Located under \`.agents/skills/\`. These are automatically loaded and prioritized over global tools.

## Subagent Definitions:
Located under \`.agents/subagents/\`. Registered in \`.agents/subagents.json\`.
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


# Cleanup temp dir if it was created
if (Get-Variable -Name TempDir -ErrorAction SilentlyContinue) {
    Remove-Item -Path $TempDir -Recurse -Force | Out-Null
}

Write-Host "Harness installation and scaffolding successfully completed!"
