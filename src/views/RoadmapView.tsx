import { useRef } from 'react'
import { motion } from 'framer-motion'
import { addDays, differenceInCalendarDays, eachMonthOfInterval, eachWeekOfInterval, parseISO, startOfDay } from 'date-fns'
import { projectProgress, useStore } from '../store'
import type { Horizon, Project } from '../types'
import { fmt, horizonRange, iso, today } from '../lib/dates'

/** Für die Roadmap sind Tag/Woche zu kurz – wir zoomen dann automatisch auf den Monat. */
const roadmapHorizon = (h: Horizon): Horizon => (h === 'day' || h === 'week' ? 'month' : h)

/** Roadmap-Ebene: Projekte als Balken, Karten mit Fälligkeit als Meilensteine, gruppiert nach Objectives. */
export function RoadmapView() {
  const projects = useStore((s) => s.projects)
  const objectives = useStore((s) => s.objectives)
  const cards = useStore((s) => s.cards)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const { updateProject, select, editProject, addProject } = useStore.getState()
  const trackRef = useRef<HTMLDivElement>(null)

  const range = horizonRange(roadmapHorizon(horizon), parseISO(cursor), settings)
  const start = startOfDay(range.start)
  const totalDays = differenceInCalendarDays(range.end, start) + 1
  const pct = (d: string | Date) => (differenceInCalendarDays(typeof d === 'string' ? parseISO(d) : d, start) / totalDays) * 100
  const ticks = (totalDays > 120 ? eachMonthOfInterval(range) : eachWeekOfInterval(range, { weekStartsOn: 1 })).filter(
    (t) => t >= start,
  )
  const todayPct = pct(today())

  const groups: { title: string; emoji: string; projects: Project[] }[] = objectives.map((o) => {
    const krs = new Set(o.keyResults.map((k) => k.id))
    return { title: o.title, emoji: o.emoji, projects: projects.filter((p) => p.krIds.some((k) => krs.has(k))) }
  })
  const assigned = new Set(groups.flatMap((g) => g.projects.map((p) => p.id)))
  const rest = projects.filter((p) => !assigned.has(p.id))
  if (rest.length) groups.push({ title: 'Weitere Projekte', emoji: '📦', projects: rest })

  /** Balken ziehen: mode 'move' verschiebt, 'start'/'end' ändert die Dauer. */
  const drag = (p: Project, mode: 'move' | 'start' | 'end') => (e: React.PointerEvent) => {
    e.stopPropagation()
    const w = trackRef.current?.getBoundingClientRect().width ?? 1
    const x0 = e.clientX
    const s0 = parseISO(p.start)
    const e0 = parseISO(p.end)
    let moved = false
    const onMove = (ev: PointerEvent) => {
      const days = Math.round(((ev.clientX - x0) / w) * totalDays)
      if (days !== 0) moved = true
      const ns = mode === 'end' ? s0 : addDays(s0, days)
      const ne = mode === 'start' ? e0 : addDays(e0, days)
      if (ne < ns) return
      updateProject(p.id, { start: iso(ns), end: iso(ne) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!moved && mode === 'move') editProject(p.id)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div className="roadmap">
      <div className="roadmap-grid">
        <div className="rm-head">
          <div className="rm-label">
            <b>{fmt(range.start, 'd. MMM')} – {fmt(range.end, 'd. MMM yyyy')}</b>
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
          <div key={g.title} className="rm-group">
            <div className="rm-group-title">
              {g.emoji} {g.title}
            </div>
            {g.projects.map((p) => {
              const prog = projectProgress(p.id, cards)
              const left = Math.max(0, pct(p.start))
              const right = Math.min(100, pct(addDays(parseISO(p.end), 1)))
              const visible = right > 0 && left < 100
              const milestones = cards.filter((c) => c.projectId === p.id && c.due)
              return (
                <div key={p.id} className="rm-row">
                  <div className="rm-label" onClick={() => editProject(p.id)}>
                    <span>{p.emoji}</span>
                    <div>
                      <b>{p.name}</b>
                      <small>
                        {Math.round(prog.value * 100)} % · {prog.open} offen
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
                        style={{ left: `${left}%`, width: `${right - left}%`, '--c': p.color } as React.CSSProperties}
                        onPointerDown={drag(p, 'move')}
                        title={`${fmt(p.start, 'd.M.')} – ${fmt(p.end, 'd.M.')} · ziehen zum Verschieben`}
                      >
                        <div className="rm-bar-fill" style={{ width: `${prog.value * 100}%` }} />
                        <span className="rm-bar-label">{p.name}</span>
                        <i className="rm-handle start" onPointerDown={drag(p, 'start')} />
                        <i className="rm-handle end" onPointerDown={drag(p, 'end')} />
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
            })}
          </div>
        ))}

        {todayPct >= 0 && todayPct <= 100 && (
          <div className="rm-today" style={{ left: `calc(var(--rm-label) + (100% - var(--rm-label)) * ${todayPct / 100})` }}>
            <span>heute</span>
          </div>
        )}
      </div>
      <button className="ghost" onClick={() => editProject(addProject())}>
        ＋ Projekt hinzufügen
      </button>
      {projects.length === 0 && <p className="muted">Noch keine Projekte – leg eins an oder nutze #projekt in der Schnell-Eingabe.</p>}
    </div>
  )
}
