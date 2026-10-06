import { useRef } from 'react'
import { motion } from 'framer-motion'
import { addDays, differenceInCalendarDays, eachMonthOfInterval, eachWeekOfInterval, parseISO, startOfDay } from 'date-fns'
import { useStore } from '../store'
import type { Card, Horizon } from '../types'
import { fmt, horizonRange, iso, today } from '../lib/dates'
import { descendants, rollup, spanOf } from '../lib/hierarchy'

/** Für die Roadmap sind Tag/Woche zu kurz – wir zoomen dann automatisch auf den Monat. */
const roadmapHorizon = (h: Horizon): Horizon => (h === 'day' || h === 'week' ? 'month' : h)

/**
 * Roadmap-Ebene: Initiativen mit ihren Projekten als Balken auf der Zeitachse,
 * Tasks mit Fälligkeit als Meilensteine. Balken ziehen = verschieben, Ränder = Dauer.
 */
export function RoadmapView() {
  const cards = useStore((s) => s.cards)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const { addContainer, select } = useStore.getState()
  const trackRef = useRef<HTMLDivElement>(null)

  const range = horizonRange(roadmapHorizon(horizon), parseISO(cursor), settings)
  const start = startOfDay(range.start)
  const totalDays = differenceInCalendarDays(range.end, start) + 1
  const pct = (d: string | Date) => (differenceInCalendarDays(typeof d === 'string' ? parseISO(d) : d, start) / totalDays) * 100
  const ticks = (totalDays > 120 ? eachMonthOfInterval(range) : eachWeekOfInterval(range, { weekStartsOn: 1 })).filter(
    (t) => t >= start,
  )
  const todayPct = pct(today())

  const open = (c: Card) => c.status !== 'done'
  const initiatives = cards.filter((c) => c.level === 'roadmap' && open(c))
  const projects = cards.filter((c) => c.level === 'project' && open(c))
  const groups: { initiative?: Card; projects: Card[] }[] = [
    ...initiatives.map((i) => ({ initiative: i, projects: projects.filter((p) => p.parentId === i.id) })),
  ]
  const loose = projects.filter((p) => !initiatives.some((i) => i.id === p.parentId))
  if (loose.length) groups.push({ projects: loose })

  const rowProps = { cards, pct, totalDays, trackRef }

  return (
    <div className="roadmap">
      <div className="roadmap-grid">
        <div className="rm-head">
          <div className="rm-label">
            <b>
              {fmt(range.start, 'd. MMM')} – {fmt(range.end, 'd. MMM yyyy')}
            </b>
          </div>
          <div className="rm-track" ref={trackRef}>
            {ticks.map((t) => (
              <span key={t.toISOString()} className="rm-tick" style={{ left: `${pct(t)}%` }}>
                {totalDays > 120 ? fmt(t, 'MMM') : `KW ${fmt(t, 'I')}`}
              </span>
            ))}
          </div>
        </div>

        {groups.map((g) => (
          <div key={g.initiative?.id ?? 'loose'} className="rm-group">
            {g.initiative ? (
              <Row card={g.initiative} ticks={ticks} {...rowProps} />
            ) : (
              <div className="rm-group-title">📦 Projekte ohne Initiative</div>
            )}
            {g.projects.map((p) => (
              <Row key={p.id} card={p} ticks={ticks} {...rowProps} />
            ))}
          </div>
        ))}

        {todayPct >= 0 && todayPct <= 100 && (
          <div className="rm-today" style={{ left: `calc(var(--rm-label) + (100% - var(--rm-label)) * ${todayPct / 100})` }}>
            <span>heute</span>
          </div>
        )}
      </div>
      <div className="row">
        <button className="ghost" onClick={() => select(addContainer('roadmap'))}>
          ＋ Initiative
        </button>
        <button className="ghost" onClick={() => select(addContainer('project'))}>
          ＋ Projekt
        </button>
      </div>
      {groups.length === 0 && (
        <p className="muted">Noch keine Initiativen oder Projekte – leg eins an oder tippe „Name =projekt“ in die Schnell-Eingabe.</p>
      )}
    </div>
  )
}

function Row({
  card,
  cards,
  ticks,
  pct,
  totalDays,
  trackRef,
}: {
  card: Card
  cards: Card[]
  ticks: Date[]
  pct: (d: string | Date) => number
  totalDays: number
  trackRef: React.RefObject<HTMLDivElement | null>
}) {
  const { updateCard, select } = useStore.getState()
  const roll = rollup(cards, card)
  const span = spanOf(cards, card)
  const left = Math.max(0, pct(span.start))
  const right = Math.min(100, pct(addDays(parseISO(span.end), 1)))
  const visible = right > 0 && left < 100
  // Meilensteine: Tasks mit Fälligkeit – bei Initiativen nur die direkt darunter, sonst wird es zu voll
  const below = card.level === 'roadmap' ? cards.filter((c) => c.parentId === card.id) : descendants(cards, card.id)
  const milestones = below.filter((c) => c.level === 'task' && c.due)
  const initiative = card.level === 'roadmap'

  /** Balken ziehen: 'move' verschiebt, 'start'/'end' ändert die Dauer. */
  const drag = (mode: 'move' | 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation()
    const w = trackRef.current?.getBoundingClientRect().width ?? 1
    const x0 = e.clientX
    const s0 = parseISO(span.start)
    const e0 = parseISO(span.end)
    let moved = false
    const onMove = (ev: PointerEvent) => {
      const days = Math.round(((ev.clientX - x0) / w) * totalDays)
      if (days !== 0) moved = true
      const ns = mode === 'end' ? s0 : addDays(s0, days)
      const ne = mode === 'start' ? e0 : addDays(e0, days)
      if (ne < ns) return
      updateCard(card.id, { start: iso(ns), due: iso(ne) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved && mode === 'move') select(card.id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className={`rm-row ${initiative ? 'rm-initiative' : ''}`}>
      <div className="rm-label" onClick={() => select(card.id)}>
        <span>{card.emoji}</span>
        <div>
          {initiative && <span className="badge">Initiative</span>}
          <b>{card.title}</b>
          <small>
            {Math.round(roll.value * 100)} % · {roll.open} offen · {roll.total - roll.done} h
          </small>
        </div>
      </div>
      <div className="rm-track">
        {ticks.map((t) => (
          <span key={t.toISOString()} className="rm-gridline" style={{ left: `${pct(t)}%` }} />
        ))}
        {visible && (
          <motion.div
            layout
            className="rm-bar"
            style={{ left: `${left}%`, width: `${right - left}%`, '--c': card.color ?? 'var(--accent)' } as React.CSSProperties}
            onPointerDown={drag('move')}
            title={`${fmt(span.start, 'd.M.')} – ${fmt(span.end, 'd.M.')} · ziehen zum Verschieben`}
          >
            <div className="rm-bar-fill" style={{ width: `${roll.value * 100}%` }} />
            <span className="rm-bar-label">{card.title}</span>
            <i className="rm-handle start" onPointerDown={drag('start')} />
            <i className="rm-handle end" onPointerDown={drag('end')} />
          </motion.div>
        )}
        {milestones.map((c) => {
          const x = pct(c.due!)
          if (x < 0 || x > 100) return null
          return (
            <motion.button
              key={c.id}
              className={`rm-milestone ${c.status === 'done' ? 'done' : ''} ${c.status !== 'done' && c.due! < today() ? 'late' : ''}`}
              style={{ left: `${x}%` }}
              whileHover={{ scale: 1.4, zIndex: 5 }}
              onClick={() => select(c.id)}
              title={`${c.title} · fällig ${fmt(c.due!, 'd. MMM')}`}
            >
              {c.status === 'done' ? '✓' : c.emoji}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
