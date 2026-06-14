#requires -Version 5.1
<#
    backup-tasks.ps1   (C:\Users\ModBot\AgenticFlow\tools)
    -----------------------------------------------------
    Spiegelt den PRIMAEREN Task-/Austausch-Ordner (kDrive bzw. ENV AGENTICFLOW_TASKS_DIR)
    auf ein oder mehrere BACKUP-Ziele (andere Clouds, z.B. OneDrive). Nutzt robocopy /MIR.

    Ziele:  ENV AGENTICFLOW_BACKUP_DIRS  (";"-getrennt)  oder  Default OneDrive.

    Aufruf:
      powershell -NoProfile -File backup-tasks.ps1
      powershell -NoProfile -File backup-tasks.ps1 -Source "<Quelle>" -Targets "<Ziel1>","<Ziel2>"
#>

[CmdletBinding()]
param(
    [string]$Source = "",
    [string[]]$Targets = @()
)

# ── Quelle aufloesen (Param > ENV > lokaler Default) ─────────────
if (-not $Source -or $Source.Trim() -eq "") {
    if ($env:AGENTICFLOW_TASKS_DIR) { $Source = $env:AGENTICFLOW_TASKS_DIR }
    else { $Source = "C:\Users\ModBot\AgenticFlow\MCP\Manus\tasks" }
}
if (-not (Test-Path $Source)) { Write-Host "[Backup] Quelle nicht vorhanden: $Source"; return }

# ── Ziele aufloesen (Param > ENV > Default OneDrive) ─────────────
if (-not $Targets -or $Targets.Count -eq 0) {
    if ($env:AGENTICFLOW_BACKUP_DIRS) {
        $Targets = ($env:AGENTICFLOW_BACKUP_DIRS -split ';') | Where-Object { $_.Trim() -ne "" }
    } else {
        $Targets = @("C:\Users\ModBot\OneDrive\AgenticFlow-Backup\tasks")
    }
}

foreach ($t in $Targets) {
    try {
        if (-not (Test-Path $t)) { New-Item -ItemType Directory -Path $t -Force | Out-Null }
        # /MIR spiegelt (inkl. done/), leise Ausgabe, schnelle Retries
        $null = robocopy $Source $t /MIR /R:1 /W:1 /NJH /NJS /NDL /NFL /NP
        $code = $LASTEXITCODE   # robocopy: 0-7 = OK, >=8 = Fehler
        if ($code -ge 8) { Write-Host "[Backup] FEHLER -> $t (robocopy $code)" }
        else { Write-Host "[Backup] OK -> $t (robocopy $code)" }
    } catch {
        Write-Host "[Backup] Ausnahme ($t): $($_.Exception.Message)"
    }
}
