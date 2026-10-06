import { useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { parseISO } from 'date-fns'
import { useStore } from '../store'
import { csvImportCards, csvToCards, download, exportCSV, exportICS, exportJSON, parseCSV, parseJSON, standupMarkdown } from '../lib/io'
import { ConfirmButton } from './Inline'
import { horizonLabel, horizonRange, today } from '../lib/dates'
import { dayStartOf } from '../lib/schedule'

export function Modal({ onClose, children, wide }: { onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <motion.div className="backdrop center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className={`modal ${wide ? 'wide' : ''}`}
        initial={{ scale: 0.9, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 10, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

export function IOModal() {
  const st = useStore.getState()
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const fileRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'merge' | 'replace'>('merge')
  const [msg, setMsg] = useState('')
  const close = () => st.toggleIO(false)

  const data = () => {
    const s = useStore.getState()
    return { cards: s.cards, links: s.links, objectives: s.objectives, settings: s.settings, stats: s.stats }
  }

  const onFile = async (f: File) => {
    try {
      const text = await f.text()
      if (f.name.endsWith('.csv')) {
        const rows = csvToCards(parseCSV(text))
        const cards = csvImportCards(rows, useStore.getState().cards)
        st.importData({ cards }, 'merge')
        const created = cards.length - rows.length
        setMsg(`✅ ${rows.length} Karten aus CSV importiert${created ? ` · ${created} neue Projekte angelegt` : ''}`)
      } else {
        const d = parseJSON(text)
        st.importData(d, mode)
        setMsg(`✅ ${d.cards?.length ?? 0} Karten importiert (${mode === 'merge' ? 'zusammengeführt' : 'ersetzt'})`)
      }
    } catch (e) {
      setMsg(`⚠️ Import fehlgeschlagen: ${(e as Error).message}`)
    }
  }

  const copyStandup = async () => {
    const range = horizonRange(horizon, parseISO(cursor), settings)
    const md = standupMarkdown(useStore.getState().cards, range, horizonLabel(horizon, parseISO(cursor), settings))
    await navigator.clipboard.writeText(md).catch(() => download('standup.md', md, 'text/markdown'))
    setMsg('📋 Standup in die Zwischenablage kopiert – einfach in Slack einfügen')
  }

  const stamp = today()

  return (
    <Modal onClose={close} wide>
      <div className="row-between">
        <h2>⇅ Import, Export & Anbindungen</h2>
        <button className="ghost" onClick={close}>
          ✕
        </button>
      </div>

      <div className="io-grid">
        <section className="io-box">
          <h4>Export</h4>
          <button onClick={() => download(`questdeck-${stamp}.json`, exportJSON(data()))}>💾 Komplettes Deck (JSON)</button>
          <button onClick={() => download(`questdeck-${stamp}.csv`, exportCSV(useStore.getState().cards), 'text/csv')}>📄 Karten als CSV</button>
          <button onClick={() => download(`questdeck-${stamp}.ics`, exportICS(useStore.getState().cards, dayStartOf(settings)), 'text/calendar')}>
            📅 Zeitblöcke & Fristen (ICS)
          </button>
          <button onClick={copyStandup}>💬 Standup für Slack kopieren</button>
        </section>

        <section className="io-box">
          <h4>Import</h4>
          <div className="seg small">
            <button className={mode === 'merge' ? 'active' : ''} onClick={() => setMode('merge')}>
              Zusammenführen
            </button>
            <button className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>
              Ersetzen
            </button>
          </div>
          <div
            className="dropzone"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const f = e.dataTransfer.files[0]
              if (f) onFile(f)
            }}
          >
            JSON- oder CSV-Datei hierher ziehen
            <small>CSV-Spalten: title, description, effort, urgency, due, project, tags … (Jira-/Trello-Exporte funktionieren meist direkt)</small>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,.csv"
            hidden
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
        </section>
      </div>
      {msg && <div className="callout">{msg}</div>}

      <section className="io-box">
        <h4>Anbindungen</h4>
        <div className="integrations">
          {[
            ['📅', 'Kalender', 'Google / Outlook: Zeitblöcke als Termine, freie Slots als Kapazität'],
            ['🧩', 'Jira', 'Issues ↔ Karten, Epics ↔ Projekte, Links ↔ Abhängigkeiten'],
            ['💬', 'Slack', 'Nachricht → Karte, tägliches Standup, Blocker-Pings'],
            ['🎯', 'OKR-Tool', 'Objectives & Key Results synchronisieren'],
          ].map(([icon, name, desc]) => (
            <div key={name} className="integration">
              <span>{icon}</span>
              <div>
                <b>{name}</b>
                <small>{desc}</small>
              </div>
              <span className="badge">bald</span>
            </div>
          ))}
        </div>
      </section>

      <div className="row-between">
        <ConfirmButton className="ghost" ask="Ersetzt deine Karten – sicher?" onConfirm={() => st.resetDemo()}>
          🎲 Beispieldeck laden
        </ConfirmButton>
        <ConfirmButton ask="Wirklich alles löschen?" onConfirm={() => st.clearAll()}>
          Alles leeren
        </ConfirmButton>
      </div>
    </Modal>
  )
}

export function HelpModal() {
  const close = () => useStore.getState().toggleHelp(false)
  return (
    <Modal onClose={close} wide>
      <div className="row-between">
        <h2>🃏 So spielt man Questdeck</h2>
        <button className="ghost" onClick={close}>
          ✕
        </button>
      </div>
      <div className="help">
        <section>
          <h4>Schnell-Eingabe</h4>
          <p>
            <kbd>N</kbd> oder <kbd>/</kbd> – dann einfach tippen:
          </p>
          <code>Angebot schreiben #launch !4 ^5 ~2h @fr +sales https://…</code>
          <ul>
            <li>
              <code>#projekt</code> Projekt (wird angelegt, falls neu)
            </li>
            <li>
              <code>!1–!5</code> oder <code>!!!</code> Dringlichkeit · <code>^1–^5</code> Wichtigkeit
            </li>
            <li>
              <code>~30m ~2h ~1d</code> Aufwand
            </li>
            <li>
              <code>@heute @morgen @fr @12.10.</code> Fälligkeit
            </li>
            <li>
              <code>+tag</code> Tag, Links werden erkannt
            </li>
            <li>
              <code>=projekt</code> oder <code>=initiative</code> legt statt eines Tasks ein Projekt bzw. eine Initiative an
            </li>
            <li>
              Passt der Text zu einer bestehenden Karte, hängt <kbd>Tab</kbd> ihn als ToDo an.
            </li>
          </ul>
        </section>
        <section>
          <h4>Tastenkürzel</h4>
          <ul className="keys">
            <li><kbd>1</kbd>–<kbd>6</kbd> Ansichten</li>
            <li><kbd>D</kbd> Hand für heute ziehen · <kbd>⇧ D</kbd> eine Karte</li>
            <li><kbd>[</kbd> <kbd>]</kbd> Zeitraum zurück/vor</li>
            <li><kbd>T</kbd> heute</li>
            <li><kbd>Esc</kbd> schließen</li>
            <li><kbd>?</kbd> diese Hilfe</li>
          </ul>
          <h4>Spielregeln</h4>
          <ul>
            <li><b>Stapel</b> = Backlog, <b>Hand</b> = committed, <b>Im Spiel</b> = in Arbeit.</li>
            <li>Karten auf die <b>Ablage</b> ziehen (oder ✓) = erledigt → XP & Serie.</li>
            <li><b>Mana</b> oben rechts = Aufwand, der Rahmen zeigt die Seltenheit.</li>
            <li>Drei Ebenen wie in Jira: <b>Task</b> → <b>Projekt</b> → <b>Initiative</b>. Projekte und Initiativen sind selbst Karten; ihr Aufwand und Fortschritt rechnet sich aus den Karten darunter.</li>
            <li>Karte auf ein Projekt-Deck ziehen = zuordnen; Projektkarte auf eine Initiative ziehen = umhängen.</li>
            <li>Oben rechts wechselst du die Optik: Dunkel, Hell oder <b>Folio</b> (ruhige Papierkarten).</li>
            <li>Im <b>Netz</b> vom ● am Kartenrand auf eine andere Karte ziehen = verbinden.</li>
            <li><b>Hand ziehen</b> füllt heute nach Priorität bis zur Kapazität, Blockiertes bleibt liegen.</li>
            <li>In <b>Kapazität</b> Karten auf eine Uhrzeit ziehen, um Zeit zu blocken; unten am Block ziehen = Dauer.</li>
            <li>Karten, die lange niemand anfasst, <b>altern</b> (⏳ ab 7, verstaubt ab 14, 🕸️ ab 28 Tagen) und rutschen in der Priorität nach oben.</li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}
