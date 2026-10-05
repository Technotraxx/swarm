# 🃏 Questdeck

Produktivität als Kartenspiel: Jede Aufgabe ist eine Sammelkarte mit Motiv, Mana-Kosten (Aufwand), Seltenheit und Werten für Dringlichkeit und Wichtigkeit. Karten liegen auf einem Spieltisch, gehören zu Projekt-Decks, zahlen auf OKRs ein und sind über Abhängigkeiten verbunden. Erledigte Karten fliegen auf den Ablagestapel.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Logik-Tests (Critical Path, Planung, Alterung, Schnell-Eingabe, Zeiträume, CSV)
npm run build
```

Alle Daten liegen lokal im Browser (localStorage). Beim ersten Start gibt es ein Beispieldeck.

## Ebenen & Linsen

| | Ansicht | Wozu |
|---|---|---|
| **Ebene** | 🃏 **Task** | Spieltisch mit *Stapel* (Backlog), *Hand* (vorgenommen), *Im Spiel* (in Arbeit). **Hand ziehen** (Ziehstapel unten links oder `D`) füllt heute nach Priorität bis zur Kapazität und lässt Blockiertes liegen. Unten rechts die Ablage. |
| | 🗂️ **Projekt** | Jedes Projekt ist ein Deck mit Fortschritt und KR-Bezug. Karten aufs Deck ziehen = zuordnen. |
| | 🗺️ **Roadmap** | Projekte als Balken auf der Zeitachse (ziehen = verschieben, Ränder = Dauer), Karten mit Fälligkeit als Meilensteine, gruppiert nach Objective. |
| **Linse** | 🕸️ **Netz** | Karten frei anordnen und verbinden: Abhängigkeit, Blocker, Happy Path, Verzögerung, Entscheidung, Bezug. Linsen für **Critical Path**, **Blocker** und **RACI** pro Person. |
| | 📅 **Kapazität** | Persönliche Kapazitätsplanung. Tag/Woche: **Stundenraster** – Karten auf eine Uhrzeit ziehen, Blöcke verschieben, unten am Block die Dauer ziehen, „füllen“ plant einen Tag automatisch. Sprint/Monat als Tagesliste, Quartal/Jahr als Wochen-Heatmap. Kapazität und Arbeitsbeginn pro Wochentag bzw. Tag (Urlaub, Meetingtag). |
| | 🎯 **OKR** | Objectives & Key Results; Fortschritt aus erledigten Karten (nach Aufwand), optional kombiniert mit manuellem Messwert. |

Der **Zeitraum** (Tag · Woche · Sprint · Monat · Quartal · Jahr) oben rechts steuert Kalender, Roadmap, Ablage-Rückblick und die Auslastungsanzeige. Sprints sind 2 Wochen ab einem einstellbaren Anker-Montag.

## Schnell-Eingabe (`N` oder `/`)

```
Angebot schreiben #launch !4 ^5 ~2h @fr +sales https://…
```

`#projekt` (wird angelegt, wenn neu) · `!1–!5` / `!!!` Dringlichkeit · `^1–^5` Wichtigkeit · `~30m ~2h ~1d` Aufwand · `@heute @morgen @fr @12.10.` Fälligkeit · `+tag` · Links werden erkannt.
Passt der Text zu einer bestehenden Karte, hängt `Tab` ihn als ToDo an diese Karte an.

Tastenkürzel: `1–6` Ansichten · `D` Hand für heute ziehen · `⇧D` eine Karte ziehen · `[` `]` Zeitraum · `T` heute · `?` Hilfe · `Esc` schließen.

## Karten altern

Karten im Stapel oder auf der Hand, die niemand anfasst, setzen Staub an: ⏳ *liegt* ab 7 Tagen, *verstaubt* ab 14, 🕸️ *vergessen* ab 28. Sie werden sepiafarben und rutschen in der Priorität langsam nach oben. Verschieben, Planen, ToDos oder Notizen setzen die Uhr zurück.

## Import & Export (⇅)

- **JSON** – komplettes Deck (zusammenführen oder ersetzen)
- **CSV** – Import/Export; Spaltennamen von Jira/Trello (Summary, Priority, Due Date, Epic …) werden erkannt
- **ICS** – Zeitblöcke (mit Uhrzeit) und Fristen für jeden Kalender
- **Standup** – Markdown-Zusammenfassung des Zeitraums zum Einfügen in Slack

## Aufbau

```
src/
  types.ts            Datenmodell (Card, Link, Project, Objective, Settings)
  store.ts            Zustand-Store inkl. Persistenz und aller Aktionen
  seed.ts             Beispieldeck
  lib/                reine Logik: Zeiträume, Spielwerte, Graph (Critical Path), Planung (Hand ziehen, Zeitfenster, Alterung), Schnell-Eingabe, Import/Export
  components/         Karte (TCG), Drag & Drop, Stapel & Flug-Effekt, Detail-Drawer, Modals
  views/              Board, Projekte, Roadmap, Netz, Kapazität (inkl. Stundenraster), OKR
```

React 19 · TypeScript · Vite · framer-motion (Übergänge) · dnd-kit (Drag & Drop) · zustand · date-fns

## Ideen für die nächsten Runden

**Anbindungen**
- Kalender (Google/Outlook): belegte Termine reduzieren automatisch die Kapazität; Zeitblöcke werden echte Termine
- Jira: Issues ↔ Karten, Epics ↔ Projekte, Issue-Links ↔ Abhängigkeiten (Zwei-Wege-Sync)
- Slack: Nachricht per Emoji-Reaktion zur Karte machen, Daily-Standup posten, Blocker-Pings an Entscheider:innen
- OKR-Tool: Key Results und Messwerte synchronisieren
- Browser-Erweiterung / Share-Target: beliebige Seite als Karte mit Link einwerfen

**Spielmechanik**
- Tages-Quests („3 Karten aus der Hand spielen“), Wochen-Boss = größte offene Karte
- Combos: Karten desselben Projekts am Stück erledigen → Bonus-XP (belohnt weniger Kontextwechsel)
- Booster-Pack am Sprintstart: Vorschlag von 5 Karten passend zur freien Kapazität
- Fokus-Modus: eine Karte groß in der Mitte + Pomodoro-Timer, Zeit wird gegen den Aufwand gebucht
- Sammelalbum / Trophäen für Meilensteine, Jahresrückblick als „Deck des Jahres“

**Planung**
- Auto-Planer: verteilt offene Karten nach Priorität, Abhängigkeiten und Kapazität auf die Tage
- Prognose: wann ist ein Projekt bei aktueller Velocity fertig? Ampel auf der Roadmap
- Verzögerungen automatisch erkennen (Vorgänger fällig nach Nachfolger) und im Netz markieren
- Wiederkehrende Karten (z. B. Wochen-Retro), Vorlagen-Decks für typische Projekte
- Eisenhower-Matrix als weitere Linse (Dringlichkeit × Wichtigkeit)

**Plattform**
- Sync-Backend & Teams (geteilte Decks, RACI mit echten Personen)
- PWA/Offline, Desktop-Widget, globale Schnell-Eingabe per Tastenkürzel
- KI-Assistent: Karte aus Freitext/Mail erzeugen, Aufwand schätzen, Karten zerlegen
