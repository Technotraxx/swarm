import { useMemo, useRef, useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { parseISO } from 'date-fns'
import { useStore } from '../store'
import { fuzzy, parseCapture } from '../lib/capture'
import { fmt, horizonRange, inRange } from '../lib/dates'
import { LEVEL_LABEL, parentLevels as parentLevelsOf } from '../lib/hierarchy'

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9äöüß]/g, '')

/**
 * Immer erreichbar (Taste N oder /): neue Karte anlegen – oder Text als ToDo an eine bestehende Karte anhängen.
 */
export function QuickCapture() {
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  const [sel, setSel] = useState(-1)
  const ref = useRef<HTMLInputElement>(null)
  const cards = useStore((s) => s.cards)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const { addCard, addContainer, addChecklist, toast, select } = useStore.getState()

  useEffect(() => {
    const h = () => ref.current?.focus()
    window.addEventListener('questdeck:capture', h)
    return () => window.removeEventListener('questdeck:capture', h)
  }, [])

  const parsed = useMemo(() => parseCapture(text), [text])
  const level = parsed.level ?? 'task'
  // #name sucht passende Projekte/Initiativen – für ein neues Projekt nur Initiativen
  const parentLevels = parentLevelsOf(level)
  const project = parsed.project
    ? cards
        .filter((c) => parentLevels.includes(c.level) && c.status !== 'done')
        .sort((a, b) => parentLevels.indexOf(a.level) - parentLevels.indexOf(b.level))
        .find((p) => norm(p.title).startsWith(norm(parsed.project!)))
    : undefined
  const matches = useMemo(() => {
    const q = parsed.title.trim()
    if (q.length < 2) return []
    return cards.filter((c) => c.status !== 'done' && fuzzy(c.title, q.split(' ').slice(0, 2).join(' '))).slice(0, 4)
  }, [cards, parsed.title])

  const create = (open: boolean) => {
    if (!parsed.title.trim()) return
    let parentId = project?.id
    if (parsed.project && !project && parentLevels.length) {
      const newLevel = parentLevels[0] as 'project' | 'roadmap'
      parentId = addContainer(newLevel, { title: parsed.project.replace(/[-_]/g, ' ') })
      toast({ icon: newLevel === 'project' ? '📦' : '🧭', text: `Neue${newLevel === 'project' ? 's Projekt' : ' Initiative'} „${parsed.project}“ angelegt` })
    }
    if (level !== 'task') {
      const id = addContainer(level, {
        title: parsed.title,
        parentId,
        urgency: parsed.urgency ?? 3,
        importance: parsed.importance ?? 3,
        due: parsed.due,
        tags: parsed.tags,
        link: parsed.link,
      })
      toast({ icon: level === 'project' ? '🗂️' : '🗺️', text: `${LEVEL_LABEL[level]} „${parsed.title}“ angelegt` })
      setText('')
      if (open) select(id)
      return
    }
    const range = horizonRange(horizon, parseISO(cursor), settings)
    const status = parsed.due && inRange(parsed.due, range) ? 'hand' : 'backlog'
    const id = addCard({
      title: parsed.title,
      parentId,
      urgency: parsed.urgency ?? 3,
      importance: parsed.importance ?? 3,
      effortHours: parsed.effortHours ?? 1,
      due: parsed.due,
      tags: parsed.tags,
      link: parsed.link,
      status,
    })
    toast({ icon: '🃏', text: `Karte gemischt → ${status === 'hand' ? 'auf die Hand' : 'in den Stapel'}` })
    setText('')
    if (open) select(id)
  }

  const append = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId)!
    addChecklist(cardId, parsed.title)
    toast({ icon: '📎', text: `An „${card.title}“ angehängt` })
    setText('')
    setSel(-1)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(matches.length - 1, s + 1)))
    else if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(-1, s - 1)))
    else if (e.key === 'Tab' && matches.length) (e.preventDefault(), append(matches[Math.max(0, sel)].id))
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (sel >= 0 && matches[sel]) append(matches[sel].id)
      else create(e.shiftKey)
    } else if (e.key === 'Escape') (setText(''), ref.current?.blur())
  }

  const open = focus && text.trim().length > 0

  return (
    <div className={`capture ${focus ? 'is-focus' : ''}`}>
      <span className="capture-icon">＋</span>
      <input
        ref={ref}
        value={text}
        onChange={(e) => (setText(e.target.value), setSel(-1))}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        onKeyDown={onKey}
        placeholder="Neue Karte …  z. B. „Angebot schreiben #launch !4 ~2h @fr“   (N)"
        aria-label="Schnell-Eingabe"
      />
      <AnimatePresence>
        {open && (
          <motion.div
            className="capture-pop"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            <div className="capture-chips">
              <b>{parsed.title || '…'}</b>
              {parsed.project && (
                <span className="chip" style={{ borderColor: project?.color }}>
                  {project ? `${project.emoji} ${project.title}` : `📦 neu: ${parsed.project}`}
                </span>
              )}
              {level !== 'task' && <span className="chip on">{LEVEL_LABEL[level]}</span>}
              {parsed.urgency && <span className="chip">⚡ {parsed.urgency}</span>}
              {parsed.importance && <span className="chip">◆ {parsed.importance}</span>}
              {parsed.effortHours && <span className="chip">⏱ {parsed.effortHours} h</span>}
              {parsed.due && <span className="chip">🏁 {fmt(parsed.due, 'EEE d. MMM')}</span>}
              {parsed.tags.map((t) => (
                <span key={t} className="chip">
                  #{t}
                </span>
              ))}
              {parsed.link && <span className="chip">🔗 Link</span>}
            </div>
            <div className="capture-hint">
              <kbd>Enter</kbd> neue Karte · <kbd>⇧ Enter</kbd> anlegen & öffnen
              {matches.length > 0 && (
                <>
                  {' '}
                  · <kbd>Tab</kbd> an Karte anhängen
                </>
              )}
            </div>
            {matches.length > 0 && (
              <ul className="capture-matches">
                {matches.map((c, i) => (
                  <li key={c.id} className={i === sel ? 'sel' : ''} onMouseDown={() => append(c.id)}>
                    📎 als ToDo an <b>{c.emoji} {c.title}</b> anhängen
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
