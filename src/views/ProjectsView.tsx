import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { projectProgress, useStore } from '../store'
import type { Project } from '../types'
import { CardBack, TaskCard } from '../components/Card'
import { DraggableCard, Drop } from '../components/Dnd'
import { fmt } from '../lib/dates'
import { isBlocked } from '../lib/graph'
import { priority } from '../lib/game'

/** Projekt-Ebene: jedes Projekt ist ein Deck. Karten aufs Deck ziehen = zuordnen. */
export function ProjectsView() {
  const projects = useStore((s) => s.projects)
  const cards = useStore((s) => s.cards)
  const links = useStore((s) => s.links)
  const objectives = useStore((s) => s.objectives)
  const { addProject, editProject } = useStore.getState()
  const [open, setOpen] = useState<string | null>(projects[0]?.id ?? null)
  const [showDone, setShowDone] = useState(false)
  const map = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const krTitle = new Map(objectives.flatMap((o) => o.keyResults.map((k) => [k.id, `${o.emoji} ${k.title}`])))

  const decks: (Project | null)[] = [...projects, null]
  const openCards = cards
    .filter((c) => (open === 'none' ? !c.projectId : c.projectId === open) && (showDone || c.status !== 'done'))
    .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || priority(b) - priority(a))

  return (
    <div className="projects">
      <div className="decks">
        {decks.map((p) => {
          const id = p?.id ?? 'none'
          const mine = cards.filter((c) => (p ? c.projectId === p.id : !c.projectId) && c.status !== 'done')
          const prog = p ? projectProgress(p.id, cards) : undefined
          const top = [...mine].sort((a, b) => priority(b) - priority(a))[0]
          return (
            <Drop key={id} id={`project:${id}`} className={`deck ${open === id ? 'open' : ''}`}>
              <motion.div
                className="deck-inner"
                style={{ '--c': p?.color ?? '#5d6678' } as React.CSSProperties}
                whileHover={{ y: -6 }}
                onClick={() => setOpen(open === id ? null : id)}
              >
                <div className="deck-stack">
                  {Array.from({ length: Math.min(3, mine.length) }).map((_, i) => (
                    <div key={i} className="deck-back" style={{ transform: `translate(${(i + 1) * 4}px, ${(i + 1) * -4}px) rotate(${(i + 1) * 2}deg)` }}>
                      <CardBack size="sm" />
                    </div>
                  ))}
                  {top ? (
                    <div className="deck-top">
                      <TaskCard card={top} size="sm" tilt={false} />
                    </div>
                  ) : (
                    <div className="deck-empty">{p ? p.emoji : '🗃️'}</div>
                  )}
                </div>
                <div className="deck-info">
                  <div className="row-between">
                    <h3>
                      {p ? `${p.emoji} ${p.name}` : 'Ohne Projekt'}
                    </h3>
                    {p && (
                      <button
                        className="ghost small"
                        title="Bearbeiten"
                        onClick={(e) => (e.stopPropagation(), editProject(p.id))}
                      >
                        ✎
                      </button>
                    )}
                  </div>
                  {p && (
                    <>
                      <small className="muted">
                        {fmt(p.start, 'd. MMM')} – {fmt(p.end, 'd. MMM')}
                      </small>
                      <div className="bar">
                        <div style={{ width: `${(prog?.value ?? 0) * 100}%`, background: p.color }} />
                      </div>
                      <small>
                        {Math.round((prog?.value ?? 0) * 100)} % · {prog?.open} offen · {prog!.total - prog!.done} h übrig
                      </small>
                      <div className="kr-tags">
                        {p.krIds.map((k) => (
                          <span key={k} className="chip tiny">
                            {krTitle.get(k)}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                  {!p && <small className="muted">{mine.length} lose Karten</small>}
                </div>
              </motion.div>
            </Drop>
          )
        })}
        <motion.button
          className="deck deck-new"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            const id = addProject()
            editProject(id)
            setOpen(id)
          }}
        >
          <span>＋</span>
          Neues Projekt
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {open && (
          <motion.section
            key={open}
            className="deck-spread"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <div className="row-between">
              <h3>
                {open === 'none' ? 'Karten ohne Projekt' : projects.find((p) => p.id === open)?.name} · {openCards.length} Karten
              </h3>
              <label className="toggle">
                <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> erledigte zeigen
              </label>
            </div>
            <div className="spread">
              <AnimatePresence mode="popLayout">
                {openCards.map((c, i) => (
                  <motion.div
                    key={c.id}
                    className="spread-item"
                    initial={{ opacity: 0, rotate: -10, y: 40 }}
                    animate={{ opacity: 1, rotate: 0, y: 0, transition: { delay: i * 0.03 } }}
                    exit={{ opacity: 0, scale: 0.8 }}
                  >
                    <DraggableCard card={c} size="sm" blocked={isBlocked(c.id, map, links)} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {openCards.length === 0 && <p className="muted">Zieh Karten auf das Deck, um sie diesem Projekt zuzuordnen.</p>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
