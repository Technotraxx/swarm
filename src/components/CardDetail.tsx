import { useState } from 'react'
import { motion } from 'framer-motion'
import { useCardMap, useStore } from '../store'
import type { Card, CardStatus, LinkType } from '../types'
import { TaskCard } from './Card'
import { EMOJIS, LINK_TYPES, MOTIFS, points, scheduledHours } from '../lib/game'
import { fmt, today } from '../lib/dates'
import { blockers } from '../lib/graph'

const STATUS: { id: CardStatus; label: string }[] = [
  { id: 'backlog', label: 'Stapel' },
  { id: 'hand', label: 'Hand' },
  { id: 'doing', label: 'Im Spiel' },
  { id: 'done', label: 'Erledigt' },
]

const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

function Pips({ value, onChange, icon }: { value: number; onChange: (v: number) => void; icon: string }) {
  return (
    <div className="pips">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>
          {icon}
        </button>
      ))}
    </div>
  )
}

export function CardDetail({ id }: { id: string }) {
  const card = useStore((s) => s.cards.find((c) => c.id === id))
  const map = useCardMap()
  const projects = useStore((s) => s.projects)
  const objectives = useStore((s) => s.objectives)
  const links = useStore((s) => s.links)
  const st = useStore.getState()
  const [todo, setTodo] = useState('')
  const [note, setNote] = useState('')
  const [pickMotif, setPickMotif] = useState(false)
  const [linkTarget, setLinkTarget] = useState('')
  const [linkType, setLinkType] = useState<LinkType>('depends')
  const [linkDir, setLinkDir] = useState<'in' | 'out'>('in')

  if (!card) return null
  const up = (patch: Partial<Card>) => st.updateCard(card.id, patch)
  const incoming = links.filter((l) => l.to === card.id)
  const outgoing = links.filter((l) => l.from === card.id)
  const blocking = blockers(card.id, map, links)
  const others = [...map.values()].filter((c) => c.id !== card.id).sort((a, b) => a.title.localeCompare(b.title))
  const close = () => st.select(undefined)

  return (
    <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={close}>
      <motion.aside
        className="drawer drawer-wide"
        initial={{ x: 700 }}
        animate={{ x: 0 }}
        exit={{ x: 700 }}
        transition={{ type: 'spring', stiffness: 300, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="detail">
          <div className="detail-preview">
            <motion.div initial={{ rotateY: 90 }} animate={{ rotateY: 0 }} transition={{ delay: 0.1, type: 'spring' }}>
              <TaskCard card={card} size="lg" blocked={blocking.length > 0} />
            </motion.div>
            <div className="detail-actions">
              {card.status !== 'done' ? (
                <button className="primary" onClick={() => st.completeCard(card.id)}>
                  ✓ Erledigt
                </button>
              ) : (
                <button onClick={() => st.reopenCard(card.id)}>↩ Wieder öffnen</button>
              )}
              <button onClick={() => st.select(st.duplicateCard(card.id))}>⧉ Duplizieren</button>
              <button
                className="danger"
                onClick={() => confirm(`„${card.title}“ wirklich löschen?`) && st.deleteCard(card.id)}
              >
                🗑
              </button>
            </div>
            {blocking.length > 0 && (
              <div className="callout warn">
                ⛓️ Wartet auf: {blocking.map((b) => b.title).join(', ')}
              </div>
            )}
            <div className="meta muted">
              Erstellt {fmt(card.createdAt, 'd. MMM yyyy')}
              {card.startedAt && <> · gestartet {fmt(card.startedAt, 'd. MMM')}</>}
              {card.doneAt && <> · erledigt {fmt(card.doneAt, 'd. MMM')}</>}
            </div>
          </div>

          <div className="detail-form">
            <div className="row-between">
              <input className="title-input" value={card.title} onChange={(e) => up({ title: e.target.value })} />
              <button className="ghost" onClick={close} title="Schließen (Esc)">
                ✕
              </button>
            </div>
            <textarea
              placeholder="Worum geht's? Was ist das Ergebnis?"
              value={card.description}
              rows={3}
              onChange={(e) => up({ description: e.target.value })}
            />

            <div className="seg">
              {STATUS.map((s) => (
                <button
                  key={s.id}
                  className={card.status === s.id ? 'active' : ''}
                  onClick={() => (s.id === 'done' ? st.completeCard(card.id) : st.moveCard(card.id, s.id))}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <section>
              <h4>Motiv</h4>
              <div className="row">
                <button className="emoji-btn" onClick={() => setPickMotif((v) => !v)}>
                  {card.emoji}
                </button>
                <div className="motif-row">
                  {MOTIFS.map((m, i) => (
                    <button
                      key={i}
                      className={`swatch ${card.motif === i && !card.imageUrl ? 'on' : ''}`}
                      style={{ background: m }}
                      onClick={() => up({ motif: i, imageUrl: undefined })}
                    />
                  ))}
                </div>
              </div>
              {pickMotif && (
                <div className="emoji-grid">
                  {EMOJIS.map((e) => (
                    <button key={e} onClick={() => (up({ emoji: e }), setPickMotif(false))}>
                      {e}
                    </button>
                  ))}
                  <input
                    placeholder="eigenes"
                    maxLength={4}
                    onKeyDown={(e) => e.key === 'Enter' && (up({ emoji: e.currentTarget.value }), setPickMotif(false))}
                  />
                </div>
              )}
              <input
                placeholder="Bild-URL (optional, ersetzt das Motiv)"
                value={card.imageUrl ?? ''}
                onChange={(e) => up({ imageUrl: e.target.value || undefined })}
              />
            </section>

            <div className="grid2">
              <label>
                <span>
                  ⏱ Aufwand · {card.effortHours} h = {points(card.effortHours)} Mana
                </span>
                <input
                  type="range"
                  min={0.5}
                  max={40}
                  step={0.5}
                  value={card.effortHours}
                  onChange={(e) => up({ effortHours: Number(e.target.value) })}
                />
              </label>
              <label>
                <span>🔗 Link</span>
                <input placeholder="https://…" value={card.link ?? ''} onChange={(e) => up({ link: e.target.value || undefined })} />
              </label>
              <label>
                <span>⚡ Dringlichkeit</span>
                <Pips value={card.urgency} icon="⚡" onChange={(urgency) => up({ urgency })} />
              </label>
              <label>
                <span>◆ Wichtigkeit</span>
                <Pips value={card.importance} icon="◆" onChange={(importance) => up({ importance })} />
              </label>
              <label>
                <span>🏁 Fällig</span>
                <input type="date" value={card.due ?? ''} onChange={(e) => up({ due: e.target.value || undefined })} />
              </label>
              <label>
                <span>🏷 Tags</span>
                <input
                  placeholder="komma, getrennt"
                  defaultValue={card.tags.join(', ')}
                  onBlur={(e) => up({ tags: list(e.target.value) })}
                />
              </label>
              <label>
                <span>🗂 Projekt</span>
                <select value={card.projectId ?? ''} onChange={(e) => up({ projectId: e.target.value || undefined })}>
                  <option value="">— ohne —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.emoji} {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>🎯 Key Result</span>
                <select value={card.krId ?? ''} onChange={(e) => up({ krId: e.target.value || undefined })}>
                  <option value="">— ohne —</option>
                  {objectives.map((o) => (
                    <optgroup key={o.id} label={`${o.emoji} ${o.title}`}>
                      {o.keyResults.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            <section>
              <h4>
                ✅ ToDos{' '}
                <small className="muted">
                  {card.checklist.filter((i) => i.done).length}/{card.checklist.length}
                </small>
              </h4>
              <ul className="checklist">
                {card.checklist.map((i) => (
                  <li key={i.id} className={i.done ? 'done' : ''}>
                    <input type="checkbox" checked={i.done} onChange={() => st.toggleChecklist(card.id, i.id)} />
                    <span>{i.text}</span>
                    <button className="ghost small" onClick={() => st.removeChecklist(card.id, i.id)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <input
                placeholder="ToDo anfügen … (Enter)"
                value={todo}
                onChange={(e) => setTodo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && todo.trim()) (st.addChecklist(card.id, todo.trim()), setTodo(''))
                }}
              />
            </section>

            <section>
              <h4>
                📅 Zeitblöcke{' '}
                <small className="muted">
                  {scheduledHours(card)} / {card.effortHours} h geplant
                </small>
              </h4>
              <div className="slots">
                {card.slots.map((s) => (
                  <span key={s.date} className="chip">
                    {fmt(s.date, 'EEE d.M.')} ·
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={s.hours}
                      onChange={(e) => st.setSlot(card.id, s.date, Number(e.target.value))}
                    />
                    h
                    <button className="ghost small" onClick={() => st.setSlot(card.id, s.date, 0)}>
                      ✕
                    </button>
                  </span>
                ))}
                <input
                  type="date"
                  title="Zeitblock hinzufügen"
                  defaultValue=""
                  min={today()}
                  onChange={(e) => e.target.value && (st.schedule(card.id, e.target.value), (e.target.value = ''))}
                />
              </div>
            </section>

            <section>
              <h4>🕸 Verbindungen</h4>
              <ul className="links">
                {incoming.map((l) => (
                  <li key={l.id}>
                    <span className="link-dot" style={{ background: LINK_TYPES[l.type].color }} />
                    <span className="muted">von</span>
                    <b onClick={() => st.select(l.from)}>{map.get(l.from)?.title}</b>
                    <LinkTypeSelect value={l.type} onChange={(type) => st.updateLink(l.id, { type })} />
                    <button className="ghost small" onClick={() => st.removeLink(l.id)}>
                      ✕
                    </button>
                  </li>
                ))}
                {outgoing.map((l) => (
                  <li key={l.id}>
                    <span className="link-dot" style={{ background: LINK_TYPES[l.type].color }} />
                    <span className="muted">nach</span>
                    <b onClick={() => st.select(l.to)}>{map.get(l.to)?.title}</b>
                    <LinkTypeSelect value={l.type} onChange={(type) => st.updateLink(l.id, { type })} />
                    <button className="ghost small" onClick={() => st.removeLink(l.id)}>
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
              <div className="row">
                <select value={linkDir} onChange={(e) => setLinkDir(e.target.value as 'in' | 'out')}>
                  <option value="in">diese Karte braucht</option>
                  <option value="out">diese Karte ermöglicht</option>
                </select>
                <select value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} className="grow">
                  <option value="">Karte wählen …</option>
                  {others.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.title}
                    </option>
                  ))}
                </select>
                <LinkTypeSelect value={linkType} onChange={setLinkType} />
                <button
                  disabled={!linkTarget}
                  onClick={() => {
                    const ok =
                      linkDir === 'in'
                        ? st.addLink(linkTarget, card.id, linkType)
                        : st.addLink(card.id, linkTarget, linkType)
                    if (ok) setLinkTarget('')
                  }}
                >
                  +
                </button>
              </div>
            </section>

            <section>
              <h4>👥 RACI & Entscheider</h4>
              <div className="grid2">
                <label>
                  <span>R · Responsible</span>
                  <input defaultValue={card.raci.r.join(', ')} onBlur={(e) => up({ raci: { ...card.raci, r: list(e.target.value) } })} />
                </label>
                <label>
                  <span>A · Accountable</span>
                  <input defaultValue={card.raci.a} onBlur={(e) => up({ raci: { ...card.raci, a: e.target.value.trim() } })} />
                </label>
                <label>
                  <span>C · Consulted</span>
                  <input defaultValue={card.raci.c.join(', ')} onBlur={(e) => up({ raci: { ...card.raci, c: list(e.target.value) } })} />
                </label>
                <label>
                  <span>I · Informed</span>
                  <input defaultValue={card.raci.i.join(', ')} onBlur={(e) => up({ raci: { ...card.raci, i: list(e.target.value) } })} />
                </label>
                <label>
                  <span>⚖ Entscheider:in</span>
                  <input defaultValue={card.decider ?? ''} onBlur={(e) => up({ decider: e.target.value.trim() || undefined })} />
                </label>
              </div>
            </section>

            <section>
              <h4>📝 Logbuch</h4>
              <input
                placeholder="Notiz, Entscheidung, Erkenntnis … (Enter)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && note.trim()) (st.addLog(card.id, note.trim()), setNote(''))
                }}
              />
              <ul className="log">
                {card.log.map((l) => (
                  <li key={l.id}>
                    <small>{fmt(l.at, 'd.M. HH:mm')}</small> {l.text}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </motion.aside>
    </motion.div>
  )
}

export function LinkTypeSelect({ value, onChange }: { value: LinkType; onChange: (t: LinkType) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as LinkType)} style={{ color: LINK_TYPES[value].color }}>
      {Object.entries(LINK_TYPES).map(([k, v]) => (
        <option key={k} value={k}>
          {v.label}
        </option>
      ))}
    </select>
  )
}
