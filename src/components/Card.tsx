import { memo, useRef, type CSSProperties, type ReactNode } from 'react'
import type { Card as CardT } from '../types'
import { useStore } from '../store'
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
  const project = useStore((s) => (card.projectId ? s.projects.find((p) => p.id === card.projectId) : undefined))
  const ref = useRef<HTMLDivElement>(null)
  const rar = rarity(card)
  const progress = checklistProgress(card)
  const due = card.due ? daysUntil(card.due) : undefined
  const { age, days } = cardAge(card)
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
      className={`tcg tcg-${size} rar-${rar} ${card.status === 'done' ? 'is-done' : ''} ${blocked ? 'is-blocked' : ''} ${critical ? 'is-critical' : ''} ${dim ? 'is-dim' : ''} age-${age} ${className}`}
      style={{ '--rar': RARITY[rar].color, '--proj': project?.color ?? 'transparent', ...style } as CSSProperties}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
    >
      <div className="tcg-inner">
        <header className="tcg-head">
          <span className="tcg-title" title={card.title}>
            {card.title}
          </span>
          <span className="tcg-mana" title={`Aufwand ${card.effortHours} h`}>
            {points(card.effortHours)}
          </span>
        </header>

        <div
          className="tcg-art"
          style={{
            background: card.imageUrl ? `center/cover url("${card.imageUrl}")` : MOTIFS[card.motif % MOTIFS.length],
          }}
        >
          {!card.imageUrl && <span className="tcg-emoji">{card.emoji}</span>}
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
          <span className="ellipsis">{project ? `${project.emoji} ${project.name}` : 'Ohne Projekt'}</span>
          <span className="tcg-rarity">{RARITY[rar].label}</span>
        </div>

        <div className="tcg-text">
          {card.description ? <p>{card.description}</p> : null}
          {card.checklist.length > 0 && (
            <div className="tcg-progress" title={`${Math.round(progress * 100)} % der Checkliste`}>
              <div style={{ width: `${progress * 100}%` }} />
              <span>
                {card.checklist.filter((i) => i.done).length}/{card.checklist.length}
              </span>
            </div>
          )}
          {!card.description && !card.checklist.length && <p className="muted">{card.effortHours} h Aufwand</p>}
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
