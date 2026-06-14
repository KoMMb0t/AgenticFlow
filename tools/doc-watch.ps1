#requires -Version 5.1
<#
    doc-watch.ps1   (C:\Users\ModBot\AgenticFlow\tools)
    ---------------------------------------------------
    Prueft regelmaessig das AgenticFlow-Repo auf Aenderungen (neue Commits + uncommittete
    Dateien). Bei Aenderungen erzeugt es ein TASK-PAKET fuer Manus unter
    MCP\Manus\tasks\doc-task-<timestamp>.md.

    Die eigentliche Schreibarbeit (DOCUMENTATION.md erweitern) macht Manus
    (siehe MCP\Manus\MANUS-DOC-AGENT.md). Dieses Skript schreibt KEINE Prosa,
    nutzt KEINE KI und ist daher schnell + guenstig.

    Aufruf:
      manuell:        powershell -NoProfile -File doc-watch.ps1
      Scheduled (BG): powershell -NoProfile -File doc-watch.ps1 -Background
#>

[CmdletBinding()]
param(
    [string]$Repo = "C:\Users\ModBot\AgenticFlow",
    # Zielordner fuer Task-Pakete. Leer = ENV AGENTICFLOW_TASKS_DIR, sonst lokal im Repo.
    # -> kann auf einen Cloud-synchronisierten Ordner zeigen (Nextcloud / kDrive / OneDrive).
    [string]$TasksDir = "",
    [switch]$Background
)

$Self = $PSCommandPath
if (-not $Self) { $Self = "C:\Users\ModBot\AgenticFlow\tools\doc-watch.ps1" }

# Task-Zielordner aufloesen: Param > ENV AGENTICFLOW_TASKS_DIR > lokaler Default.
if (-not $TasksDir -or $TasksDir.Trim() -eq "") {
    if ($env:AGENTICFLOW_TASKS_DIR) { $TasksDir = $env:AGENTICFLOW_TASKS_DIR }
    else { $TasksDir = Join-Path $Repo "MCP\Manus\tasks" }
}

if ($Background) {
    Start-Process -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-File", "`"$Self`"", "-Repo", "`"$Repo`"", "-TasksDir", "`"$TasksDir`"") `
        -WindowStyle Hidden | Out-Null
    return
}

$toolsDir  = Join-Path $Repo "tools"
$stateFile = Join-Path $toolsDir "doc-watch.state"
$logFile   = Join-Path $toolsDir "doc-watch.log"
$tasksDir  = $TasksDir
$doneDir   = Join-Path $tasksDir "done"

foreach ($d in @($toolsDir, $tasksDir, $doneDir)) {
    if (-not (Test-Path $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
}

function Write-Log([string]$m) {
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Add-Content -Path $logFile -Value "[$ts] $m" -Encoding UTF8
    Write-Host "[$ts] $m"
}

# HEAD ermitteln
$head = (& git -C $Repo rev-parse HEAD 2>$null)
if (-not $head) { Write-Log "Kein Git-Repo / kein HEAD unter $Repo"; return }

# Letzten verarbeiteten Commit lesen
$last = ""
if (Test-Path $stateFile) { $last = (Get-Content $stateFile -Raw).Trim() }

# Uncommittete Aenderungen
$dirty = @(& git -C $Repo status --porcelain 2>$null)

if ($last -eq $head) {
    Write-Log "Keine neuen Commits seit letztem Lauf (HEAD $($head.Substring(0,7)); $($dirty.Count) uncommittete Dateien -> kein Task)."
    return
}

# Aenderungs-Infos sammeln
if ($last) {
    $range    = "$last..HEAD"
    $commits  = @(& git -C $Repo log --oneline "$last..HEAD" 2>$null)
    $diffstat = @(& git -C $Repo diff --stat "$last..HEAD" 2>$null)
} else {
    $range    = "ERSTLAUF (letzte 10 Commits)"
    $commits  = @(& git -C $Repo log --oneline -n 10 2>$null)
    $diffstat = @("(Erstlauf - bitte gesamte DOCUMENTATION.md gegen aktuellen Stand pruefen)")
}

$commitsTxt  = if ($commits.Count)  { $commits  -join "`n" }  else { "(keine neuen Commits)" }
$diffstatTxt = if ($diffstat.Count) { $diffstat -join "`n" } else { "(keine)" }
$dirtyTxt    = if ($dirty.Count)    { $dirty    -join "`n" } else { "(keine)" }

$stamp    = Get-Date -Format "yyyyMMdd-HHmmss"
$taskFile = Join-Path $tasksDir "doc-task-$stamp.md"

$task = @"
# Doc-Update-Task fuer Manus  ($stamp)

Repo:  $Repo
Range: $range
HEAD:  $head

> Anleitung: siehe ..\MANUS-DOC-AGENT.md
> Ziel:      C:\Users\ModBot\AgenticFlow\DOCUMENTATION.md

## Neue/geaenderte Commits
$commitsTxt

## Geaenderte Dateien (diff --stat)
$diffstatTxt

## Uncommittete Arbeitsdateien (git status --porcelain)
$dirtyTxt

## Auftrag
Aktualisiere DOCUMENTATION.md entsprechend der obigen Aenderungen:
- neue src/-Module     -> Abschnitt 4 (Modul-Tabelle)
- neue/geaenderte API  -> Abschnitt 5
- neue MCP-Server/Tools-> Abschnitt 6
- neue Ordner          -> Abschnitt 3
- erledigte TODOs      -> Abschnitt 10 abhaken

Danach:
1. Changelog-Zeile an _CHANGELOG.md anhaengen.
2. Diese Task-Datei nach done\ verschieben.
3. Commit-Vorschlag: docs: DOCUMENTATION.md aktualisiert ($stamp)
"@

Set-Content -Path $taskFile -Value $task -Encoding UTF8
Set-Content -Path $stateFile -Value $head -Encoding UTF8

# Changelog-Hinweis (offen)
$clFile = Join-Path $tasksDir "_CHANGELOG.md"
if (-not (Test-Path $clFile)) { Set-Content -Path $clFile -Value "# Doc-Update Changelog`n" -Encoding UTF8 }

Write-Log "Aenderungen erkannt -> Task erzeugt: $taskFile ($($commits.Count) Commits, $($dirty.Count) uncommittete Dateien)"

# Cloud-Backup der Tasks auf die anderen Clouds (OneDrive etc.)
$backupScript = Join-Path $toolsDir "backup-tasks.ps1"
if (Test-Path $backupScript) {
    try { & $backupScript -Source $tasksDir 2>&1 | Out-Null; Write-Log "Cloud-Backup der Tasks ausgefuehrt." }
    catch { Write-Log "Cloud-Backup fehlgeschlagen: $($_.Exception.Message)" }
}
