# 🃏 Questdeck

Produktivität als Kartenspiel: Jede Aufgabe ist eine Sammelkarte mit Motiv, Mana-Kosten (Aufwand), Seltenheit und Werten für Dringlichkeit und Wichtigkeit. Karten liegen auf einem Spieltisch, gehören zu Projekt-Decks, zahlen auf OKRs ein und sind über Abhängigkeiten verbunden. Erledigte Karten fliegen auf den Ablagestapel.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # Logik-Tests (Ebenen, Migration, Critical Path, Planung, Alterung, Schnell-Eingabe, Zeiträume, CSV)
npm run build
```

Alle Daten liegen lokal im Browser (localStorage). Beim ersten Start gibt es ein Beispieldeck.

## Drei Ebenen: Task → Projekt → Initiative

Wie Story, Epic und Initiative in Jira – nur dass alles Karten sind. Jede Karte hat eine **Ebene** und optional eine **Elternkarte**: Tasks hängen an einem Projekt (oder direkt an einer Initiative), Projekte an einer Initiative. Projekte und Initiativen tragen Farbe, Start/Ende und Key Results; Aufwand, Fortschritt und KR-Beitrag rechnen sich automatisch aus den Tasks darunter zusammen. Projekte haben epische, Initiativen legendäre Rahmen und liegen sichtbar „gestapelt“.

## Ebenen & Linsen

| | Ansicht | Wozu |
|---|---|---|
| **Ebene** | 🃏 **Task** | Spieltisch mit *Stapel* (Backlog), *Hand* (vorgenommen), *Im Spiel* (in Arbeit). **Hand ziehen** (Ziehstapel unten links oder `D`) füllt heute nach Priorität bis zur Kapazität und lässt Blockiertes liegen. Unten rechts die Ablage. |
| | 🗂️ **Projekt** | Projekte als Decks, gruppiert unter ihren Initiativen. Tasks aufs Deck ziehen = zuordnen, Projektkarte auf eine Initiative ziehen = umhängen. |
| | 🗺️ **Roadmap** | Initiativen und ihre Projekte als Balken auf der Zeitachse (ziehen = verschieben, Ränder = Dauer), Tasks mit Fälligkeit als Meilensteine. |
| **Linse** | 🕸️ **Netz** | Karten frei anordnen und verbinden: Abhängigkeit, Blocker, Happy Path, Verzögerung, Entscheidung, Bezug. Linsen für **Critical Path**, **Blocker** und **RACI** pro Person. Filter nach Ebene; „Alle Ebenen“ zeigt zusätzlich die Hierarchie als gepunktete Linien. |
| | 📅 **Kapazität** | Persönliche Kapazitätsplanung. Tag/Woche: **Stundenraster** – Karten auf eine Uhrzeit ziehen, Blöcke verschieben, unten am Block die Dauer ziehen, „füllen“ plant einen Tag automatisch. Sprint/Monat als Tagesliste, Quartal/Jahr als Wochen-Heatmap. Kapazität und Arbeitsbeginn pro Wochentag bzw. Tag (Urlaub, Meetingtag). |
| | 🎯 **OKR** | Objectives & Key Results; Fortschritt aus erledigten Karten (nach Aufwand), optional kombiniert mit manuellem Messwert. |

Der **Zeitraum** (Tag · Woche · Sprint · Monat · Quartal · Jahr) oben rechts steuert Kalender, Roadmap, Ablage-Rückblick und die Auslastungsanzeige. Sprints sind 2 Wochen ab einem einstellbaren Anker-Montag.

## Schnell-Eingabe (`N` oder `/`)

```
Angebot schreiben #launch !4 ^5 ~2h @fr +sales https://…
```

`#projekt` (wird angelegt, wenn neu) · `=projekt` / `=initiative` legt ein Projekt bzw. eine Initiative an · `!1–!5` / `!!!` Dringlichkeit · `^1–^5` Wichtigkeit · `~30m ~2h ~1d` Aufwand · `@heute @morgen @fr @12.10.` Fälligkeit · `+tag` · Links werden erkannt.
Passt der Text zu einer bestehenden Karte, hängt `Tab` ihn als ToDo an diese Karte an.

Tastenkürzel: `1–6` Ansichten · `D` Hand für heute ziehen · `⇧D` eine Karte ziehen · `[` `]` Zeitraum · `T` heute · `?` Hilfe · `Esc` schließen.

## Optik

Oben rechts umschalten: **Dunkel**, **Hell** oder **Folio** – ruhige Papierkarten mit Serifenschrift, Mustern statt Farbverläufen und Stunden/Dringlichkeits-Punkten im Kartenkopf. Für alle, die Questdeck den ganzen Tag offen haben.

## Karten altern

Karten im Stapel oder auf der Hand, die niemand anfasst, setzen Staub an: ⏳ *liegt* ab 7 Tagen, *verstaubt* ab 14, 🕸️ *vergessen* ab 28. Sie werden sepiafarben und rutschen in der Priorität langsam nach oben. Verschieben, Planen, ToDos oder Notizen setzen die Uhr zurück.

## Import & Export (⇅)

- **JSON** – komplettes Deck (zusammenführen oder ersetzen); ältere Exporte mit separaten Projekten werden automatisch umgewandelt
- **CSV** – Import/Export; Spaltennamen von Jira/Trello (Summary, Priority, Due Date, Issue Type, Epic Link …) werden erkannt, Epics werden zu Projekten und Stories hängen sich automatisch darunter
- **ICS** – Zeitblöcke (mit Uhrzeit) und Fristen für jeden Kalender
- **Standup** – Markdown-Zusammenfassung des Zeitraums zum Einfügen in Slack

## Aufbau

```
src/
  types.ts            Datenmodell (Card mit Ebene/Elternkarte, Link, Objective, Settings)
  store.ts            Zustand-Store inkl. Persistenz und aller Aktionen
  seed.ts             Beispieldeck
  lib/                reine Logik: Zeiträume, Spielwerte, Ebenen/Hierarchie (inkl. Migration), Graph (Critical Path), Planung (Hand ziehen, Zeitfenster, Alterung), Schnell-Eingabe, Import/Export
  components/         Karte (TCG), Drag & Drop, Stapel & Flug-Effekt, Detail-Drawer, Modals
  views/              Board, Projekte, Roadmap, Netz, Kapazität (inkl. Stundenraster), OKR
```

React 19 · TypeScript · Vite · framer-motion (Übergänge) · dnd-kit (Drag & Drop) · zustand · date-fns

## Vision & Roadmap

Questdeck soll zur Steuerzentrale für den Arbeitstag werden: Outlook-Kalender und -Mail, MCP-Anbindungen (Jira, Slack, Miro, Figma, GitHub), KI-Assistenz, Agents und Routinen, Team-Funktionen, sauberes Deployment mit SSO – und eine enge Verzahnung mit dem Wissensgedächtnis MadMemo.

- [docs/VISION.md](docs/VISION.md) – Leitprinzipien, Ausbaustufen, MadMemo-Integration, Zielarchitektur
- [docs/BACKLOG.md](docs/BACKLOG.md) – Arbeitspakete je Stufe mit IDs und Status
- [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) – Entscheidungen, die vorher fallen müssen
