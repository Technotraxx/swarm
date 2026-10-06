import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import type { Card } from '../types'
import { CardBack } from '../components/Card'
import { DraggableCard, Drop } from '../components/Dnd'
import { fmt } from '../lib/dates'
import { isBlocked } from '../lib/graph'
import { priority } from '../lib/game'
import { ancestorOfLevel, childrenOf, descendants, rollup, spanOf } from '../lib/hierarchy'

/**
 * Projekt-Ebene: Projekte sind Karten und liegen als Decks unter ihrer Initiative.
 * Tasks auf ein Deck ziehen = zuordnen; die Projektkarte auf eine Initiative ziehen = umhängen.
 */
export function ProjectsView() {
  const cards = useStore((s) => s.cards)
  const links = useStore((s) => s.links)
  const objectives = useStore((s) => s.objectives)
  const { addContainer, select } = useStore.getState()
  const [showDone, setShowDone] = useState(false)
  const map = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const krTitle = new Map(objectives.flatMap((o) => o.keyResults.map((k) => [k.id, `${o.emoji} ${k.title}`])))
  const visible = (c: Card) => showDone || c.status !== 'done'

  const initiatives = cards.filter((c) => c.level === 'roadmap' && visible(c))
  const projects = cards.filter((c) => c.level === 'project' && visible(c))
  const [open, setOpen] = useState<string | null>(projects[0]?.id ?? null)

  const groups: { initiative?: Card; projects: Card[] }[] = [
    ...initiatives.map((i) => ({ initiative: i, projects: projects.filter((p) => p.parentId === i.id) })),
    { projects: projects.filter((p) => !p.parentId || map.get(p.parentId)?.level !== 'roadmap' || !visible(map.get(p.parentId)!)) },
  ]
  // Tasks ohne Projekt (auch solche, die direkt unter einer Initiative hängen)
  const looseTasks = cards.filter((c) => c.level === 'task' && visible(c) && !ancestorOfLevel(map, c, 'project'))

  const openCards =
    open === 'none'
      ? looseTasks
      : open
        ? descendants(cards, open).filter((c) => c.level === 'task' && visible(c))
        : []
  const openSorted = [...openCards].sort(
    (a, b) => Number(a.status === 'done') - Number(b.status === 'done') || priority(b) - priority(a),
  )
  const openTitle = open === 'none' ? 'Karten ohne Projekt' : map.get(open ?? '')?.title

  return (
    <div className="projects">
      <div className="row-between">
        <div className="row">
          <button
            onClick={() => {
              const id = addContainer('project')
              setOpen(id)
              select(id)
            }}
          >
            ＋ Projekt
          </button>
          <button onClick={() => select(addContainer('roadmap'))}>＋ Initiative</button>
        </div>
        <label className="toggle">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> erledigte zeigen
        </label>
      </div>

      {groups.map((g) => {
        const roll = g.initiative ? rollup(cards, g.initiative) : undefined
        const span = g.initiative ? spanOf(cards, g.initiative) : undefined
        const isLoose = !g.initiative
        if (isLoose && !g.projects.length && !looseTasks.length) return null
        return (
          <section key={g.initiative?.id ?? 'none'} className="initiative">
            <Drop
              id={`parent:${g.initiative?.id ?? 'none'}`}
              className="initiative-head"
              style={{ '--c': g.initiative?.color ?? 'var(--muted)' } as React.CSSProperties}
            >
              {g.initiative ? (
                <>
                  <button className="initiative-title" onClick={() => select(g.initiative!.id)}>
                    <span className="badge">Initiative</span>
                    <b>
                      {g.initiative.emoji} {g.initiative.title}
                    </b>
                  </button>
                  <small className="muted">
                    {span && `${fmt(span.start, 'd. MMM')} – ${fmt(span.end, 'd. MMM yyyy')}`} · {g.projects.length} Projekte ·{' '}
                    {roll!.done}/{roll!.total} h
                  </small>
                  <div className="bar">
                    <div style={{ width: `${roll!.value * 100}%`, background: g.initiative.color }} />
                  </div>
                  {(g.initiative.krIds ?? []).map((k) => (
                    <span key={k} className="chip tiny">
                      {krTitle.get(k)}
                    </span>
                  ))}
                </>
              ) : (
                <>
                  <b className="muted">Ohne Initiative</b>
                  <small className="muted">Projekt hierher ziehen = aus der Initiative lösen</small>
                </>
              )}
            </Drop>

            <div className="decks">
              {g.projects.map((p) => (
                <Deck key={p.id} project={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} krTitle={krTitle} />
              ))}
              {isLoose && looseTasks.length > 0 && (
                <LooseDeck count={looseTasks.length} open={open === 'none'} onToggle={() => setOpen(open === 'none' ? null : 'none')} />
              )}
              {g.initiative && !g.projects.length && <p className="muted">Noch keine Projekte – zieh eine Projektkarte auf die Leiste.</p>}
            </div>
          </section>
        )
      })}

      <AnimatePresence mode="wait">
        {open && openTitle && (
          <motion.section
            key={open}
            className="deck-spread"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
          >
            <h3>
              {openTitle} · {openSorted.length} Karten
            </h3>
            <div className="spread">
              <AnimatePresence mode="popLayout">
                {openSorted.map((c, i) => (
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
              {openSorted.length === 0 && <p className="muted">Zieh Karten auf das Deck, um sie diesem Projekt zuzuordnen.</p>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}

function Deck({
  project,
  open,
  onToggle,
  krTitle,
}: {
  project: Card
  open: boolean
  onToggle: () => void
  krTitle: Map<string, string>
}) {
  const cards = useStore((s) => s.cards)
  const roll = rollup(cards, project)
  const span = spanOf(cards, project)
  const kids = childrenOf(cards, project.id).filter((c) => c.status !== 'done')
  return (
    <Drop id={`parent:${project.id}`} className={`deck ${open ? 'open' : ''}`}>
      <motion.div className="deck-inner" style={{ '--c': project.color ?? '#5d6678' } as React.CSSProperties} whileHover={{ y: -4 }}>
        <div className="deck-stack">
          {Array.from({ length: Math.min(3, kids.length) }).map((_, i) => (
            <div
              key={i}
              className="deck-back"
              style={{ transform: `translate(${(i + 1) * 4}px, ${(i + 1) * -4}px) rotate(${(i + 1) * 2}deg)` }}
            >
              <CardBack size="sm" />
            </div>
          ))}
          <div className="deck-top">
            <DraggableCard card={project} size="sm" actions={false} />
          </div>
        </div>
        <div className="deck-info" onClick={onToggle} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onToggle()}>
          <h3>
            {project.emoji} {project.title}
          </h3>
          <small className="muted">
            {fmt(span.start, 'd. MMM')} – {fmt(span.end, 'd. MMM')}
          </small>
          <div className="bar">
            <div style={{ width: `${roll.value * 100}%`, background: project.color }} />
          </div>
          <small>
            {Math.round(roll.value * 100)} % · {roll.open} offen · {roll.total - roll.done} h übrig
          </small>
          <div className="kr-tags">
            {(project.krIds ?? []).map((k) => (
              <span key={k} className="chip tiny">
                {krTitle.get(k)}
              </span>
            ))}
          </div>
          <small className="deck-toggle">{open ? 'Karten ausblenden ▴' : 'Karten zeigen ▾'}</small>
        </div>
      </motion.div>
    </Drop>
  )
}

function LooseDeck({ count, open, onToggle }: { count: number; open: boolean; onToggle: () => void }) {
  return (
    <Drop id="parent:none:deck" className={`deck ${open ? 'open' : ''}`}>
      <motion.div className="deck-inner" style={{ '--c': '#5d6678' } as React.CSSProperties} whileHover={{ y: -4 }} onClick={onToggle}>
        <div className="deck-stack">
          <div className="deck-empty">🗃️</div>
        </div>
        <div className="deck-info">
          <h3>Ohne Projekt</h3>
          <small className="muted">{count} lose Karten</small>
          <small className="deck-toggle">{open ? 'Karten ausblenden ▴' : 'Karten zeigen ▾'}</small>
        </div>
      </motion.div>
    </Drop>
  )
}
