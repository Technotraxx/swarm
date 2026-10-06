import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useStore } from '../store'
import type { Card, ID, Level, Link, LinkType } from '../types'
import { TaskCard } from '../components/Card'
import { LINK_TYPES, initials, personColor, remainingHours } from '../lib/game'
import { autoLayout, blockers, criticalPath } from '../lib/graph'
import { LEVEL_LABEL, ancestors, rollup } from '../lib/hierarchy'

const NODE_W = 140 // TaskCard "sm" = 14em × 10px
const NODE_H = 196

type Lens = 'all' | 'critical' | 'blockers' | 'raci'

const roleOf = (c: Card, person: string) => {
  const r: string[] = []
  if (c.raci.r.includes(person)) r.push('R')
  if (c.raci.a === person) r.push('A')
  if (c.raci.c.includes(person)) r.push('C')
  if (c.raci.i.includes(person)) r.push('I')
  if (c.decider === person) r.push('⚖')
  return r
}

/** Linse „Netz“: Karten frei auf dem Tisch anordnen und verbinden. */
export function GraphView() {
  const cards = useStore((s) => s.cards)
  const links = useStore((s) => s.links)
  const { updateCard, addLink, updateLink, removeLink, select } = useStore.getState()

  const [view, setView] = useState({ x: 0, y: 0, k: 0.9 })
  const [linkType, setLinkType] = useState<LinkType>('depends')
  const [lens, setLens] = useState<Lens>('all')
  const [person, setPerson] = useState('')
  const [showDone, setShowDone] = useState(true)
  const [project, setProject] = useState('')
  const [levelF, setLevelF] = useState<Level | 'all'>('task')
  const [drag, setDrag] = useState<{ id: ID; x: number; y: number } | null>(null)
  const [wire, setWire] = useState<{ from: ID; x: number; y: number } | null>(null)
  const [edge, setEdge] = useState<ID | null>(null)
  const wrap = useRef<HTMLDivElement>(null)

  const map = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards])
  const projects = cards.filter((c) => c.level !== 'task' && c.status !== 'done')
  const shown = cards.filter(
    (c) =>
      (levelF === 'all' || c.level === levelF) &&
      (showDone || c.status !== 'done') &&
      (!project || c.id === project || ancestors(map, c).some((a) => a.id === project)),
  )
  const shownIds = new Set(shown.map((c) => c.id))
  const colOffset = (c: Card) => (levelF === 'all' ? { roadmap: 0, project: 1, task: 2 }[c.level] : 0)
  const layout = autoLayout(shown, links, 260, 200, colOffset)
  // Projekte/Initiativen zählen mit dem offenen Aufwand ihrer Karten
  const weight = (c: Card) => (c.level === 'task' ? remainingHours(c) : (({ total, done }) => total - done)(rollup(cards, c)))
  const crit = criticalPath(shown, links, weight)
  const tree = levelF === 'all' ? shown.filter((c) => c.parentId && shownIds.has(c.parentId)) : []
  const people = useMemo(
    () => [...new Set(cards.flatMap((c) => [...c.raci.r, c.raci.a, ...c.raci.c, ...c.raci.i, c.decider ?? '']).filter(Boolean))].sort(),
    [cards],
  )

  const pos = (c: Card) => (drag?.id === c.id ? drag : (c.pos ?? layout.get(c.id) ?? { x: 0, y: 0 }))

  const blockedIds = new Set(shown.filter((c) => c.status !== 'done' && blockers(c.id, map, links).length).map((c) => c.id))
  const blockerIds = new Set(links.filter((l) => blockedIds.has(l.to) && map.get(l.from)?.status !== 'done').map((l) => l.from))

  const highlighted = (c: Card) => {
    if (lens === 'critical') return crit.cards.has(c.id)
    if (lens === 'blockers') return blockedIds.has(c.id) || blockerIds.has(c.id)
    if (lens === 'raci') return !person || roleOf(c, person).length > 0
    return true
  }
  const edgeHighlighted = (l: Link) => {
    if (lens === 'critical') return crit.links.has(l.id)
    if (lens === 'blockers') return blockedIds.has(l.to) && blockerIds.has(l.from)
    if (lens === 'raci') return highlighted(map.get(l.from)!) && highlighted(map.get(l.to)!)
    return true
  }

  const toWorld = (cx: number, cy: number) => {
    const r = wrap.current!.getBoundingClientRect()
    return { x: (cx - r.left - view.x) / view.k, y: (cy - r.top - view.y) / view.k }
  }

  /* ---------- Pan & Zoom ---------- */
  const onWheel = (e: React.WheelEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    const k = Math.min(2, Math.max(0.3, view.k * (e.deltaY < 0 ? 1.1 : 0.9)))
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    setView({ k, x: mx - ((mx - view.x) / view.k) * k, y: my - ((my - view.y) / view.k) * k })
  }
  const onBgDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget && !(e.target as Element).classList.contains('graph-world')) return
    setEdge(null)
    const x0 = e.clientX - view.x
    const y0 = e.clientY - view.y
    const move = (ev: PointerEvent) => setView((v) => ({ ...v, x: ev.clientX - x0, y: ev.clientY - y0 }))
    const up = () => (window.removeEventListener('pointermove', move), window.removeEventListener('pointerup', up))
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ---------- Karte verschieben ---------- */
  const onNodeDown = (c: Card) => (e: React.PointerEvent) => {
    e.stopPropagation()
    const start = toWorld(e.clientX, e.clientY)
    const p0 = pos(c)
    let moved = false
    let last = p0
    const move = (ev: PointerEvent) => {
      const w = toWorld(ev.clientX, ev.clientY)
      last = { x: p0.x + w.x - start.x, y: p0.y + w.y - start.y }
      if (Math.abs(w.x - start.x) + Math.abs(w.y - start.y) > 4) moved = true
      setDrag({ id: c.id, ...last })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDrag(null)
      if (moved) updateCard(c.id, { pos: { x: Math.round(last.x), y: Math.round(last.y) } })
      else select(c.id)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  /* ---------- Verbindung ziehen ---------- */
  const onHandleDown = (c: Card) => (e: React.PointerEvent) => {
    e.stopPropagation()
    const move = (ev: PointerEvent) => setWire({ from: c.id, ...toWorld(ev.clientX, ev.clientY) })
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setWire(null)
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('[data-node-id]')
      const to = target?.getAttribute('data-node-id')
      if (to && to !== c.id) addLink(c.id, to, linkType)
    }
    move(e.nativeEvent)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const arrange = () => {
    const l = autoLayout(shown, links, 260, 200, colOffset)
    for (const c of shown) updateCard(c.id, { pos: l.get(c.id) })
    setView({ x: 20, y: 20, k: 0.8 })
  }

  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const x1 = a.x + NODE_W
    const y1 = a.y + NODE_H / 2
    const x2 = b.x
    const y2 = b.y + NODE_H / 2
    const dx = Math.max(60, Math.abs(x2 - x1) / 2)
    return { d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 }
  }

  const selectedEdge = links.find((l) => l.id === edge)

  return (
    <div className="graph">
      <div className="graph-toolbar">
        <div className="seg small">
          {(
            [
              ['all', 'Alle'],
              ['critical', `🔥 Critical Path · ${Math.round(crit.hours)} h`],
              ['blockers', `⛓️ Blocker · ${blockedIds.size}`],
              ['raci', '👥 RACI'],
            ] as [Lens, string][]
          ).map(([id, label]) => (
            <button key={id} className={lens === id ? 'active' : ''} onClick={() => setLens(id)}>
              {label}
            </button>
          ))}
        </div>
        {lens === 'raci' && (
          <select value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Person wählen …</option>
            {people.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        )}
        <div className="seg small" aria-label="Ebene">
          {([['task', '🃏 Tasks'], ['project', '🗂️ Projekte'], ['roadmap', '🗺️ Initiativen'], ['all', 'Alle Ebenen']] as [Level | 'all', string][]).map(
            ([id, label]) => (
              <button key={id} className={levelF === id ? 'active' : ''} onClick={() => setLevelF(id)}>
                {label}
              </button>
            ),
          )}
        </div>
        <select value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">Alle Projekte & Initiativen</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {LEVEL_LABEL[p.level]}: {p.emoji} {p.title}
            </option>
          ))}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> erledigte
        </label>
        <div className="spacer" />
        <span className="muted small">Neue Verbindung:</span>
        <div className="link-types">
          {Object.entries(LINK_TYPES).map(([k, v]) => (
            <button
              key={k}
              className={linkType === k ? 'on' : ''}
              style={{ '--c': v.color } as React.CSSProperties}
              onClick={() => setLinkType(k as LinkType)}
              title={v.hint}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button onClick={arrange} title="Karten automatisch nach Abhängigkeiten anordnen">
          ✨ Anordnen
        </button>
      </div>

      <div className="graph-canvas" ref={wrap} onWheel={onWheel} onPointerDown={onBgDown}>
        <div className="graph-world" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
          <svg className="graph-edges" width={1} height={1}>
            <defs>
              {Object.entries(LINK_TYPES).map(([k, v]) => (
                <marker key={k} id={`arrow-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0,0 L10,5 L0,10 z" fill={v.color} />
                </marker>
              ))}
              <marker id="arrow-crit" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill="#ffd36b" />
              </marker>
            </defs>
            {tree.map((c) => {
              const { d } = curve(pos(map.get(c.parentId!)!), pos(c))
              return <path key={`tree-${c.id}`} d={d} className="edge-tree" />
            })}
            {links
              .filter((l) => shownIds.has(l.from) && shownIds.has(l.to))
              .map((l) => {
                const a = map.get(l.from)!
                const b = map.get(l.to)!
                const { d, mx, my } = curve(pos(a), pos(b))
                const isCrit = crit.links.has(l.id)
                const meta = LINK_TYPES[l.type]
                const hi = edgeHighlighted(l)
                const done = a.status === 'done'
                return (
                  <g key={l.id} className={`edge ${hi ? '' : 'dim'} ${edge === l.id ? 'sel' : ''}`} onPointerDown={(e) => (e.stopPropagation(), setEdge(l.id))}>
                    <path d={d} className="edge-hit" />
                    {isCrit && lens !== 'blockers' && <path d={d} className="edge-glow" />}
                    <path
                      d={d}
                      className={`edge-line ${done ? 'done' : ''} ${l.type === 'happy' || isCrit ? 'flow' : ''}`}
                      stroke={isCrit && lens === 'critical' ? '#ffd36b' : meta.color}
                      strokeDasharray={meta.dash}
                      markerEnd={`url(#arrow-${isCrit && lens === 'critical' ? 'crit' : l.type})`}
                    />
                    {l.type !== 'depends' && (
                      <text x={mx} y={my - 6} className="edge-label" fill={meta.color}>
                        {meta.label}
                      </text>
                    )}
                  </g>
                )
              })}
            {wire &&
              (() => {
                const a = map.get(wire.from)!
                const { d } = curve(pos(a), { x: wire.x, y: wire.y - NODE_H / 2 })
                return <path d={d} className="edge-line wire" stroke={LINK_TYPES[linkType].color} markerEnd={`url(#arrow-${linkType})`} />
              })()}
          </svg>

          {shown.map((c) => {
            const p = pos(c)
            const roles = person ? roleOf(c, person) : []
            return (
              <div
                key={c.id}
                data-node-id={c.id}
                className={`node ${drag?.id === c.id ? 'dragging' : ''}`}
                style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
                onPointerDown={onNodeDown(c)}
              >
                <TaskCard
                  card={c}
                  size="sm"
                  tilt={false}
                  blocked={blockedIds.has(c.id)}
                  critical={crit.cards.has(c.id) && lens !== 'blockers'}
                  dim={!highlighted(c)}
                />
                {lens === 'raci' && roles.length > 0 && (
                  <div className="raci-badge" style={{ background: personColor(person) }}>
                    {initials(person)} · {roles.join(' ')}
                  </div>
                )}
                {lens === 'blockers' && blockerIds.has(c.id) && <div className="raci-badge blocker">blockiert andere</div>}
                <button className="node-handle" title="Ziehen, um zu verbinden" onPointerDown={onHandleDown(c)} />
              </div>
            )
          })}
        </div>

        <AnimatePresence>
          {selectedEdge && (
            <motion.div className="edge-pop" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <b>
                {map.get(selectedEdge.from)?.title} → {map.get(selectedEdge.to)?.title}
              </b>
              <div className="link-types">
                {Object.entries(LINK_TYPES).map(([k, v]) => (
                  <button
                    key={k}
                    className={selectedEdge.type === k ? 'on' : ''}
                    style={{ '--c': v.color } as React.CSSProperties}
                    onClick={() => updateLink(selectedEdge.id, { type: k as LinkType })}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
              <button className="danger small" onClick={() => (removeLink(selectedEdge.id), setEdge(null))}>
                Verbindung lösen
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="graph-legend">
          {Object.entries(LINK_TYPES).map(([k, v]) => (
            <span key={k}>
              <svg width="26" height="8">
                <line x1="0" y1="4" x2="26" y2="4" stroke={v.color} strokeWidth="2.5" strokeDasharray={v.dash} />
              </svg>
              {v.label}
            </span>
          ))}
          <span>
            <i className="legend-crit" /> Critical Path
          </span>
        </div>
        <div className="graph-zoom">
          <button onClick={() => setView((v) => ({ ...v, k: Math.min(2, v.k * 1.2) }))}>＋</button>
          <button onClick={() => setView({ x: 0, y: 0, k: 0.9 })}>⟲</button>
          <button onClick={() => setView((v) => ({ ...v, k: Math.max(0.3, v.k / 1.2) }))}>－</button>
        </div>
      </div>
    </div>
  )
}
