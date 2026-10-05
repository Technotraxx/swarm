import { useDraggable, useDroppable } from '@dnd-kit/core'
import { motion } from 'framer-motion'
import type { CSSProperties, ReactNode } from 'react'
import type { Card } from '../types'
import { useStore } from '../store'
import { TaskCard, type CardSize } from './Card'

/** Drop-Ziele werden über ihre ID adressiert, z. B. "col:doing", "day:2026-10-07", "project:p1", "kr:kr2", "pile". */
export function Drop({
  id,
  className = '',
  children,
  style,
}: {
  id: string
  className?: string
  children?: ReactNode
  style?: CSSProperties
}) {
  const { setNodeRef, isOver, active } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'drop-over' : ''} ${active ? 'drop-armed' : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

export function DraggableCard({
  card,
  size = 'md',
  blocked,
  critical,
  dim,
  actions = true,
}: {
  card: Card
  size?: CardSize
  blocked?: boolean
  critical?: boolean
  dim?: boolean
  actions?: boolean
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: `card:${card.id}`, data: { card } })
  const select = useStore((s) => s.select)
  const complete = useStore((s) => s.completeCard)
  const move = useStore((s) => s.moveCard)

  return (
    <motion.div
      layout
      layoutId={`card-${card.id}`}
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: isDragging ? 0.25 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className="drag-wrap"
      ref={setNodeRef}
      {...attributes}
      {...listeners}
    >
      <TaskCard card={card} size={size} blocked={blocked} critical={critical} dim={dim} onClick={() => select(card.id)}>
        {actions && card.status !== 'done' && (
          <div className="card-actions" onPointerDown={(e) => e.stopPropagation()}>
            {card.status !== 'doing' && (
              <button title="Ins Spiel bringen" onClick={(e) => (e.stopPropagation(), move(card.id, 'doing'))}>
                ▶
              </button>
            )}
            <button className="ok" title="Erledigt – ab auf den Stapel" onClick={(e) => (e.stopPropagation(), complete(card.id))}>
              ✓
            </button>
          </div>
        )}
      </TaskCard>
    </motion.div>
  )
}
