import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { parseISO } from 'date-fns'
import { useStore } from './store'
import type { Card, CardStatus, ViewId } from './types'
import { TopBar } from './components/TopBar'
import { TaskCard } from './components/Card'
import { DiscardPile, DrawPile, FlightLayer, Toasts } from './components/Piles'
import { CardDetail } from './components/CardDetail'
import { HelpModal, IOModal } from './components/Modals'
import { BoardView } from './views/BoardView'
import { ProjectsView } from './views/ProjectsView'
import { RoadmapView } from './views/RoadmapView'
import { GraphView } from './views/GraphView'
import { CalendarView } from './views/CalendarView'
import { OkrView } from './views/OkrView'
import { HOUR_PX } from './views/HourGrid'
import { iso, shiftCursor, today } from './lib/dates'

const VIEWS: Record<ViewId, () => React.ReactElement> = {
  board: BoardView,
  projects: ProjectsView,
  roadmap: RoadmapView,
  graph: GraphView,
  calendar: CalendarView,
  okr: OkrView,
}
const ORDER: ViewId[] = ['board', 'projects', 'roadmap', 'graph', 'calendar', 'okr']

/** Zoom-Metapher: Task → Projekt → Roadmap ist "rauszoomen" */
const DEPTH: Record<ViewId, number> = { board: 0, projects: 1, roadmap: 2, graph: 0.5, calendar: 0.5, okr: 1.5 }

// Zuerst schauen, worüber der Mauszeiger ist – fühlt sich bei kleinen Zielen (Stapel, Tage) natürlicher an
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

export default function App() {
  const view = useStore((s) => s.view)
  const selected = useStore((s) => s.selected)
  const showHelp = useStore((s) => s.showHelp)
  const showIO = useStore((s) => s.showIO)
  const theme = useStore((s) => s.settings.theme)
  const [active, setActive] = useState<{ card: Card; slot: boolean } | null>(null)
  // Wo wurde ein Zeitblock gegriffen? (in Stunden ab Blockanfang) – damit er beim Ablegen nicht springt
  const grab = useRef(0)
  const [prevDepth, setPrevDepth] = useState(DEPTH[view])
  const dir = DEPTH[view] >= prevDepth ? 1 : -1

  useEffect(() => {
    setPrevDepth(DEPTH[view])
  }, [view])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  )

  useKeyboard()

  const onStart = (e: DragStartEvent) => {
    const card = e.active.data.current?.card as Card | undefined
    const slot = e.active.data.current?.date !== undefined
    const rect = e.active.rect.current.initial
    const y = (e.activatorEvent as PointerEvent | null)?.clientY
    grab.current = slot && rect && y !== undefined ? Math.floor(((y - rect.top) / HOUR_PX) * 2) / 2 : 0
    setActive(card ? { card, slot } : null)
  }

  const onEnd = (e: DragEndEvent) => {
    setActive(null)
    const card = e.active.data.current?.card as Card | undefined
    const over = e.over?.id ? String(e.over.id) : undefined
    if (!card || !over) return
    const st = useStore.getState()
    const fromDate = e.active.data.current?.date as string | undefined
    const [kind, ...rest] = over.split(':')
    const target = rest.join(':')

    switch (kind) {
      case 'col':
        st.moveCard(card.id, target as CardStatus)
        break
      case 'draw':
        st.moveCard(card.id, 'backlog')
        break
      case 'pile': {
        const r = e.active.rect.current.translated
        st.completeCard(card.id, r ? { x: r.left, y: r.top, width: r.width, height: r.height } : undefined)
        break
      }
      case 'day': {
        if (fromDate) st.moveSlot(card.id, fromDate, target)
        else st.schedule(card.id, target)
        break
      }
      case 'hour': {
        // target = "yyyy-MM-dd:9.5"
        const [date, h] = [target.slice(0, 10), Number(target.slice(11))]
        const start = Math.max(0, h - grab.current)
        if (fromDate) st.moveSlot(card.id, fromDate, date, start)
        else st.schedule(card.id, date, undefined, start)
        break
      }
      case 'parent': {
        // Karte unter ein Projekt / eine Initiative legen ("parent:none" löst sie)
        const parentId = target.startsWith('none') ? undefined : target
        if (parentId === card.id) return
        if (st.setParent(card.id, parentId)) {
          const p = st.cards.find((x) => x.id === parentId)
          st.toast({ icon: p?.emoji ?? '🗃️', text: p ? `„${card.title}“ → ${p.title}` : `„${card.title}“ hängt jetzt frei` })
        }
        break
      }
      case 'kr': {
        st.assignKr(card.id, target)
        st.toast({ icon: '🎯', text: `„${card.title}“ zahlt jetzt auf das Key Result ein` })
        break
      }
    }
  }

  const View = VIEWS[view]

  return (
    <DndContext sensors={sensors} collisionDetection={collision} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      <div className={`app view-${view}`}>
        <TopBar />
        <main className="stage">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={view}
              className="view"
              custom={dir}
              initial={{ opacity: 0, scale: dir > 0 ? 1.06 : 0.94, filter: 'blur(6px)' }}
              animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: dir > 0 ? 0.94 : 1.06, filter: 'blur(6px)' }}
              transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            >
              <View />
            </motion.div>
          </AnimatePresence>
        </main>
        <DrawPile />
        <DiscardPile />
      </div>

      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(.2,.8,.2,1)' }}>
        {active?.slot ? (
          <div className="drag-overlay slot-overlay">
            {active.card.emoji} {active.card.title}
          </div>
        ) : active ? (
          <div className="drag-overlay">
            <TaskCard card={active.card} size={view === 'board' ? 'md' : 'sm'} tilt={false} />
          </div>
        ) : null}
      </DragOverlay>

      <FlightLayer />
      <Toasts />
      <AnimatePresence>{selected && <CardDetail key={selected} id={selected} />}</AnimatePresence>
      <AnimatePresence>{showIO && <IOModal />}</AnimatePresence>
      <AnimatePresence>{showHelp && <HelpModal />}</AnimatePresence>
    </DndContext>
  )
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const st = useStore.getState()
      if (e.key === 'Escape') {
        if (st.selected) st.select(undefined)
        else if (st.showIO) st.toggleIO(false)
        else if (st.showHelp) st.toggleHelp(false)
        return
      }
      if (t.closest('input, textarea, select, [contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= 6) return st.setView(ORDER[n - 1])
      switch (e.key) {
        case 'n':
        case '/':
          e.preventDefault()
          window.dispatchEvent(new Event('questdeck:capture'))
          break
        case 'd':
          st.drawHand()
          break
        case 'D':
          st.drawCard()
          break
        case '?':
          st.toggleHelp()
          break
        case 't':
          st.setCursor(today())
          break
        case '[':
          st.setCursor(iso(shiftCursor(st.horizon, parseISO(st.cursor), -1)))
          break
        case ']':
          st.setCursor(iso(shiftCursor(st.horizon, parseISO(st.cursor), 1)))
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
