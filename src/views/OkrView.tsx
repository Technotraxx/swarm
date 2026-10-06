import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { parseISO } from 'date-fns'
import { krProgress, useStore } from '../store'
import type { KeyResult, Objective } from '../types'
import { DraggableCard, Drop } from '../components/Dnd'
import { ConfirmButton } from '../components/Inline'
import { priority } from '../lib/game'
import { LEVEL_LABEL, krsOf } from '../lib/hierarchy'
import { quarterOf } from '../lib/dates'

/** Linse „OKR“: Objectives & Key Results. Karten auf ein KR ziehen = darauf einzahlen. */
export function OkrView() {
  const objectives = useStore((s) => s.objectives)
  const cards = useStore((s) => s.cards)
  const cursor = useStore((s) => s.cursor)
  const map = new Map(cards.map((c) => [c.id, c]))
  // Karten, die noch auf kein Key Result einzahlen – auch nicht über ihr Projekt
  const loose = cards.filter((c) => c.status !== 'done' && krsOf(map, c).length === 0).sort((a, b) => priority(b) - priority(a))
  const { addObjective } = useStore.getState()
  const current = quarterOf(parseISO(cursor))
  const quarters = [...new Set([current, ...objectives.map((o) => o.quarter)])].sort().reverse()

  return (
    <div className="okr-layout">
      <aside className="tray">
        <div className="tray-head">
          <h3>Ohne Key Result</h3>
          <small className="muted">auf ein KR ziehen</small>
        </div>
        <div className="tray-list">
          <AnimatePresence mode="popLayout">
            {loose.map((c) => (
              <div key={c.id} className="tray-item">
                <DraggableCard card={c} size="sm" actions={false} />
              </div>
            ))}
          </AnimatePresence>
          {!loose.length && <p className="muted">Jede Karte zahlt auf ein Ziel ein 🎯</p>}
        </div>
      </aside>
    <div className="okr">
      {quarters.map((q) => {
        const list = objectives.filter((o) => o.quarter === q)
        if (!list.length && q !== current) return null
        return (
          <section key={q} className={`okr-quarter ${q === current ? 'current' : ''}`}>
            <h3 className="okr-q">
              {q.replace('-', ' · ')} {q === current && <span className="badge">aktuell</span>}
            </h3>
            <div className="objectives">
              <AnimatePresence>
                {list.map((o) => (
                  <ObjectiveCard key={o.id} o={o} />
                ))}
              </AnimatePresence>
              {q === current && (
                <motion.button className="objective objective-new" whileHover={{ scale: 1.02 }} onClick={() => addObjective({ quarter: q })}>
                  ＋ Objective
                </motion.button>
              )}
            </div>
          </section>
        )
      })}
    </div>
    </div>
  )
}

function ObjectiveCard({ o }: { o: Objective }) {
  const cards = useStore((s) => s.cards)
  const { updateObjective, deleteObjective, addKeyResult } = useStore.getState()
  const [kr, setKr] = useState('')
  const progresses = o.keyResults.map((k) => krProgress(k.id, cards, k.manual).value)
  const total = progresses.length ? progresses.reduce((a, b) => a + b, 0) / progresses.length : 0
  const krIds = new Set(o.keyResults.map((k) => k.id))
  const linkedProjects = cards.filter((c) => c.level !== 'task' && (c.krIds ?? []).some((k) => krIds.has(k)))

  return (
    <motion.article layout className="objective" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
      <header>
        <div className="obj-ring" style={{ '--p': total } as React.CSSProperties}>
          <span>{o.emoji}</span>
        </div>
        <div className="grow">
          <input className="obj-title" value={o.title} onChange={(e) => updateObjective(o.id, { title: e.target.value })} />
          <small className="muted">
            {Math.round(total * 100)} % · {linkedProjects.map((p) => `${p.emoji} ${p.title}`).join(' · ') || 'noch kein Projekt'}
          </small>
        </div>
        <ConfirmButton className="ghost small" ask="Löschen?" title="Objective löschen" onConfirm={() => deleteObjective(o.id)}>
          🗑
        </ConfirmButton>
      </header>
      <ul className="krs">
        {o.keyResults.map((k) => (
          <KrRow key={k.id} k={k} />
        ))}
      </ul>
      <div className="row">
        <input
          placeholder="＋ Key Result (Enter)"
          value={kr}
          onChange={(e) => setKr(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && kr.trim() && (addKeyResult(o.id, kr.trim()), setKr(''))}
        />
        <input
          className="quarter-input"
          value={o.quarter}
          title="Quartal (z. B. 2026-Q4)"
          onChange={(e) => updateObjective(o.id, { quarter: e.target.value })}
        />
      </div>
    </motion.article>
  )
}

function KrRow({ k }: { k: KeyResult }) {
  const cards = useStore((s) => s.cards)
  const { updateKeyResult, deleteKeyResult, select } = useStore.getState()
  const prog = krProgress(k.id, cards, k.manual)
  // direkt zugeordnete Karten – Projekte/Initiativen zuerst, ihre Tasks zählen automatisch mit
  const mine = cards
    .filter((c) => c.krId === k.id || (c.krIds ?? []).includes(k.id))
    .sort((a, b) => Number(a.level === 'task') - Number(b.level === 'task'))
  return (
    <Drop id={`kr:${k.id}`} className="kr">
      <div className="row-between">
        <input className="kr-title" value={k.title} onChange={(e) => updateKeyResult(k.id, { title: e.target.value })} />
        <b className="kr-pct">{Math.round(prog.value * 100)} %</b>
        <button className="ghost small" onClick={() => deleteKeyResult(k.id)}>
          ✕
        </button>
      </div>
      <div className="bar">
        <motion.div animate={{ width: `${prog.value * 100}%` }} />
      </div>
      <div className="kr-cards">
        {mine.map((c) => (
          <button
            key={c.id}
            className={`kr-card lvl-${c.level} ${c.status === 'done' ? 'done' : ''}`}
            onClick={() => select(c.id)}
            title={c.level === 'task' ? c.title : `${LEVEL_LABEL[c.level]} – alle Karten darin zahlen ein`}
          >
            {c.status === 'done' ? '✓' : c.emoji} {c.title}
          </button>
        ))}
        {!mine.length && <small className="muted">Karten hierher ziehen</small>}
        <label className="manual" title="Manueller Fortschritt (z. B. Messwert aus einem anderen Tool)">
          <small>manuell</small>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={k.manual ?? 0}
            onChange={(e) => updateKeyResult(k.id, { manual: Number(e.target.value) })}
          />
        </label>
      </div>
    </Drop>
  )
}
