# Questdeck – Offene Fragen

Entscheidungen, die vor einzelnen Backlog-Paketen getroffen werden müssen. Jede Frage hat eine ID
(`Q-NNN`). Ist sie beantwortet, wandert die Antwort als Entscheidung in eine `DECISIONS.md`
(ADR-Format wie in MadMemo) und die Frage wird hier als **beantwortet** markiert.

---

### Q-001 · Wo läuft das Backend?
**Blockiert:** DEP-001 ff.
Optionen: im bestehenden AWS-Account neben MadMemo (eu-central-1, gleiches Ingress- und
Zertifikats-Muster), eigener Container-Dienst (z. B. ECS/EKS) oder ein PaaS (Vercel, Fly.io,
Cloudflare). Kriterien: Datensouveränität, Betriebsaufwand, Nähe zu Bedrock/MadMemo, Kosten.

### Q-002 · Local-first oder server-first?
**Blockiert:** DEP-004, DEP-005
Local-first (CRDT, z. B. Yjs oder Automerge, Server als Sync-Knoten) hält die App schnell und
offline-fähig, ist aber komplexer. Server-first (Postgres als Wahrheit, Browser als Cache) ist
einfacher, braucht für Offline mehr Logik. Für Stufe 5 (Echtzeit im Team) wird das wichtig.

### Q-003 · Outlook direkt über Microsoft Graph oder über einen MCP-Server?
**Blockiert:** CAL-001, MAIL-001
Graph direkt: volle Kontrolle, Webhooks für Änderungen, aber eigener OAuth-Flow und Token-Pflege.
MCP: einheitlich mit den anderen Anbindungen, aber Änderungs-Benachrichtigungen und Rechte
müssen geklärt sein. Außerdem: welche Graph-Berechtigungen (Calendars.ReadWrite, Mail.Read …) gibt
die IT frei?

### Q-004 · Welcher Modellzugang?
**Blockiert:** AI-001
Amazon Bedrock (wie MadMemo, IAM-Rolle statt API-Key, Daten in der EU) oder Anthropic API direkt.
Einheitlich mit MadMemo wäre einfacher für Betrieb, Kosten-Reporting und Freigaben.

### Q-005 · Welche Agent-Runtime?
**Blockiert:** AGT-001
Kandidaten: Claude Code headless (in MadMemo per ADR-017 bereits erprobt), Claude Agent SDK, gehostete
Agents. Kriterien: Repo-Zugriff, Sandbox, Kostenkontrolle, Status-Rückmeldung an Questdeck,
Freigabe-Punkte.

### Q-006 · Gemeinsame Plattform mit MadMemo?
**Blockiert:** MEM-007
Teilen sich Questdeck und MadMemo Identität, Datenbank, Audit-Log und Admin-UI, oder bleiben es zwei
Dienste, die nur über MCP sprechen? Eine Plattform spart Betrieb, koppelt aber die Releases.

### Q-007 · Datenschutz und Freigaben
**Betrifft:** MAIL-*, AI-*, AGT-*
Mail-Inhalte, Meeting-Transkripte und Kalenderdaten laufen durch ein Sprachmodell. Was braucht es
dafür (Datenschutz, Betriebsrat, IT-Sicherheit)? Gilt die MadMemo-Freigabe mit?

### Q-008 · Wer ist die Quelle der Wahrheit bei Jira-Karten?
**Blockiert:** AI-005
Bei Konflikten (Status in Jira geändert, Karte in Questdeck auch): gewinnt Jira, gewinnt die letzte
Änderung, oder wird nachgefragt? Welche Felder werden überhaupt abgeglichen?

### Q-009 · Desktop-App oder Browser?
**Betrifft:** QD-004
Reicht eine installierbare PWA für „immer offen“ und globale Tastenkürzel, oder braucht es eine
Desktop-Hülle (Tauri/Electron) für Systemintegration (Tray, globale Hotkeys, Benachrichtigungen)?

### Q-010 · Welche gestalterische Richtung?
**Blockiert:** DS-016
A „Sammelkarten, aber echt“ (gedruckte TCG-Karten, Setsymbole, Sammlernummer, Folie nur für
Legendäres) oder B „Karteikasten“ (DIN-A7-Karteikarten, Reiter, Stempel, Schreibmaschinen-Zahlen).
Details im [Design-Review](DESIGN_REVIEW.md#4-gestalterische-richtung).
