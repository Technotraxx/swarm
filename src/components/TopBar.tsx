import { motion } from 'framer-motion'
import { parseISO } from 'date-fns'
import { bookedHours, useStore } from '../store'
import type { ViewId } from '../types'
import { HORIZONS, capacityFor, daysIn, horizonLabel, horizonRange, inRange, iso, shiftCursor, today } from '../lib/dates'
import { level } from '../lib/game'
import { QuickCapture } from './QuickCapture'

export const LEVELS: { id: ViewId; label: string; icon: string; hint: string }[] = [
  { id: 'board', label: 'Task', icon: '🃏', hint: 'Tisch mit Stapel, Hand & Spielfeld' },
  { id: 'projects', label: 'Projekt', icon: '🗂️', hint: 'Karten als Projekt-Decks' },
  { id: 'roadmap', label: 'Roadmap', icon: '🗺️', hint: 'Projekte & Meilensteine auf der Zeitachse' },
]
export const LENSES: { id: ViewId; label: string; icon: string; hint: string }[] = [
  { id: 'graph', label: 'Netz', icon: '🕸️', hint: 'Abhängigkeiten, Critical Path, Blocker, RACI' },
  { id: 'calendar', label: 'Kapazität', icon: '📅', hint: 'Wann arbeite ich woran?' },
  { id: 'okr', label: 'OKR', icon: '🎯', hint: 'Objectives & Key Results' },
]

export function TopBar() {
  const view = useStore((s) => s.view)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const stats = useStore((s) => s.stats)
  const cards = useStore((s) => s.cards)
  const { setView, setHorizon, setCursor, toggleIO, toggleHelp, updateSettings } = useStore.getState()

  const cur = parseISO(cursor)
  const range = horizonRange(horizon, cur, settings)
  const days = daysIn(range).map(iso)
  const cap = days.reduce((s, d) => s + capacityFor(d, settings), 0)
  const booked = days.reduce((s, d) => s + bookedHours(cards, d), 0)
  const dueCount = cards.filter((c) => c.status !== 'done' && inRange(c.due, range)).length
  const doneCount = cards.filter((c) => c.status === 'done' && inRange(c.doneAt?.slice(0, 10), range)).length
  const load = cap ? booked / cap : 0
  const lvl = level(stats.xp)

  const Tab = ({ t }: { t: (typeof LEVELS)[number] }) => (
    <button className={`tab ${view === t.id ? 'active' : ''}`} onClick={() => setView(t.id)} title={t.hint}>
      {view === t.id && <motion.span layoutId="tab-pill" className="tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
      <span className="tab-icon">{t.icon}</span>
      <span className="tab-label">{t.label}</span>
    </button>
  )

  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand">
          <span className="brand-logo">🃏</span>
          <span className="brand-name">Questdeck</span>
        </div>

        <nav className="tabs" aria-label="Ebene">
          <span className="tabs-caption">Ebene</span>
          {LEVELS.map((t) => (
            <Tab key={t.id} t={t} />
          ))}
        </nav>
        <nav className="tabs" aria-label="Linse">
          <span className="tabs-caption">Linse</span>
          {LENSES.map((t) => (
            <Tab key={t.id} t={t} />
          ))}
        </nav>

        <div className="spacer" />

        <div className="player" title={`${stats.xp} XP · noch ${lvl.need - lvl.rest} XP bis Level ${lvl.level + 1}`}>
          <div className="lvl-ring" style={{ '--p': lvl.progress } as React.CSSProperties}>
            <span>{lvl.level}</span>
          </div>
          <div className="player-meta">
            <b>{stats.xp} XP</b>
            <small>{stats.streak > 0 ? `🔥 ${stats.streak} Tag${stats.streak > 1 ? 'e' : ''} Serie` : 'Noch keine Serie'}</small>
          </div>
        </div>

        <div className="icon-btns">
          <button onClick={() => toggleIO(true)} title="Import / Export & Anbindungen">⇅</button>
          <button onClick={() => updateSettings({ sound: !settings.sound })} title="Sound">
            {settings.sound ? '🔊' : '🔈'}
          </button>
          <button onClick={() => updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })} title="Hell/Dunkel">
            {settings.theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={() => toggleHelp(true)} title="Hilfe & Tastenkürzel (?)">?</button>
        </div>
      </div>

      <div className="topbar-row second">
        <QuickCapture />

        <div className="horizon">
          <div className="seg">
            {HORIZONS.map((h) => (
              <button key={h.id} className={horizon === h.id ? 'active' : ''} onClick={() => setHorizon(h.id)}>
                {h.label}
              </button>
            ))}
          </div>
          <div className="horizon-nav">
            <button onClick={() => setCursor(iso(shiftCursor(horizon, cur, -1)))} title="Zurück ([)">
              ‹
            </button>
            <button className="horizon-label" onClick={() => setCursor(today())} title="Heute (T)">
              {horizonLabel(horizon, cur, settings)}
            </button>
            <button onClick={() => setCursor(iso(shiftCursor(horizon, cur, 1)))} title="Weiter (])">
              ›
            </button>
          </div>
          <div className="horizon-stats">
            <div className="load" title={`${booked} h von ${cap} h Kapazität verplant`}>
              <div
                className={`load-fill ${load > 1 ? 'over' : load > 0.85 ? 'warn' : ''}`}
                style={{ width: `${Math.min(100, load * 100)}%` }}
              />
              <span>
                {booked}/{cap} h
              </span>
            </div>
            <span className="mini-stat" title="Fällig im Zeitraum">
              🏁 {dueCount}
            </span>
            <span className="mini-stat" title="Erledigt im Zeitraum">
              ✅ {doneCount}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}
