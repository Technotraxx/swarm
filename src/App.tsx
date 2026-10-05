import { useEffect, useState } from 'react'
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
import { HelpModal, IOModal, ProjectEditor } from './components/Modals'
import { BoardView } from './views/BoardView'
import { ProjectsView } from './views/ProjectsView'
import { RoadmapView } from './views/RoadmapView'
import { GraphView } from './views/GraphView'
import { CalendarView } from './views/CalendarView'
import { OkrView } from './views/OkrView'
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
  const editingProject = useStore((s) => s.editingProject)
  const showHelp = useStore((s) => s.showHelp)
  const showIO = useStore((s) => s.showIO)
  const theme = useStore((s) => s.settings.theme)
  const [active, setActive] = useState<Card | null>(null)
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

  const onStart = (e: DragStartEvent) => setActive((e.active.data.current?.card as Card) ?? null)

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
        if (fromDate) {
          if (fromDate === target) return
          // Zeitblock verschieben
          const hours = card.slots.find((s) => s.date === fromDate)?.hours ?? 1
          st.setSlot(card.id, fromDate, 0)
          st.schedule(card.id, target, hours)
        } else st.schedule(card.id, target)
        break
      }
      case 'project': {
        const projectId = target === 'none' ? undefined : target
        if (card.projectId === projectId) return
        st.updateCard(card.id, { projectId })
        const p = st.projects.find((x) => x.id === projectId)
        st.toast({ icon: p?.emoji ?? '🗃️', text: p ? `„${card.title}“ → ${p.name}` : `„${card.title}“ ohne Projekt` })
        break
      }
      case 'kr': {
        st.updateCard(card.id, { krId: target })
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
        {active ? (
          <div className="drag-overlay">
            <TaskCard card={active} size={view === 'board' ? 'md' : 'sm'} tilt={false} />
          </div>
        ) : null}
      </DragOverlay>

      <FlightLayer />
      <Toasts />
      <AnimatePresence>{selected && <CardDetail key={selected} id={selected} />}</AnimatePresence>
      <AnimatePresence>{editingProject && <ProjectEditor key={editingProject} id={editingProject} />}</AnimatePresence>
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
        else if (st.editingProject) st.editProject(undefined)
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
