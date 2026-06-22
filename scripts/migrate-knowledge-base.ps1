# Migrate an existing Shape Up SDLC install to the team-shared, per-skill knowledge base.
# (PowerShell version — see migrate-knowledge-base.sh for the full rationale.)
#
#   OLD: .shapeup-sdlc/knowledge-base.md            (flat, gitignored, never read back)
#   NEW: docs/shapeup-sdlc/knowledge-base/<skill>.md (per-skill, committed, read-back)
#
# Idempotent and non-destructive. Old rules are preserved into _INBOX.md for /coach to
# categorize — they are NEVER auto-assigned to a skill (the harness never assumes ownership).
# Also asks which AI CLI(s) you use and replaces the installed skill files for each (via the
# shared lib-harness.ps1) so the new coach gate + read-back hooks go live.

Param(
    [string]$Directory = ".",
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

# -- Shared lib ----------------------------------------------------------------
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "lib/lib-harness.ps1")

# -- Resolve paths -------------------------------------------------------------
$TargetDir = (Resolve-Path $Directory).Path
$OldKb     = Join-Path $TargetDir ".shapeup-sdlc/knowledge-base.md"
$NewKbDir  = Join-Path $TargetDir "docs/shapeup-sdlc/knowledge-base"
$Inbox     = Join-Path $NewKbDir "_INBOX.md"
$Readme    = Join-Path $NewKbDir "README.md"

Write-Host "Migrating Shape Up SDLC knowledge base in: $TargetDir"
Write-Host "  from: .shapeup-sdlc/knowledge-base.md            (old, local, gitignored)"
Write-Host "  to:   docs/shapeup-sdlc/knowledge-base/<skill>.md (new, committed, read-back)"

# -- Confirmation --------------------------------------------------------------
if (-not $Yes) {
    $Confirm = Read-Host "Proceed? [y/N]"
    if ($Confirm -notmatch "^[Yy]$") {
        Write-Host "Migration cancelled."
        exit 1
    }
}

# -- 1. Replace the installed skill files (per chosen CLI) ---------------------
$Source = Resolve-HarnessSource
$Clis = Select-HarnessClis -Target $TargetDir -Yes:$Yes
if ($Clis.Count -gt 0) {
    Invoke-HarnessReplaceSkills -Target $TargetDir -Clis $Clis -Source $Source
} else {
    Write-Host "Skipping skill replacement (no CLI selected) — continuing with data migration only."
}

# -- 2. Scaffold the committed knowledge-base directory ------------------------
New-Item -ItemType Directory -Path $NewKbDir -Force | Out-Null

if (-not (Test-Path $Readme)) {
    @'
# Knowledge Base — team-shared harness guidelines

`/coach` distills PO/TL feedback from the Ship Gate (L4) into durable guidelines and files
each one under the **one skill that acts on it**, in this directory. These files are
**committed on purpose** — a teammate inherits the harness's accumulated judgment on `git pull`.

| File | Read by | At |
|------|---------|----|
| `task-executor.md`     | `task-executor`     | Phase 1 (Context Load) |
| `ba-pitch-analyzer.md` | `ba-pitch-analyzer` | Phase 1 (Ingest & Scan) |
| `qa-edge-hunter.md`    | `qa-edge-hunter`    | Phase Q1 (Charter Map) |

These are **guidelines, not invariants** — they steer a worker's approach; they never override a
spec or change the `spec-evaluator` verdict (single-judge rule). `spec-evaluator` is deliberately
not coachable.

`_INBOX.md`, if present, holds rules migrated from a pre-0.12 flat knowledge base that have not yet
been categorized. Run `/coach` on its contents to sort each rule into the right skill file, then
delete `_INBOX.md`.
'@ | Set-Content -Path $Readme -Encoding utf8
    Write-Host "Created $Readme"
} else {
    Write-Host "README already present — left as-is"
}

# -- 3. Migrate the old flat knowledge base (if any) ---------------------------
if ((Test-Path $OldKb) -and ((Get-Item $OldKb).Length -gt 0)) {
    Write-Host "Found old knowledge base: $OldKb"

    $header = @'
# _INBOX — rules pending categorization (migrated from pre-0.12 flat knowledge base)

> These rules were NOT auto-assigned to a skill — the harness never assumes which skill
> owns a rule. Run `/coach` on the contents below: it will run GATE COACH-1 to have you
> assign each rule to task-executor, ba-pitch-analyzer, or qa-edge-hunter, then file it
> into the right `<skill>.md` here. Delete this file once the inbox is empty.

---

<!-- migrated from .shapeup-sdlc/knowledge-base.md -->

'@
    # Append (never clobber an existing inbox).
    Add-Content -Path $Inbox -Value $header -Encoding utf8
    Add-Content -Path $Inbox -Value (Get-Content $OldKb -Raw) -Encoding utf8
    Write-Host "Preserved old rules into $Inbox (pending /coach categorization — not auto-assigned)"

    # Retire the old file (stays under the gitignored .shapeup-sdlc/ root).
    Move-Item -Path $OldKb -Destination "$OldKb.migrated" -Force
    Write-Host "Retired old file -> $OldKb.migrated (gitignored backup; safe to delete)"
} else {
    Write-Host "No old .shapeup-sdlc/knowledge-base.md found — nothing to migrate (fresh-model setup only)."
}

# -- Done ----------------------------------------------------------------------
Write-Host ""
Write-Host "Migration complete — skills replaced for: $($Clis -join ' ')"
Write-Host "Next steps:"
Write-Host "  1. If $Inbox was created, run /coach on its rules to categorize them per skill."
Write-Host "  2. Commit docs/shapeup-sdlc/knowledge-base/ so your team inherits the guidelines on git pull."
