import { useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { parseISO } from 'date-fns'
import { useStore } from '../store'
import type { Card, CardStatus } from '../types'
import { DraggableCard, Drop } from '../components/Dnd'
import { criticalPath, isBlocked } from '../lib/graph'
import { priority } from '../lib/game'
import { horizonRange, inRange } from '../lib/dates'
import { fuzzy } from '../lib/capture'

const COLUMNS: { id: Exclude<CardStatus, 'done'>; title: string; icon: string; hint: string }[] = [
  { id: 'backlog', title: 'Stapel', icon: '🂠', hint: 'Ideen & Backlog' },
  { id: 'hand', title: 'Hand', icon: '🖐️', hint: 'Das nehme ich mir vor' },
  { id: 'doing', title: 'Im Spiel', icon: '⚔️', hint: 'Daran arbeite ich gerade' },
]

/** Task-Ebene: der Spieltisch. */
export function BoardView() {
  const cards = useStore((s) => s.cards)
  const links = useStore((s) => s.links)
  const projects = useStore((s) => s.projects)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const [project, setProject] = useState<string | null>(null)
  const [onlyHorizon, setOnlyHorizon] = useState(false)
  const [q, setQ] = useState('')

  const map = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const crit = useMemo(() => criticalPath(cards, links), [cards, links])
  const range = horizonRange(horizon, parseISO(cursor), settings)

  const visible = (c: Card) =>
    c.status !== 'done' &&
    (!project || c.projectId === project || (project === 'none' && !c.projectId)) &&
    (!q || fuzzy(`${c.title} ${c.description} ${c.tags.join(' ')}`, q)) &&
    (!onlyHorizon || c.status === 'doing' || inRange(c.due, range) || c.slots.some((s) => inRange(s.date, range)))

  return (
    <div className="board">
      <div className="filterbar">
        <input className="search" placeholder="🔍 Filtern …" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`chip ${!project ? 'on' : ''}`} onClick={() => setProject(null)}>
          Alle
        </button>
        {projects.map((p) => (
          <button
            key={p.id}
            className={`chip ${project === p.id ? 'on' : ''}`}
            style={{ '--c': p.color } as React.CSSProperties}
            onClick={() => setProject(project === p.id ? null : p.id)}
          >
            {p.emoji} {p.name}
          </button>
        ))}
        <button className={`chip ${project === 'none' ? 'on' : ''}`} onClick={() => setProject('none')}>
          ohne Projekt
        </button>
        <label className="toggle">
          <input type="checkbox" checked={onlyHorizon} onChange={(e) => setOnlyHorizon(e.target.checked)} />
          nur aktueller Zeitraum
        </label>
      </div>

      <div className="columns">
        {COLUMNS.map((col) => {
          const list = cards
            .filter((c) => c.status === col.id && visible(c))
            .sort((a, b) => (col.id === 'doing' ? a.order - b.order : priority(b) - priority(a)))
          const hours = list.reduce((s, c) => s + c.effortHours, 0)
          return (
            <Drop key={col.id} id={`col:${col.id}`} className={`column col-${col.id}`}>
              <div className="column-head">
                <span className="column-icon">{col.icon}</span>
                <div>
                  <h3>{col.title}</h3>
                  <small>{col.hint}</small>
                </div>
                {col.id === 'hand' && (
                  <button
                    className="draw-hand"
                    onClick={() => useStore.getState().drawHand()}
                    title="Füllt heute nach Priorität bis zur Kapazität – blockierte Karten bleiben liegen (D)"
                  >
                    🖐️ Hand ziehen
                  </button>
                )}
                <span className="column-count">
                  {list.length} · {hours} h
                </span>
              </div>
              <div className="column-body">
                <AnimatePresence mode="popLayout">
                  {list.map((c) => (
                    <DraggableCard key={c.id} card={c} blocked={isBlocked(c.id, map, links)} critical={crit.cards.has(c.id)} />
                  ))}
                </AnimatePresence>
                {list.length === 0 && (
                  <div className="column-empty">{col.id === 'doing' ? 'Zieh eine Karte hierher, um sie zu spielen' : 'Leer'}</div>
                )}
              </div>
            </Drop>
          )
        })}
      </div>
    </div>
  )
}
