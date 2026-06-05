# Arbeitsplan — AgenticFlow v1.0 Fertigstellung

Stand: 2026-06-05 · Briefing-Quelle: CLAUDE.md („NOCH ZU ERLEDIGEN")

## Befund (Code-Sichtung)

Die modulare v1.0-Struktur ist weitgehend da (utils, accounts, sidebar, center,
memory, keytools, taskbar, auth + neuer renderer.js und index.html). Beim
Zusammenführen sind aber Brüche zwischen Renderer und Main Process entstanden:

| # | Problem | Wirkung |
|---|---------|---------|
| 1 | `add-connector` (main.js) erwartet altes Template-Format, Module senden komplette Account-Objekte mit eigener `partition` | BrowserViews für neue Accounts werden nie erzeugt → Slide-in kaputt |
| 2 | Kein Modul ruft mehr `updateLayout` auf | `centerBounds` bleibt null → BrowserViews unsichtbar |
| 3 | `claude-message`/`claude-stream` ignorieren `system`/`maxTokens` der Module | Taskbar-Rollen & Memory-Prompts wirkungslos |
| 4 | `project-create` überschreibt die Renderer-ID, `project-add-message` schreibt in `chatHistory` statt `messages` | Projekte/Verläufe gehen beim Neustart verloren |
| 5 | `projectDelete` + `setNetworkAccess` fehlen in preload.js und als IPC-Handler | Projekt-Löschen & Netzwerk-Toggle ohne Funktion |
| 6 | Kein Provider-Umschalter in der neuen UI (claude-api.js kann bereits OpenAI/Gemini) | Nur Claude nutzbar |
| 7 | BLE-Modal (`ble-modal`, `btn-ble-pair`) ohne JS-Verdrahtung | TODO 6 (Code-Kopplung) offen |
| 8 | Oktopus-PNG liegt im Root, Icons sind noch alt | TODO Icon |

## Schritte

1. **main.js** — `add-connector` akzeptiert volle Account-Objekte (instanceId +
   partition wiederverwenden, Duplikate ignorieren); `set-network-access`-Handler
   mit echter Durchsetzung (webRequest-Block auf allen View-Sessions).
2. **renderer.js** — `sendLayout()` einführen: misst `#center-panel` und sendet
   `updateLayout` bei app-open/app-close, Fenster-Resize und Sidebar-Toggles.
3. **claude-api.js** — `system`/`maxTokens`-Override in beiden Handlern;
   `project-create` behält Renderer-ID; `project-add-message` → `messages`;
   neuer `project-delete`-Handler.
4. **preload.js** — `projectDelete`, `setNetworkAccess` ergänzen.
5. **Provider-Umschalter** — Dropdown im Projekt-Chat (Claude/OpenAI/Gemini),
   center.send() übergibt provider + passenden Key (apiKeys.openai/gemini).
6. **BLE-Code-Kopplung** — 6-stelliger Pairing-Code im BLE-Modal: Code wird
   generiert, angezeigt, bestätigt, dann `blePairForLogin`.
7. **Icons** — `agenticflow-octopus-icon.png` → icon.ico (16–256) + PNG-Größen.
8. **Verifikation** — node --check aller JS-Dateien, Abgleich window.api ↔
   preload ↔ IPC-Handler, HTML-ID-Abgleich.

## Nicht in diesem Durchlauf

- Mikrofon/Sprachassistent: bereits in renderer-center.js umgesetzt (Web Speech API).
- Echte OAuth-Flows pro Dienst (Auth-Menü simuliert nur die Methode-Wahl).
- electron-builder-Release.
