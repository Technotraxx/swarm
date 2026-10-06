# Questdeck – Backlog

Arbeitspakete auf dem Weg zur [Vision](VISION.md), gruppiert nach Ausbaustufe. Offene Entscheidungen,
die einzelne Pakete blockieren, stehen in [Offene Fragen](OPEN_QUESTIONS.md) (`Q-NNN`).

**Statuscodes** (wie in MadMemo):
`[ ]` offen · `[>]` in Arbeit · `[x]` erledigt · `[!]` blockiert (Grund dahinter) · `[?]` braucht Entscheidung · `[~]` verworfen

---

## Stufe 0 – Lokales Kartendeck (Stand)

- [x] Karten im Sammelkarten-Stil, Tisch mit Stapel, Hand, „Im Spiel“, Ablage mit Flug-Effekt
- [x] Ebenen Task → Projekt → Initiative mit Rollup von Aufwand, Fortschritt und Key Results
- [x] Abhängigkeitsnetz mit Critical Path, Blockern, RACI-Linse
- [x] Kapazität mit Stundenraster, „Hand ziehen“, Alterung von Karten
- [x] OKRs, Roadmap, Schnell-Eingabe, Import/Export (JSON, CSV, ICS), Standup-Text
- [x] Optiken Dunkel, Hell, Folio
- [ ] **QD-001** Wiederkehrende Karten (z. B. Wochen-Retro), Vorlagen-Decks
- [ ] **QD-002** Eisenhower-Matrix als weitere Linse
- [ ] **QD-003** Fokus-Modus mit Timer; Zeit wird gegen den Aufwand gebucht
- [ ] **QD-004** PWA (installierbar, offline), globales Tastenkürzel für die Schnell-Eingabe
- [ ] **QD-005** Tages-Quests (z. B. „3 Karten aus der Hand spielen“) und Combos: Karten desselben Projekts am Stück erledigen gibt Bonus-XP
- [ ] **QD-006** Booster-Pack zum Sprintstart: 5 Kartenvorschläge passend zur freien Kapazität
- [ ] **QD-007** Prognose auf der Roadmap: Fertigstellung bei aktuellem Tempo, Ampel je Projekt
- [ ] **QD-008** Verzögerungen automatisch erkennen (Vorgänger später fällig als Nachfolger) und im Netz markieren
- [ ] **QD-009** Sammelalbum und Jahresrückblick („Deck des Jahres“)

## Stufe 1 – Fundament: Server, Login, Datenbank, Deployment

- [?] **DEP-001** Hosting- und Plattform-Entscheidung treffen → Q-001, Q-002
- [ ] **DEP-002** Backend-Grundgerüst (API, Healthchecks, Konfiguration, Logging)
- [ ] **DEP-003** SSO-Login über Microsoft Entra ID (OIDC), Sitzungen, Abmelden
- [ ] **DEP-004** Datenbank-Schema für Karten, Links, Objectives, Einstellungen; Migrationen
- [ ] **DEP-005** Sync zwischen lokalem Store und Server (offline-fähig, Konflikte nachvollziehbar) → Q-002
- [ ] **DEP-006** Datei-Storage für Anhänge, Transkripte und Kartenbilder
- [ ] **DEP-007** Audit-Log für Aktionen von Nutzern, Integrationen und Agents
- [ ] **DEP-008** Secrets je Nutzer für Connector-Tokens (verschlüsselt, rotierbar)
- [ ] **DEP-009** CI/CD mit Staging und Produktion, automatische Tests vor dem Deploy
- [ ] **DEP-010** Backups, Monitoring, Fehler-Tracking, Runbooks (Deploy, Debug, Restore)
- [ ] **DEP-011** Migration der lokalen Browser-Daten ins Konto beim ersten Login

## Stufe 2 – Angebunden: Outlook und MCP

### Outlook-Kalender
- [!] **CAL-001** Termine lesen (Microsoft Graph); blockiert durch DEP-003 → Q-003
- [ ] **CAL-002** Termine verringern die freie Kapazität im Stundenraster
- [ ] **CAL-003** Zeitblöcke von Karten optional als Outlook-Termine anlegen und aktuell halten
- [ ] **CAL-004** Meetings als Karten (Teilnehmende → RACI, Agenda → Beschreibung)

### Outlook-Mail
- [!] **MAIL-001** Mail → Karte (Betreff, Absender, Link zurück); blockiert durch DEP-003
- [ ] **MAIL-002** Geflaggte Mails bzw. eine Outlook-Kategorie landen automatisch im Eingang
- [ ] **MAIL-003** Weiterleitungsadresse für Karten (analog MadMemo-Ingest), inkl. Kommandos `[neu]`, `[fertig:…]`
- [ ] **MAIL-004** Antwortentwurf aus einer Karte heraus (Freigabe vor dem Senden)

### MCP
- [ ] **MCP-001** Connector-Übersicht: MCP-Server hinzufügen, Status, Berechtigungen, Tokens
- [ ] **MCP-002** Jira/Confluence über MCP anbinden (lesen)
- [ ] **MCP-003** Slack über MCP anbinden (lesen, Entwürfe)
- [ ] **MCP-004** Miro und Figma über MCP anbinden (Boards/Frames verknüpfen)
- [ ] **MCP-005** GitHub anbinden (PRs, CI-Status, Reviews)
- [ ] **MCP-006** Questdeck als MCP-Server: `list_cards`, `get_card`, `create_card`, `update_card`, `complete_card`, `plan_day`, `link_cards`
- [ ] **MCP-007** Rechte für den MCP-Server (welcher Client darf lesen/schreiben, Freigabe für Schreibzugriffe)

## Stufe 3 – KI-Assistenz

- [?] **AI-001** Modellzugang festlegen (Bedrock wie MadMemo oder Anthropic API) → Q-004
- [ ] **AI-002** Freigabe-Warteschlange: alle KI-Entwürfe erscheinen als Vorschlag mit Annehmen/Ändern/Verwerfen
- [ ] **AI-003** Ticket erstellen: Karte → strukturierter Jira-Entwurf (Story, Bug, Spike …) → nach Freigabe anlegen und verknüpfen
- [ ] **AI-004** Jira-Import: Epics → Projekte, Initiativen → Initiativen, Issues → Karten, inkl. Links
- [ ] **AI-005** Jira-Abgleich in beide Richtungen (Status, Fälligkeit, Kommentare, Worklogs) → Q-008
- [ ] **AI-006** Status-Update verfassen für Projekt/Initiative aus Verlauf, Logbuch und erledigten Karten
- [ ] **AI-007** Meeting → Tasks: Transkript/Notizen hochladen, Zusammenfassung, Entscheidungen, Aufgaben als Karten
- [ ] **AI-008** Meeting-Transkripte direkt aus Teams übernehmen
- [ ] **AI-009** Miro/Figma: Stickies bzw. Kommentare als Karten übernehmen; Netz als Board exportieren
- [ ] **AI-010** Tagesbriefing (morgens) und Wochenrückblick (freitags)
- [ ] **AI-011** Aufwand schätzen und große Karten zerlegen
- [ ] **AI-012** Schnell-Eingabe in natürlicher Sprache („nächsten Dienstag Angebot für X fertig machen“)

## Stufe 4 – Agents, Automatisierung, Routinen

- [?] **AGT-001** Agent-Runtime festlegen (Claude Code headless wie MadMemo ADR-017, Agent SDK, Managed Agents) → Q-005
- [ ] **AGT-002** Karte an Agent übergeben: Ziel, Kontext, Repo/Ziel-System, Grenzen, Budget
- [ ] **AGT-003** Live-Status des Agents auf der Karte (Schritte, Logs, Kosten)
- [ ] **AGT-004** Rückmeldung bei Fertigstellung: Ergebnis zur Abnahme, danach Ablage
- [ ] **AGT-005** Routinen: zeitgesteuerte oder ereignisgesteuerte Abläufe mit Protokoll je Lauf
- [ ] **AGT-006** Vorlagen für Routinen: Jira-Abgleich, Postfach-Triage, Wochenreport, Ticket-Hygiene, Abhängigkeits-Check
- [ ] **AGT-007** Git-Fortschritt an Karten: PR-Status, CI, Reviews; rote Checks als Blocker im Netz
- [ ] **AGT-008** Kosten-Budget je Agent und Routine, Abbruch bei Überschreitung

## Stufe 5 – Zusammenarbeit

- [ ] **COL-001** Mehrere Nutzer, Teams, Rollen
- [ ] **COL-002** Decks, Projekte und Initiativen teilen (lesen / bearbeiten / verwalten); privat als Standard
- [ ] **COL-003** RACI mit echten Personen aus dem Verzeichnis, Übergabe von Karten mit Kontext
- [ ] **COL-004** Kommentare, Erwähnungen, Benachrichtigungen (gebündelt, ruhig)
- [ ] **COL-005** Echtzeit-Zusammenarbeit im Netz und auf der Roadmap, Präsenz
- [ ] **COL-006** Team-Kapazität und Engpässe
- [ ] **COL-007** Gemeinsame OKRs und Roadmap über Teams hinweg

## MadMemo-Integration

- [ ] **MEM-001** MadMemo-MCP (`search`, `fetch`) als Connector anbinden
- [ ] **MEM-002** Passende Wiki-Artikel auf der Karte anzeigen (Titel, Tags, Projekt)
- [ ] **MEM-003** Kartenvorschläge aus dem MadMemo-Ingest (Aufgaben, Fristen, Entscheidungen) im Questdeck-Eingang
- [ ] **MEM-004** Projekt-Dossier bzw. Retro aus Questdeck ins Wiki schreiben (über Freigabe)
- [ ] **MEM-005** Gemeinsame Kommando-Syntax `[neu]`, `[update:slug]`, `[fertig:slug]` für Karten und Wiki
- [ ] **MEM-006** Gemeinsamer Eingangs-Router: Wissen → Wiki, Arbeit → Karte, beides verknüpft
- [?] **MEM-007** Gemeinsame Plattform (Identität, Modellzugang, Audit-Log, Admin-UI) → Q-006
