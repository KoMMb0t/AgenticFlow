# Annahmen

1. **Briefing-Quelle:** `/brief.md`, `/requirements.md` und `/research/` existieren
   nicht im Projektordner. Als Briefing gilt die `CLAUDE.md` (Abschnitt „NOCH ZU
   ERLEDIGEN") plus der vorhandene Code-Stand.
2. **Projekt-Schema:** Renderer-Seite ist führend — Projekte speichern Nachrichten
   in `messages` (nicht `chatHistory`). Der Main Process wird daran angepasst.
3. **IDs:** Vom Renderer erzeugte `instanceId`/`partition`/Projekt-IDs werden vom
   Main Process übernommen, nicht neu generiert (Multi-Account-Isolation).
4. **Netzwerk-Freigabe:** „Netzgabe"-Toggle = alle Konnektor-BrowserViews dürfen
   (true) oder dürfen nicht (false) ins Netz. Umsetzung über
   `session.webRequest.onBeforeRequest`-Block pro Partition. Default: erlaubt.
5. **Provider-Keys:** OpenAI-Key liegt unter `apiKeys.openai`, Gemini unter
   `apiKeys.gemini` (gespeichert über das Key-Einfügen-Panel der Keytools).
6. **BLE-Code-Kopplung:** Ohne echtes BLE-Pairing-Protokoll (PowerShell-Grenze)
   wird der 6-stellige Code app-seitig erzeugt und bestätigt; die eigentliche
   Kopplung bleibt `ble-pair-for-login` (Gerät-Merken im Store).
7. **Sprache:** Kommunikation/Doku Deutsch, Code Englisch (CLAUDE.md-Regel).
8. **Icons:** Das lila Oktopus-PNG (`agenticflow-octopus-icon.png`) ist das
   gewünschte App-Icon; alte Icons bleiben als Backup in `assets/backup_old_icons/`.
