import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Card,
  CardStatus,
  Horizon,
  ID,
  KeyResult,
  Link,
  LinkType,
  Objective,
  Project,
  Settings,
  Slot,
  Stats,
  ViewId,
} from './types'
import { capacityFor, iso, today } from './lib/dates'
import { priority, unscheduledHours, xpFor } from './lib/game'
import { createsCycle } from './lib/graph'
import { play } from './lib/sound'
import { demoData } from './seed'
import { addDays, parseISO } from 'date-fns'

export const PROJECT_COLORS = ['#7c6cff', '#ff7a9a', '#37c9a6', '#ffb547', '#4aa8ff', '#ff6a3d', '#b06bff', '#8bd346']

export const uid = () => Math.random().toString(36).slice(2, 10)
const now = () => new Date().toISOString()

export interface Flight {
  id: string
  card: Card
  from: { x: number; y: number; width: number; height: number }
  kind: 'done' | 'draw'
}

export interface Toast {
  id: string
  text: string
  icon?: string
  action?: { label: string; run: () => void }
}

export interface Data {
  cards: Card[]
  links: Link[]
  projects: Project[]
  objectives: Objective[]
  settings: Settings
  stats: Stats
}

interface UI {
  view: ViewId
  horizon: Horizon
  cursor: string
  selected?: ID
  editingProject?: ID
  flights: Flight[]
  toasts: Toast[]
  pileBump: number
  showHelp: boolean
  showIO: boolean
}

interface Actions {
  setView: (v: ViewId) => void
  setHorizon: (h: Horizon) => void
  setCursor: (d: string) => void
  select: (id?: ID) => void
  editProject: (id?: ID) => void
  toggleHelp: (v?: boolean) => void
  toggleIO: (v?: boolean) => void

  addCard: (p: Partial<Card>) => ID
  updateCard: (id: ID, patch: Partial<Card>) => void
  deleteCard: (id: ID) => void
  duplicateCard: (id: ID) => ID
  moveCard: (id: ID, status: CardStatus) => void
  completeCard: (id: ID, from?: DOMRect | Flight['from']) => void
  reopenCard: (id: ID) => void
  drawCard: () => void

  addChecklist: (id: ID, text: string) => void
  toggleChecklist: (id: ID, itemId: ID) => void
  removeChecklist: (id: ID, itemId: ID) => void
  addLog: (id: ID, text: string) => void

  schedule: (id: ID, date: string, hours?: number) => void
  setSlot: (id: ID, date: string, hours: number) => void

  addLink: (from: ID, to: ID, type: LinkType) => boolean
  updateLink: (id: ID, patch: Partial<Link>) => void
  removeLink: (id: ID) => void

  addProject: (p?: Partial<Project>) => ID
  updateProject: (id: ID, patch: Partial<Project>) => void
  deleteProject: (id: ID) => void

  addObjective: (p?: Partial<Objective>) => ID
  updateObjective: (id: ID, patch: Partial<Objective>) => void
  deleteObjective: (id: ID) => void
  addKeyResult: (objectiveId: ID, title: string) => void
  updateKeyResult: (krId: ID, patch: Partial<KeyResult>) => void
  deleteKeyResult: (krId: ID) => void

  updateSettings: (patch: Partial<Settings>) => void

  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: string) => void
  landFlight: (id: string) => void

  importData: (d: Partial<Data>, mode: 'replace' | 'merge') => void
  resetDemo: () => void
  clearAll: () => void
}

export type State = Data & UI & Actions

export const DEFAULT_SETTINGS: Settings = {
  capacity: [6, 6, 6, 6, 5, 0, 0],
  capacityOverrides: {},
  sprintAnchor: '2026-01-05',
  theme: 'dark',
  sound: true,
}

export function newCard(p: Partial<Card> = {}): Card {
  return {
    id: uid(),
    title: 'Neue Karte',
    description: '',
    emoji: '📝',
    motif: Math.floor(Math.random() * 12),
    effortHours: 2,
    urgency: 3,
    importance: 3,
    status: 'backlog',
    slots: [],
    tags: [],
    checklist: [],
    log: [],
    raci: { r: [], a: '', c: [], i: [] },
    createdAt: now(),
    order: Date.now(),
    ...p,
  }
}

const mapCard = (cards: Card[], id: ID, fn: (c: Card) => Card) => cards.map((c) => (c.id === id ? fn(c) : c))

export const useStore = create<State>()(
  persist(
    (set, get) => {
      const sfx = (k: Parameters<typeof play>[0]) => get().settings.sound && play(k)

      return {
        ...demoData(),
        view: 'board',
        horizon: 'week',
        cursor: today(),
        flights: [],
        toasts: [],
        pileBump: 0,
        showHelp: false,
        showIO: false,

        setView: (view) => set({ view }),
        setHorizon: (horizon) => set({ horizon }),
        setCursor: (cursor) => set({ cursor }),
        select: (selected) => set({ selected }),
        editProject: (editingProject) => set({ editingProject }),
        toggleHelp: (v) => set((s) => ({ showHelp: v ?? !s.showHelp })),
        toggleIO: (v) => set((s) => ({ showIO: v ?? !s.showIO })),

        addCard: (p) => {
          const card = newCard(p)
          set((s) => ({ cards: [...s.cards, card] }))
          return card.id
        },
        updateCard: (id, patch) => set((s) => ({ cards: mapCard(s.cards, id, (c) => ({ ...c, ...patch })) })),
        deleteCard: (id) =>
          set((s) => ({
            cards: s.cards.filter((c) => c.id !== id),
            links: s.links.filter((l) => l.from !== id && l.to !== id),
            selected: s.selected === id ? undefined : s.selected,
          })),
        duplicateCard: (id) => {
          const src = get().cards.find((c) => c.id === id)
          if (!src) return id
          const copy = newCard({
            ...structuredClone(src),
            id: uid(),
            title: src.title + ' (Kopie)',
            status: 'backlog',
            doneAt: undefined,
            startedAt: undefined,
            slots: [],
            createdAt: now(),
            pos: src.pos ? { x: src.pos.x + 30, y: src.pos.y + 30 } : undefined,
          })
          set((s) => ({ cards: [...s.cards, copy] }))
          return copy.id
        },
        moveCard: (id, status) => {
          const card = get().cards.find((c) => c.id === id)
          if (!card || card.status === status) return
          if (status === 'done') return get().completeCard(id)
          sfx('drop')
          set((s) => ({
            cards: mapCard(s.cards, id, (c) => ({
              ...c,
              status,
              order: Date.now(),
              startedAt: status === 'doing' ? (c.startedAt ?? now()) : c.startedAt,
              doneAt: undefined,
            })),
          }))
        },
        completeCard: (id, from) => {
          const card = get().cards.find((c) => c.id === id)
          if (!card || card.status === 'done') return
          const rect = from ?? document.querySelector(`[data-card-id="${id}"]`)?.getBoundingClientRect()
          const xp = xpFor(card)
          const t = today()
          set((s) => {
            const yesterday = iso(addDays(parseISO(t), -1))
            const streak =
              s.stats.lastDoneDay === t ? s.stats.streak : s.stats.lastDoneDay === yesterday ? s.stats.streak + 1 : 1
            const done: Card = { ...card, status: 'done', doneAt: now() }
            return {
              cards: s.cards.map((c) => (c.id === id ? done : c)),
              stats: { xp: s.stats.xp + xp, streak, lastDoneDay: t },
              selected: s.selected === id ? undefined : s.selected,
              flights: rect
                ? [
                    ...s.flights,
                    {
                      id: uid(),
                      card: done,
                      kind: 'done',
                      from: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    },
                  ]
                : s.flights,
              pileBump: rect ? s.pileBump : s.pileBump + 1,
            }
          })
          sfx('done')
          get().toast({
            icon: '✨',
            text: `„${card.title}“ erledigt · +${xp} XP`,
            action: {
              label: 'Rückgängig',
              run: () => {
                get().reopenCard(id)
                set((s) => ({ stats: { ...s.stats, xp: Math.max(0, s.stats.xp - xp) } }))
              },
            },
          })
        },
        reopenCard: (id) =>
          set((s) => ({ cards: mapCard(s.cards, id, (c) => ({ ...c, status: 'hand', doneAt: undefined })) })),
        drawCard: () => {
          const candidates = get().cards.filter((c) => c.status === 'backlog')
          if (!candidates.length) {
            get().toast({ icon: '🂠', text: 'Der Stapel ist leer – Zeit für neue Ideen!' })
            return
          }
          const best = candidates.sort((a, b) => priority(b) - priority(a))[0]
          sfx('draw')
          set((s) => ({ cards: mapCard(s.cards, best.id, (c) => ({ ...c, status: 'hand', order: Date.now() })) }))
          get().toast({ icon: '🃏', text: `Gezogen: „${best.title}“` })
        },

        addChecklist: (id, text) =>
          set((s) => ({
            cards: mapCard(s.cards, id, (c) => ({
              ...c,
              checklist: [...c.checklist, { id: uid(), text, done: false, createdAt: now() }],
            })),
          })),
        toggleChecklist: (id, itemId) =>
          set((s) => ({
            cards: mapCard(s.cards, id, (c) => ({
              ...c,
              checklist: c.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)),
            })),
          })),
        removeChecklist: (id, itemId) =>
          set((s) => ({
            cards: mapCard(s.cards, id, (c) => ({ ...c, checklist: c.checklist.filter((i) => i.id !== itemId) })),
          })),
        addLog: (id, text) =>
          set((s) => ({ cards: mapCard(s.cards, id, (c) => ({ ...c, log: [{ id: uid(), text, at: now() }, ...c.log] })) })),

        schedule: (id, date, hours) => {
          const s = get()
          const card = s.cards.find((c) => c.id === id)
          if (!card) return
          const booked = s.cards.reduce(
            (sum, c) => sum + c.slots.filter((x) => x.date === date && c.id !== id).reduce((a, x) => a + x.hours, 0),
            0,
          )
          const free = Math.max(0, capacityFor(date, s.settings) - booked)
          const rest = unscheduledHours(card) || Math.min(2, card.effortHours)
          const h = hours ?? Math.max(0.5, Math.min(rest, free || rest))
          const existing = card.slots.find((x) => x.date === date)
          const slots: Slot[] = existing
            ? card.slots.map((x) => (x.date === date ? { ...x, hours: x.hours + h } : x))
            : [...card.slots, { date, hours: h }]
          sfx('drop')
          set({
            cards: mapCard(s.cards, id, (c) => ({
              ...c,
              slots: slots.sort((a, b) => a.date.localeCompare(b.date)),
              status: c.status === 'backlog' ? 'hand' : c.status,
            })),
          })
        },
        setSlot: (id, date, hours) =>
          set((s) => ({
            cards: mapCard(s.cards, id, (c) => ({
              ...c,
              slots:
                hours <= 0
                  ? c.slots.filter((x) => x.date !== date)
                  : c.slots.map((x) => (x.date === date ? { ...x, hours } : x)),
            })),
          })),

        addLink: (from, to, type) => {
          const s = get()
          if (from === to || s.links.some((l) => l.from === from && l.to === to)) return false
          if (type !== 'relates' && createsCycle(from, to, s.links)) {
            get().toast({ icon: '🔁', text: 'Diese Verbindung würde einen Kreis erzeugen.' })
            return false
          }
          sfx('link')
          set({ links: [...s.links, { id: uid(), from, to, type }] })
          return true
        },
        updateLink: (id, patch) => set((s) => ({ links: s.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) })),
        removeLink: (id) => set((s) => ({ links: s.links.filter((l) => l.id !== id) })),

        addProject: (p = {}) => {
          const t = today()
          const project: Project = {
            id: uid(),
            name: 'Neues Projekt',
            emoji: '📦',
            color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
            description: '',
            start: t,
            end: iso(addDays(parseISO(t), 42)),
            krIds: [],
            ...p,
          }
          set((s) => ({ projects: [...s.projects, project] }))
          return project.id
        },
        updateProject: (id, patch) =>
          set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
        deleteProject: (id) =>
          set((s) => ({
            projects: s.projects.filter((p) => p.id !== id),
            cards: s.cards.map((c) => (c.projectId === id ? { ...c, projectId: undefined } : c)),
            editingProject: undefined,
          })),

        addObjective: (p = {}) => {
          const d = parseISO(get().cursor)
          const o: Objective = {
            id: uid(),
            title: 'Neues Objective',
            emoji: '🎯',
            quarter: `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`,
            keyResults: [],
            ...p,
          }
          set((s) => ({ objectives: [...s.objectives, o] }))
          return o.id
        },
        updateObjective: (id, patch) =>
          set((s) => ({ objectives: s.objectives.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
        deleteObjective: (id) =>
          set((s) => {
            const kr = new Set(s.objectives.find((o) => o.id === id)?.keyResults.map((k) => k.id))
            return {
              objectives: s.objectives.filter((o) => o.id !== id),
              cards: s.cards.map((c) => (c.krId && kr.has(c.krId) ? { ...c, krId: undefined } : c)),
              projects: s.projects.map((p) => ({ ...p, krIds: p.krIds.filter((k) => !kr.has(k)) })),
            }
          }),
        addKeyResult: (objectiveId, title) =>
          set((s) => ({
            objectives: s.objectives.map((o) =>
              o.id === objectiveId ? { ...o, keyResults: [...o.keyResults, { id: uid(), title }] } : o,
            ),
          })),
        updateKeyResult: (krId, patch) =>
          set((s) => ({
            objectives: s.objectives.map((o) => ({
              ...o,
              keyResults: o.keyResults.map((k) => (k.id === krId ? { ...k, ...patch } : k)),
            })),
          })),
        deleteKeyResult: (krId) =>
          set((s) => ({
            objectives: s.objectives.map((o) => ({ ...o, keyResults: o.keyResults.filter((k) => k.id !== krId) })),
            cards: s.cards.map((c) => (c.krId === krId ? { ...c, krId: undefined } : c)),
            projects: s.projects.map((p) => ({ ...p, krIds: p.krIds.filter((k) => k !== krId) })),
          })),

        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

        toast: (t) => {
          const id = uid()
          set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
          setTimeout(() => get().dismissToast(id), t.action ? 6000 : 3500)
        },
        dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
        landFlight: (id) => set((s) => ({ flights: s.flights.filter((f) => f.id !== id), pileBump: s.pileBump + 1 })),

        importData: (d, mode) =>
          set((s) => {
            if (mode === 'replace') {
              return {
                cards: (d.cards ?? []).map((c) => newCard(c)),
                links: d.links ?? [],
                projects: d.projects ?? [],
                objectives: d.objectives ?? [],
                settings: { ...DEFAULT_SETTINGS, ...d.settings },
                stats: d.stats ?? { xp: 0, streak: 0 },
              }
            }
            const byId = <T extends { id: ID }>(a: T[], b: T[] = []) => {
              const m = new Map(a.map((x) => [x.id, x]))
              for (const x of b) m.set(x.id, x)
              return [...m.values()]
            }
            return {
              cards: byId(s.cards, d.cards?.map((c) => newCard(c))),
              links: byId(s.links, d.links),
              projects: byId(s.projects, d.projects),
              objectives: byId(s.objectives, d.objectives),
            }
          }),
        resetDemo: () => set({ ...demoData(), selected: undefined }),
        clearAll: () =>
          set({
            cards: [],
            links: [],
            projects: [],
            objectives: [],
            stats: { xp: 0, streak: 0 },
            selected: undefined,
          }),
      }
    },
    {
      name: 'questdeck-v1',
      partialize: (s) => ({
        cards: s.cards,
        links: s.links,
        projects: s.projects,
        objectives: s.objectives,
        settings: s.settings,
        stats: s.stats,
        view: s.view,
        horizon: s.horizon,
      }),
    },
  ),
)

/* ---------- abgeleitete Helfer ---------- */

export const useCardMap = () => {
  const cards = useStore((s) => s.cards)
  return new Map(cards.map((c) => [c.id, c]))
}

export function bookedHours(cards: Card[], date: string) {
  let h = 0
  for (const c of cards) for (const s of c.slots) if (s.date === date && c.status !== 'done') h += s.hours
  return h
}

export function krProgress(krId: ID, cards: Card[], manual?: number) {
  const mine = cards.filter((c) => c.krId === krId)
  const total = mine.reduce((s, c) => s + c.effortHours, 0)
  const done = mine.filter((c) => c.status === 'done').reduce((s, c) => s + c.effortHours, 0)
  const fromCards = total ? done / total : 0
  if (manual === undefined) return { value: fromCards, cards: mine.length }
  return { value: mine.length ? (fromCards + manual) / 2 : manual, cards: mine.length }
}

export function projectProgress(projectId: ID, cards: Card[]) {
  const mine = cards.filter((c) => c.projectId === projectId)
  const total = mine.reduce((s, c) => s + c.effortHours, 0)
  const done = mine.filter((c) => c.status === 'done').reduce((s, c) => s + c.effortHours, 0)
  return { value: total ? done / total : 0, total, done, count: mine.length, open: mine.filter((c) => c.status !== 'done').length }
}
