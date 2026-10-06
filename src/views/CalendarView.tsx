import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDraggable } from '@dnd-kit/core'
import { eachWeekOfInterval, endOfWeek, parseISO } from 'date-fns'
import { bookedHours, useStore } from '../store'
import type { Card } from '../types'
import { DraggableCard, Drop } from '../components/Dnd'
import { CapacityButton } from '../components/Inline'
import { capacityFor, daysIn, fmt, horizonRange, iso, today } from '../lib/dates'
import { priority, unscheduledHours } from '../lib/game'
import { HourGrid } from './HourGrid'
import { colorOf } from '../lib/hierarchy'

/** Linse „Kapazität“: Wann arbeite ich woran? Karten auf Tage ziehen = Zeit blocken. */
export function CalendarView() {
  const cards = useStore((s) => s.cards)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const { setHorizon, setCursor } = useStore.getState()

  const range = horizonRange(horizon, parseISO(cursor), settings)
  const days = daysIn(range).map(iso)

  const tray = useMemo(
    () =>
      cards
        .filter((c) => c.level === 'task' && c.status !== 'done' && unscheduledHours(c) > 0)
        .sort((a, b) => priority(b) - priority(a)),
    [cards],
  )

  const mode = days.length <= 7 ? 'hours' : days.length <= 14 ? 'days' : days.length <= 31 ? 'month' : 'weeks'

  return (
    <div className="calendar">
      <aside className="tray">
        <div className="tray-head">
          <h3>Ungeplant</h3>
          <small className="muted">{mode === 'hours' ? 'auf eine Uhrzeit ziehen' : 'auf einen Tag ziehen'}</small>
        </div>
        <div className="tray-list">
          <AnimatePresence mode="popLayout">
            {tray.map((c) => (
              <div key={c.id} className="tray-item">
                <DraggableCard card={c} size="sm" actions={false} />
                <span className="tray-hours">{unscheduledHours(c)} h offen</span>
              </div>
            ))}
          </AnimatePresence>
          {tray.length === 0 && <p className="muted">Alles verplant 🎉</p>}
        </div>
        <CapacityEditor />
      </aside>

      <div className="cal-main">
        {mode === 'hours' ? (
          <HourGrid days={days} />
        ) : mode === 'weeks' ? (
          <WeekHeatmap
            onPick={(d) => {
              setHorizon('week')
              setCursor(d)
            }}
          />
        ) : (
          <div className={`cal-grid ${mode} n${Math.min(days.length, 7)}`}>
            {mode === 'month' &&
              ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                <div key={d} className="cal-dow">
                  {d}
                </div>
              ))}
            {mode === 'month' &&
              Array.from({ length: (parseISO(days[0]).getDay() + 6) % 7 }).map((_, i) => <div key={`pad${i}`} />)}
            {days.map((d) => (
              <Day key={d} date={d} compact={mode === 'month'} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Day({ date, compact }: { date: string; compact: boolean }) {
  const cards = useStore((s) => s.cards)
  const settings = useStore((s) => s.settings)
  const cap = capacityFor(date, settings)
  const booked = bookedHours(cards, date)
  const load = cap ? booked / cap : booked ? 2 : 0
  const slots = cards.flatMap((c) => c.slots.filter((s) => s.date === date).map((s) => ({ card: c, hours: s.hours })))
  const due = cards.filter((c) => c.due === date && c.status !== 'done')
  const isToday = date === today()
  const weekend = [0, 6].includes(parseISO(date).getDay())


  return (
    <Drop id={`day:${date}`} className={`cal-day ${isToday ? 'today' : ''} ${weekend ? 'weekend' : ''} ${compact ? 'compact' : ''}`}>
      <div className="cal-day-head">
        <div>
          <b>{fmt(date, compact ? 'd' : 'EEE d.')}</b>
          {!compact && <small>{fmt(date, 'MMM')}</small>}
        </div>
        <CapacityButton date={date} booked={booked} />
      </div>
      <div className="cap-bar">
        <motion.div
          className={load > 1 ? 'over' : load > 0.85 ? 'warn' : ''}
          animate={{ width: `${Math.min(100, load * 100)}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        />
      </div>
      <div className="cal-slots">
        <AnimatePresence>
          {slots.map(({ card, hours }) => (
            <SlotChip key={card.id} card={card} date={date} hours={hours} compact={compact} />
          ))}
        </AnimatePresence>
        {due.map((c) => (
          <div key={c.id} className="due-flag" title={`Fällig: ${c.title}`}>
            🏁 {c.title}
          </div>
        ))}
      </div>
      {load > 1 && !compact && <div className="over-note">⚠️ {booked - cap} h überbucht</div>}
    </Drop>
  )
}

function SlotChip({ card, date, hours, compact }: { card: Card; date: string; hours: number; compact: boolean }) {
  const { setSlot, select, completeCard } = useStore.getState()
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({
    id: `slot:${card.id}:${date}`,
    data: { card, date },
  })
  const color = useStore((s) => colorOf(s.cards, card))
  return (
    <motion.div
      layout
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: isDragging ? 0.3 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`slot ${card.status === 'done' ? 'done' : ''}`}
      style={{ '--c': color ?? 'var(--accent)', minHeight: compact ? undefined : `${Math.max(1, hours) * 18}px` } as React.CSSProperties}
      onClick={() => select(card.id)}
    >
      <span className="slot-emoji">{card.emoji}</span>
      <span className="slot-title">{card.title}</span>
      {!compact && (
        <span className="slot-ctrl" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setSlot(card.id, date, hours - 0.5)}>−</button>
          <b>{hours}h</b>
          <button onClick={() => setSlot(card.id, date, hours + 0.5)}>+</button>
          {card.status !== 'done' && (
            <button className="ok" title="Erledigt" onClick={() => completeCard(card.id)}>
              ✓
            </button>
          )}
        </span>
      )}
      {compact && <b className="slot-h">{hours}h</b>}
    </motion.div>
  )
}

function WeekHeatmap({ onPick }: { onPick: (d: string) => void }) {
  const cards = useStore((s) => s.cards)
  const settings = useStore((s) => s.settings)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const range = horizonRange(horizon, parseISO(cursor), settings)
  const weeks = eachWeekOfInterval(range, { weekStartsOn: 1 })
  return (
    <div className="weeks">
      <p className="muted">Wochenauslastung – klicke eine Woche, um sie zu planen.</p>
      {weeks.map((w) => {
        const days = daysIn({ start: w, end: endOfWeek(w, { weekStartsOn: 1 }) }).map(iso)
        const cap = days.reduce((s, d) => s + capacityFor(d, settings), 0)
        const booked = days.reduce((s, d) => s + bookedHours(cards, d), 0)
        const due = cards.filter((c) => c.status !== 'done' && c.due && days.includes(c.due)).length
        const load = cap ? booked / cap : 0
        return (
          <button key={w.toISOString()} className="week-row" onClick={() => onPick(iso(w))}>
            <span className="week-label">KW {fmt(w, 'I')}</span>
            <small className="muted">{fmt(w, 'd. MMM')}</small>
            <div className="cap-bar big">
              <div className={load > 1 ? 'over' : load > 0.85 ? 'warn' : ''} style={{ width: `${Math.min(100, load * 100)}%` }} />
            </div>
            <span>
              {booked}/{cap} h
            </span>
            <span className="muted">{due ? `🏁 ${due}` : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

function CapacityEditor() {
  const settings = useStore((s) => s.settings)
  const { updateSettings } = useStore.getState()
  const [open, setOpen] = useState(false)
  return (
    <div className="cap-editor">
      <button className="ghost small" onClick={() => setOpen((o) => !o)}>
        ⚙️ Meine Standard-Kapazität {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="cap-days">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d, i) => (
            <label key={d}>
              <span>{d}</span>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                value={settings.capacity[i]}
                onChange={(e) => {
                  const capacity = [...settings.capacity]
                  capacity[i] = Number(e.target.value)
                  updateSettings({ capacity })
                }}
              />
            </label>
          ))}
          <label className="sprint-anchor">
            <span>Arbeitsbeginn (Uhr)</span>
            <input
              type="number"
              min={0}
              max={20}
              step={0.5}
              value={settings.dayStart ?? 9}
              onChange={(e) => updateSettings({ dayStart: Number(e.target.value) })}
            />
          </label>
          <label className="sprint-anchor">
            <span>Sprint-Start (Anker)</span>
            <input type="date" value={settings.sprintAnchor} onChange={(e) => updateSettings({ sprintAnchor: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  )
}
