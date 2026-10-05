import { useRef, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { parseISO } from 'date-fns'
import { PROJECT_COLORS, projectProgress, useStore } from '../store'
import { EMOJIS } from '../lib/game'
import { csvToCards, download, exportCSV, exportICS, exportJSON, parseCSV, parseJSON, standupMarkdown } from '../lib/io'
import { horizonLabel, horizonRange, today } from '../lib/dates'

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

export function ProjectEditor({ id }: { id: string }) {
  const project = useStore((s) => s.projects.find((p) => p.id === id))
  const objectives = useStore((s) => s.objectives)
  const cards = useStore((s) => s.cards)
  const st = useStore.getState()
  if (!project) return null
  const up = (patch: Parameters<typeof st.updateProject>[1]) => st.updateProject(id, patch)
  const prog = projectProgress(id, cards)
  const close = () => st.editProject(undefined)

  return (
    <Modal onClose={close}>
      <div className="row-between">
        <h2>
          {project.emoji} Projekt bearbeiten
        </h2>
        <button className="ghost" onClick={close}>
          ✕
        </button>
      </div>
      <div className="form">
        <label>
          <span>Name</span>
          <input value={project.name} onChange={(e) => up({ name: e.target.value })} autoFocus />
        </label>
        <label>
          <span>Beschreibung / Ziel</span>
          <textarea rows={2} value={project.description} onChange={(e) => up({ description: e.target.value })} />
        </label>
        <div className="row wrap">
          {EMOJIS.slice(0, 16).map((e) => (
            <button key={e} className={`emoji-sm ${project.emoji === e ? 'on' : ''}`} onClick={() => up({ emoji: e })}>
              {e}
            </button>
          ))}
        </div>
        <div className="row wrap">
          {PROJECT_COLORS.map((c) => (
            <button key={c} className={`swatch round ${project.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => up({ color: c })} />
          ))}
          <input type="color" value={project.color.startsWith('#') ? project.color : '#7c6cff'} onChange={(e) => up({ color: e.target.value })} />
        </div>
        <div className="grid2">
          <label>
            <span>Start</span>
            <input type="date" value={project.start} onChange={(e) => up({ start: e.target.value })} />
          </label>
          <label>
            <span>Ende</span>
            <input type="date" value={project.end} onChange={(e) => up({ end: e.target.value })} />
          </label>
        </div>
        <div>
          <span className="label">Zahlt ein auf Key Results</span>
          {objectives.map((o) => (
            <div key={o.id} className="kr-pick">
              <small className="muted">
                {o.emoji} {o.title}
              </small>
              {o.keyResults.map((k) => (
                <label key={k.id} className="check">
                  <input
                    type="checkbox"
                    checked={project.krIds.includes(k.id)}
                    onChange={(e) =>
                      up({ krIds: e.target.checked ? [...project.krIds, k.id] : project.krIds.filter((x) => x !== k.id) })
                    }
                  />
                  {k.title}
                </label>
              ))}
            </div>
          ))}
        </div>
        <p className="muted">
          {prog.count} Karten · {prog.done}/{prog.total} h erledigt
        </p>
        <div className="row-between">
          <button
            className="danger"
            onClick={() => confirm(`Projekt „${project.name}“ löschen? Die Karten bleiben erhalten.`) && st.deleteProject(id)}
          >
            Projekt löschen
          </button>
          <button className="primary" onClick={close}>
            Fertig
          </button>
        </div>
      </div>
    </Modal>
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
    return { cards: s.cards, links: s.links, projects: s.projects, objectives: s.objectives, settings: s.settings, stats: s.stats }
  }

  const onFile = async (f: File) => {
    try {
      const text = await f.text()
      if (f.name.endsWith('.csv')) {
        const rows = csvToCards(parseCSV(text))
        const projects = [...useStore.getState().projects]
        for (const r of rows) {
          let projectId: string | undefined
          if (r.projectName) {
            projectId = projects.find((p) => p.name.toLowerCase() === r.projectName!.toLowerCase())?.id
            if (!projectId) {
              projectId = st.addProject({ name: r.projectName })
              projects.push(useStore.getState().projects.find((p) => p.id === projectId)!)
            }
          }
          const { projectName: _ignored, ...card } = r
          void _ignored
          st.addCard({ ...card, projectId })
        }
        setMsg(`✅ ${rows.length} Karten aus CSV importiert`)
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
          <button onClick={() => download(`questdeck-${stamp}.csv`, exportCSV(st.cards, st.projects), 'text/csv')}>📄 Karten als CSV</button>
          <button onClick={() => download(`questdeck-${stamp}.ics`, exportICS(useStore.getState().cards), 'text/calendar')}>
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
        <button className="ghost" onClick={() => confirm('Beispieldaten laden? Deine Karten werden ersetzt.') && st.resetDemo()}>
          🎲 Beispieldeck laden
        </button>
        <button className="danger" onClick={() => confirm('Wirklich alles löschen?') && st.clearAll()}>
          Alles leeren
        </button>
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
              Passt der Text zu einer bestehenden Karte, hängt <kbd>Tab</kbd> ihn als ToDo an.
            </li>
          </ul>
        </section>
        <section>
          <h4>Tastenkürzel</h4>
          <ul className="keys">
            <li><kbd>1</kbd>–<kbd>6</kbd> Ansichten</li>
            <li><kbd>D</kbd> Karte ziehen</li>
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
            <li>Im <b>Netz</b> vom ● am Kartenrand auf eine andere Karte ziehen = verbinden.</li>
            <li>In <b>Kapazität</b> Karten auf Tage ziehen, um Zeit zu blocken.</li>
          </ul>
        </section>
      </div>
    </Modal>
  )
}
