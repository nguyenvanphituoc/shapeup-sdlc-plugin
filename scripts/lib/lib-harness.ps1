# lib-harness.ps1 — shared helpers for installing/replacing Shape Up SDLC skills (PowerShell).
#
# Dot-source this file, then call:
#   Resolve-HarnessSource            -> returns @{ SourceDir; AntigravityDist }
#   Get-HarnessDetectedClis  -Target -> array of CLIs already installed
#   Select-HarnessClis       -Target -Yes  -> array of CLIs to act on (prompt unless -Yes)
#   Invoke-HarnessReplaceSkills -Target -Clis -Source  -> replaces skills for each CLI
#
# CLI -> locations: claude .claude/skills | antigravity .agents/skills + subagents | codex .codex/skills

$script:HarnessAllClis = @('claude', 'antigravity', 'codex')
$script:HarnessRepoUrl = 'https://github.com/nguyenvanphituoc/shapeup-sdlc-plugin.git'

function Get-HarnessSkillsDir {
    param([string]$Target, [string]$Cli)
    switch ($Cli) {
        'claude'      { return (Join-Path $Target ".claude/skills") }
        'antigravity' { return (Join-Path $Target ".agents/skills") }
        'codex'       { return (Join-Path $Target ".codex/skills") }
        default       { throw "Unknown CLI: $Cli" }
    }
}

function Resolve-HarnessSource {
    # $PSScriptRoot resolves to this lib's own directory (<repo>/scripts/lib) even when
    # dot-sourced; the repo root is two levels up.
    $libDir = $PSScriptRoot
    $localSkills = Join-Path $libDir "../../skills"
    if (Test-Path $localSkills) {
        $sourceDir = (Resolve-Path (Join-Path $libDir "../..")).Path
        Write-Host "Using local source directory: $sourceDir"
    } else {
        Write-Host "Local source not found. Cloning source repository from GitHub..."
        $tempDir = Join-Path $env:TEMP ([Guid]::NewGuid().ToString())
        New-Item -ItemType Directory -Path $tempDir | Out-Null
        git clone --depth 1 $script:HarnessRepoUrl $tempDir
        $sourceDir = $tempDir
    }
    return @{
        SourceDir       = $sourceDir
        AntigravityDist = (Join-Path $sourceDir "dist/antigravity")
    }
}

function Get-HarnessDetectedClis {
    param([string]$Target)
    $found = @()
    foreach ($cli in $script:HarnessAllClis) {
        if (Test-Path (Get-HarnessSkillsDir -Target $Target -Cli $cli)) { $found += $cli }
    }
    return $found
}

# Parse a choice string into a CLI array (unit-testable, no I/O).
function ConvertTo-HarnessClis {
    param([string]$Reply, [string[]]$Fallback)
    if ([string]::IsNullOrWhiteSpace($Reply)) { return $Fallback }
    $clis = @()
    foreach ($n in ($Reply -split '\s+')) {
        switch ($n) {
            { $_ -in '1', 'claude' }      { $clis += 'claude' }
            { $_ -in '2', 'antigravity' } { $clis += 'antigravity' }
            { $_ -in '3', 'codex' }       { $clis += 'codex' }
            { $_ -in '4', 'all' }         { return $script:HarnessAllClis }
            default { Write-Host "Ignoring unknown choice: $n" }
        }
    }
    return $clis
}

function Select-HarnessClis {
    param([string]$Target, [switch]$Yes)
    $detected = @(Get-HarnessDetectedClis -Target $Target)
    $fallback = if ($detected.Count -gt 0) { $detected } else { $script:HarnessAllClis }

    if ($Yes) {
        if ($detected.Count -gt 0) {
            Write-Host "Auto-selected installed CLIs: $($fallback -join ' ')"
        } else {
            Write-Host "No existing install detected — targeting all CLIs: $($fallback -join ' ')"
        }
        return $fallback
    }

    Write-Host ""
    Write-Host "Which AI CLI(s) are you using? Skills will be replaced for the ones you pick."
    Write-Host "  1) Claude Code   (.claude/settings.json — marketplace plugin)"
    Write-Host "  2) Antigravity   (.agents/skills/ + subagents)"
    Write-Host "  3) Codex         (.codex/skills/)"
    Write-Host "  4) All of them"
    Write-Host "Enter numbers separated by spaces (e.g. '1 3'), or press Enter for default [$($fallback -join ' ')]."
    $reply = Read-Host ">"
    return @(ConvertTo-HarnessClis -Reply $reply -Fallback $fallback)
}

# Install Claude Code plugin via marketplace (writes .claude/settings.json).
function Install-ClaudePlugin {
    param([string]$Target)
    $settingsFile = Join-Path $Target ".claude/settings.json"
    $marketplaceKey = "nvptuoc-marketplace"
    $pluginKey = "shapeup-sdlc-plugin@nvptuoc-marketplace"

    $settingsDir = Split-Path -Parent $settingsFile
    if (-not (Test-Path $settingsDir)) { New-Item -ItemType Directory -Path $settingsDir -Force | Out-Null }

    if (Test-Path $settingsFile) {
        $data = Get-Content $settingsFile -Raw | ConvertFrom-Json
        if (-not $data.extraKnownMarketplaces) {
            $data | Add-Member -NotePropertyName 'extraKnownMarketplaces' -NotePropertyValue ([PSCustomObject]@{}) -Force
        }
        $data.extraKnownMarketplaces | Add-Member -NotePropertyName $marketplaceKey -NotePropertyValue (
            [PSCustomObject]@{ source = [PSCustomObject]@{ source = "github"; repo = "nguyenvanphituoc/shapeup-sdlc-plugin" } }
        ) -Force
        if (-not $data.enabledPlugins) {
            $data | Add-Member -NotePropertyName 'enabledPlugins' -NotePropertyValue ([PSCustomObject]@{}) -Force
        }
        $data.enabledPlugins | Add-Member -NotePropertyName $pluginKey -NotePropertyValue $true -Force
        $data | ConvertTo-Json -Depth 10 | Set-Content -Path $settingsFile -Encoding UTF8
        Write-Host "  [claude] merged marketplace + plugin into $settingsFile"
    } else {
        [ordered]@{
            extraKnownMarketplaces = [ordered]@{
                $marketplaceKey = [ordered]@{
                    source = [ordered]@{ source = "github"; repo = "nguyenvanphituoc/shapeup-sdlc-plugin" }
                }
            }
            enabledPlugins = [ordered]@{ $pluginKey = $true }
        } | ConvertTo-Json -Depth 10 | Set-Content -Path $settingsFile -Encoding UTF8
        Write-Host "  [claude] created $settingsFile with marketplace + plugin"
    }
}

# Claude Code: configures the marketplace plugin in .claude/settings.json.
# Antigravity / Codex: per-skill replacement — remove then re-copy each harness skill so
# upstream deletions don't linger, while unrelated user skills in the same dir are untouched.
function Invoke-HarnessReplaceSkills {
    param([string]$Target, [string[]]$Clis, [hashtable]$Source)
    $src = Join-Path $Source.SourceDir "skills"
    Write-Host "Replacing skills for: $($Clis -join ' ')"
    foreach ($cli in $Clis) {
        if ($cli -eq 'claude') {
            Install-ClaudePlugin -Target $Target
            continue
        }

        $dest = Get-HarnessSkillsDir -Target $Target -Cli $cli
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        foreach ($skill in (Get-ChildItem -Path $src -Directory)) {
            if (-not (Test-Path (Join-Path $skill.FullName "SKILL.md"))) { continue }  # skip empty stubs
            $skillDest = Join-Path $dest $skill.Name
            if (Test-Path $skillDest) { Remove-Item -Recurse -Force $skillDest }
            Copy-Item -Recurse -Force $skill.FullName $skillDest
        }
        Write-Host "  [$cli] skills replaced in $dest"

        if ($cli -eq 'antigravity') {
            $subSrc = Join-Path $Source.AntigravityDist "subagents"
            if (Test-Path $subSrc) {
                $subDest = Join-Path $Target ".agents/subagents"
                New-Item -ItemType Directory -Path $subDest -Force | Out-Null
                Copy-Item -Recurse -Force (Join-Path $subSrc "*") $subDest
                $subJson = Join-Path $Source.AntigravityDist "subagents.json"
                if (Test-Path $subJson) { Copy-Item -Force $subJson (Join-Path $Target ".agents/subagents.json") }
                Write-Host "  [antigravity] subagent configs replaced in $subDest"
            }
        }
    }
}
