import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'
import { useStore } from '../store'
import type { Card } from '../types'
import { Drop } from '../components/Dnd'
import { colorOf } from '../lib/hierarchy'
import { CapacityButton } from '../components/Inline'
import { capacityFor, fmt, today } from '../lib/dates'
import { blocksForDay, dayStartOf, fmtHour, lanes, type Block } from '../lib/schedule'

/** Pixel pro Stunde im Raster */
export const HOUR_PX = 44

/**
 * Stundenraster für Tag und Woche: Karten auf eine Uhrzeit ziehen, Blöcke verschieben,
 * unten am Block ziehen ändert die Dauer. Grau = außerhalb der Tageskapazität.
 */
export function HourGrid({ days }: { days: string[] }) {
  const cards = useStore((s) => s.cards)
  const settings = useStore((s) => s.settings)
  const dayStart = dayStartOf(settings)

  const perDay = useMemo(() => days.map((d) => blocksForDay(cards, d, dayStart)), [cards, days, dayStart])

  // Raster: mindestens Arbeitszeit ±1 h, erweitert um Blöcke außerhalb
  const maxCap = Math.max(...days.map((d) => capacityFor(d, settings)), 6)
  let from = Math.max(0, dayStart - 1)
  let to = Math.min(24, dayStart + maxCap + 2)
  for (const blocks of perDay)
    for (const b of blocks) {
      from = Math.min(from, Math.floor(b.start))
      to = Math.max(to, Math.ceil(b.start + b.hours))
    }
  to = Math.min(24, to)
  const hours = Array.from({ length: to - from }, (_, i) => from + i)

  return (
    <div className="hour-grid" style={{ '--cols': days.length, '--hpx': `${HOUR_PX}px` } as React.CSSProperties}>
      <div className="hg-corner" />
      {days.map((d, i) => (
        <DayHead key={d} date={d} blocks={perDay[i]} />
      ))}
      <div className="hg-times" style={{ height: (to - from) * HOUR_PX }}>
        {hours.map((h) => (
          <span key={h} style={{ top: (h - from) * HOUR_PX }}>
            {h}:00
          </span>
        ))}
      </div>
      {days.map((d, i) => (
        <HourColumn key={d} date={d} blocks={perDay[i]} from={from} to={to} dayStart={dayStart} />
      ))}
    </div>
  )
}

function DayHead({ date, blocks }: { date: string; blocks: Block[] }) {
  const cards = useStore((s) => s.cards)
  const settings = useStore((s) => s.settings)
  const { drawHand } = useStore.getState()
  const cap = capacityFor(date, settings)
  const booked = blocks.filter((b) => cards.find((c) => c.id === b.cardId)?.status !== 'done').reduce((s, b) => s + b.hours, 0)
  const load = cap ? booked / cap : booked ? 2 : 0
  const due = cards.filter((c) => c.due === date && c.status !== 'done')
  const past = date < today()


  return (
    <Drop id={`day:${date}`} className={`hg-head ${date === today() ? 'today' : ''}`}>
      <div className="row-between">
        <b>{fmt(date, 'EEE d.')}</b>
        <CapacityButton date={date} booked={booked} />
      </div>
      <div className="cap-bar">
        <motion.div
          className={load > 1 ? 'over' : load > 0.85 ? 'warn' : ''}
          animate={{ width: `${Math.min(100, load * 100)}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>
      <div className="row-between hg-head-foot">
        <span className="due-flag" title={due.map((c) => c.title).join(', ')}>
          {due.length ? `🏁 ${due.length} fällig` : ''}
        </span>
        {!past && cap > booked && (
          <button className="ghost small" onClick={() => drawHand(date)} title="Diesen Tag nach Priorität bis zur Kapazität füllen">
            🖐️ füllen
          </button>
        )}
      </div>
    </Drop>
  )
}

function HourColumn({
  date,
  blocks,
  from,
  to,
  dayStart,
}: {
  date: string
  blocks: Block[]
  from: number
  to: number
  dayStart: number
}) {
  const settings = useStore((s) => s.settings)
  const cards = useStore((s) => s.cards)
  const cap = capacityFor(date, settings)
  const lane = lanes(blocks)
  const cells = Array.from({ length: (to - from) * 2 }, (_, i) => from + i / 2)
  const isToday = date === today()
  const nowH = useNowHour()

  const workTop = (dayStart - from) * HOUR_PX
  const workH = cap * HOUR_PX
  const booked = blocks.reduce((s, b) => s + b.hours, 0)

  return (
    <div className={`hg-col ${isToday ? 'today' : ''} ${booked > cap ? 'over' : ''}`} style={{ height: (to - from) * HOUR_PX }}>
      <div className="hg-work" style={{ top: workTop, height: workH }} />
      {cells.map((h) => (
        <Drop key={h} id={`hour:${date}:${h}`} className={`hg-cell ${h % 1 ? 'half' : ''}`} style={{ top: (h - from) * HOUR_PX }} />
      ))}
      <AnimatePresence>
        {blocks.map((b) => {
          const card = cards.find((c) => c.id === b.cardId)
          if (!card) return null
          const l = lane.get(b) ?? { lane: 0, of: 1 }
          return <SlotBlock key={`${b.cardId}-${b.date}`} card={card} block={b} from={from} lane={l.lane} of={l.of} />
        })}
      </AnimatePresence>
      {isToday && nowH >= from && nowH <= to && <div className="hg-now" style={{ top: (nowH - from) * HOUR_PX }} />}
    </div>
  )
}

function useNowHour() {
  const get = () => {
    const d = new Date()
    return d.getHours() + d.getMinutes() / 60
  }
  const [h, setH] = useState(get)
  useEffect(() => {
    const t = setInterval(() => setH(get()), 60_000)
    return () => clearInterval(t)
  }, [])
  return h
}

function SlotBlock({ card, block, from, lane, of }: { card: Card; block: Block; from: number; lane: number; of: number }) {
  const { setSlot, select, completeCard } = useStore.getState()
  const color = useStore((s) => colorOf(s.cards, card))
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `slot:${card.id}:${block.date}`,
    data: { card, date: block.date, start: block.start },
  })
  const [resize, setResize] = useState<number | null>(null)
  const hours = resize ?? block.hours

  const onResize = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const y0 = e.clientY
    let h = block.hours
    const move = (ev: PointerEvent) => {
      h = Math.max(0.5, Math.round((block.hours + (ev.clientY - y0) / HOUR_PX) * 2) / 2)
      setResize(h)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setResize(null)
      if (h !== block.hours) setSlot(card.id, block.date, h)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      layout="position"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className={`hg-block ${card.status === 'done' ? 'done' : ''} ${hours < 1 ? 'tiny' : ''}`}
      style={
        {
          top: (block.start - from) * HOUR_PX + 1,
          height: hours * HOUR_PX - 2,
          left: `calc(${(lane / of) * 100}% + 2px)`,
          width: `calc(${100 / of}% - 4px)`,
          '--c': color ?? 'var(--accent)',
        } as React.CSSProperties
      }
      onClick={() => select(card.id)}
      title={`${card.title} · ${fmtHour(block.start)}–${fmtHour(block.start + hours)}`}
    >
      <div className="hg-block-title">
        <span>{card.emoji}</span> {card.title}
      </div>
      {hours >= 1 && (
        <small>
          {fmtHour(block.start)}–{fmtHour(block.start + hours)} · {hours} h
        </small>
      )}
      <span className="hg-block-ctrl" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        {card.status !== 'done' && (
          <button className="ok" title="Erledigt" onClick={() => completeCard(card.id)}>
            ✓
          </button>
        )}
        <button title="Zeitblock entfernen" onClick={() => setSlot(card.id, block.date, 0)}>
          ✕
        </button>
      </span>
      <i className="hg-resize" onPointerDown={onResize} title="Ziehen = Dauer ändern" />
    </motion.div>
  )
}
