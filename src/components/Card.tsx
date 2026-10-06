import { memo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Card as CardT } from '../types'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { LEVEL_LABEL, colorOf, rollup } from '../lib/hierarchy'
import { MOTIFS, RARITY, checklistProgress, initials, personColor, points, rarity } from '../lib/game'
import { daysUntil, fmt } from '../lib/dates'
import { AGE_LABEL, cardAge } from '../lib/schedule'

export type CardSize = 'sm' | 'md' | 'lg'

interface Props {
  card: CardT
  size?: CardSize
  blocked?: boolean
  critical?: boolean
  tilt?: boolean
  dim?: boolean
  className?: string
  style?: CSSProperties
  children?: ReactNode
  onClick?: () => void
}

/** Die Aufgabe als Sammelkarte: Mana = Aufwand, Rahmen = Seltenheit, Werte unten = Dringlichkeit & Wichtigkeit. */
export const TaskCard = memo(function TaskCard({
  card,
  size = 'md',
  blocked,
  critical,
  tilt = true,
  dim,
  className = '',
  style,
  children,
  onClick,
}: Props) {
  const parent = useStore((s) => (card.parentId ? s.cards.find((c) => c.id === card.parentId) : undefined))
  const color = useStore((s) => colorOf(s.cards, card))
  const roll = useStore(useShallow((s) => (card.level === 'task' ? null : rollup(s.cards, card))))
  const container = card.level !== 'task'
  const ref = useRef<HTMLDivElement>(null)
  const rar = rarity(card)
  const progress = checklistProgress(card)
  const due = card.due ? daysUntil(card.due) : undefined
  const { age, days } = container ? { age: 0 as const, days: 0 } : cardAge(card)
  const hours = roll ? roll.total : card.effortHours
  const people = [...new Set([...card.raci.r, card.raci.a].filter(Boolean))]

  const onMove = (e: React.PointerEvent) => {
    if (!tilt || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    ref.current.style.setProperty('--rx', `${(0.5 - y) * 14}deg`)
    ref.current.style.setProperty('--ry', `${(x - 0.5) * 18}deg`)
    ref.current.style.setProperty('--mx', `${x * 100}%`)
    ref.current.style.setProperty('--my', `${y * 100}%`)
  }
  const onLeave = () => {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }

  return (
    <div
      ref={ref}
      data-card-id={card.id}
      className={`tcg tcg-${size} lvl-${card.level} rar-${rar} ${card.status === 'done' ? 'is-done' : ''} ${blocked ? 'is-blocked' : ''} ${critical ? 'is-critical' : ''} ${dim ? 'is-dim' : ''} age-${age} ${className}`}
      style={{ '--rar': RARITY[rar].color, '--proj': color ?? 'transparent', ...style } as CSSProperties}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
    >
      <div className="tcg-inner">
        <header className="tcg-head">
          <span className="tcg-title" title={card.title}>
            {card.title}
          </span>
          <span className="tcg-mana" title={container ? `Σ ${hours} h aus ${roll?.count ?? 0} Karten` : `Aufwand ${hours} h`}>
            {points(hours)}
          </span>
        </header>

        <div
          className="tcg-art"
          style={{
            background: card.imageUrl ? `center/cover url("${card.imageUrl}")` : MOTIFS[card.motif % MOTIFS.length],
          }}
        >
          {!card.imageUrl && <span className="tcg-pattern" data-p={card.motif % 6} />}
          {!card.imageUrl && <span className="tcg-emoji">{card.emoji}</span>}
          <span className="tcg-art-hours">
            {hours}
            <small>Std</small>
          </span>
          <span className="tcg-dots" title={`Dringlichkeit ${card.urgency} von 5`}>
            {[1, 2, 3, 4, 5].map((n) => (
              <i key={n} className={n <= card.urgency ? 'on' : ''} />
            ))}
          </span>
          {due !== undefined && card.status !== 'done' && (
            <span className={`tcg-due ${due < 0 ? 'late' : due <= 1 ? 'soon' : ''}`}>
              {due < 0 ? `${-due} T überfällig` : due === 0 ? 'heute' : due === 1 ? 'morgen' : fmt(card.due!, 'd. MMM')}
            </span>
          )}
          {card.link && (
            <a
              className="tcg-link"
              href={card.link}
              target="_blank"
              rel="noreferrer"
              title={card.link}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              🔗
            </a>
          )}
          {age > 0 && (
            <span className="tcg-age" title={`Seit ${days} Tagen nicht angefasst – zieh sie, plane sie oder wirf sie weg`}>
              {age === 3 ? '🕸️' : '⏳'} {AGE_LABEL[age]} · {days} T
            </span>
          )}
          {blocked && <span className="tcg-chain" title="Blockiert durch offene Abhängigkeit">⛓️</span>}
        </div>

        <div className="tcg-type">
          <span className="tcg-proj-dot" />
          <span className="ellipsis">
            {parent ? `${container ? 'in ' : ''}${parent.emoji} ${parent.title}` : container ? LEVEL_LABEL[card.level] : 'Ohne Projekt'}
          </span>
          <span className="tcg-rarity">{container ? LEVEL_LABEL[card.level] : RARITY[rar].label}</span>
        </div>

        <div className="tcg-text">
          {card.description ? <p>{card.description}</p> : null}
          {roll && roll.count > 0 && (
            <div className="tcg-progress" title={`${roll.done} von ${roll.total} h erledigt`}>
              <div style={{ width: `${roll.value * 100}%` }} />
              <span>
                {roll.count - roll.open}/{roll.count} Karten · {Math.round(roll.value * 100)} %
              </span>
            </div>
          )}
          {card.checklist.length > 0 && (
            <div className="tcg-progress" title={`${Math.round(progress * 100)} % der Checkliste`}>
              <div style={{ width: `${progress * 100}%` }} />
              <span>
                {card.checklist.filter((i) => i.done).length}/{card.checklist.length}
              </span>
            </div>
          )}
          {!card.description && !card.checklist.length && !roll?.count && <p className="muted">{hours} h Aufwand</p>}
        </div>

        <footer className="tcg-stats">
          <span className="tcg-stat urg" title="Dringlichkeit">
            ⚡{card.urgency}
          </span>
          <span className="tcg-people">
            {people.slice(0, 3).map((p) => (
              <i key={p} style={{ background: personColor(p) }} title={p}>
                {initials(p)}
              </i>
            ))}
            {card.decider && (
              <i className="decider" title={`Entscheider: ${card.decider}`}>
                ⚖
              </i>
            )}
          </span>
          <span className="tcg-stat imp" title="Wichtigkeit">
            ◆{card.importance}
          </span>
        </footer>
      </div>
      <div className="tcg-shine" />
      {children}
    </div>
  )
})

/** Kartenrücken für Stapel */
export function CardBack({ size = 'md', style }: { size?: CardSize; style?: CSSProperties }) {
  return (
    <div className={`tcg tcg-${size} tcg-back`} style={style}>
      <div className="tcg-back-inner">
        <span>🃏</span>
      </div>
    </div>
  )
}
