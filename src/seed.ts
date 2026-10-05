import { addDays, parseISO } from 'date-fns'
import type { Card, Link, Objective, Project } from './types'
import { iso, quarterOf, today } from './lib/dates'
import type { Data } from './store'

/** Beispieldaten, damit der Tisch beim ersten Start nicht leer ist. */
export function demoData(): Data {
  const t = parseISO(today())
  const d = (n: number) => iso(addDays(t, n))
  const q = quarterOf(t)

  const objectives: Objective[] = [
    {
      id: 'o1',
      title: 'Launch der neuen Produktlinie',
      emoji: '🚀',
      quarter: q,
      keyResults: [
        { id: 'kr1', title: 'Beta mit 50 Testkund:innen live' },
        { id: 'kr2', title: 'Conversion Landingpage ≥ 4 %' },
      ],
    },
    {
      id: 'o2',
      title: 'Fokussiert & gesund arbeiten',
      emoji: '🌱',
      quarter: q,
      keyResults: [
        { id: 'kr3', title: 'Max. 2 Kontextwechsel pro Tag', manual: 0.4 },
        { id: 'kr4', title: 'Wöchentliche Retro mit mir selbst' },
      ],
    },
  ]

  const projects: Project[] = [
    {
      id: 'p1',
      name: 'Launch Alpha',
      emoji: '🚀',
      color: '#7c6cff',
      description: 'Alles bis zum Public-Beta-Launch.',
      start: d(-14),
      end: d(35),
      krIds: ['kr1', 'kr2'],
    },
    {
      id: 'p2',
      name: 'Website Relaunch',
      emoji: '🎨',
      color: '#ff7a9a',
      description: 'Neue Landingpage & Messaging.',
      start: d(-3),
      end: d(28),
      krIds: ['kr2'],
    },
    {
      id: 'p3',
      name: 'Team & Ich',
      emoji: '🤝',
      color: '#37c9a6',
      description: '1:1s, Retros, Weiterbildung.',
      start: d(-30),
      end: d(60),
      krIds: ['kr3', 'kr4'],
    },
  ]

  const base = { description: '', tags: [], log: [], slots: [], checklist: [], createdAt: new Date().toISOString() }
  const raci = (r: string[] = [], a = '', c: string[] = [], i: string[] = []) => ({ r, a, c, i })
  let order = 0
  const card = (p: Partial<Card> & Pick<Card, 'id' | 'title'>): Card => ({
    ...base,
    emoji: '📝',
    motif: order % 12,
    effortHours: 2,
    urgency: 3,
    importance: 3,
    status: 'backlog',
    raci: raci(),
    order: order++,
    ...p,
  })

  const cards: Card[] = [
    card({
      id: 'c1',
      title: 'Pricing entscheiden',
      emoji: '⚖️',
      motif: 1,
      description: 'Freemium vs. Trial – Entscheidung mit Geschäftsführung.',
      effortHours: 3,
      urgency: 5,
      importance: 5,
      status: 'doing',
      projectId: 'p1',
      krId: 'kr2',
      due: d(1),
      decider: 'Mara Klein',
      raci: raci(['Ich'], 'Mara Klein', ['Finance'], ['Sales']),
      slots: [{ date: d(0), hours: 2 }],
      checklist: [
        { id: 'x1', text: 'Wettbewerber-Preise sammeln', done: true, createdAt: d(-2) },
        { id: 'x2', text: 'Szenarien rechnen', done: false, createdAt: d(-1) },
        { id: 'x3', text: 'Termin mit Mara', done: false, createdAt: d(-1) },
      ],
    }),
    card({
      id: 'c2',
      title: 'Landingpage-Texte',
      emoji: '✍️',
      motif: 0,
      effortHours: 6,
      urgency: 4,
      importance: 4,
      status: 'hand',
      projectId: 'p2',
      krId: 'kr2',
      due: d(4),
      link: 'https://example.com/docs/landingpage',
      raci: raci(['Ich'], 'Ich', ['Design'], []),
      slots: [{ date: d(1), hours: 3 }],
    }),
    card({
      id: 'c3',
      title: 'Beta-Onboarding bauen',
      emoji: '🛠️',
      motif: 4,
      effortHours: 16,
      urgency: 3,
      importance: 5,
      status: 'hand',
      projectId: 'p1',
      krId: 'kr1',
      due: d(12),
      raci: raci(['Dev-Team'], 'Ich', ['UX'], ['Support']),
    }),
    card({
      id: 'c4',
      title: 'Testkund:innen einladen',
      emoji: '✉️',
      motif: 9,
      effortHours: 3,
      urgency: 3,
      importance: 4,
      projectId: 'p1',
      krId: 'kr1',
      due: d(16),
    }),
    card({
      id: 'c5',
      title: 'Hero-Visual gestalten',
      emoji: '🎨',
      motif: 6,
      effortHours: 5,
      urgency: 2,
      importance: 3,
      projectId: 'p2',
      due: d(9),
      raci: raci(['Design'], 'Ich', [], []),
    }),
    card({
      id: 'c6',
      title: 'Tracking & Analytics',
      emoji: '📊',
      motif: 10,
      effortHours: 4,
      urgency: 2,
      importance: 3,
      projectId: 'p2',
      krId: 'kr2',
    }),
    card({
      id: 'c7',
      title: 'Wochen-Retro',
      emoji: '🧭',
      motif: 2,
      effortHours: 1,
      urgency: 2,
      importance: 4,
      status: 'hand',
      projectId: 'p3',
      krId: 'kr4',
      due: d(4),
    }),
    card({
      id: 'c8',
      title: '1:1 mit Jonas',
      emoji: '☕',
      motif: 3,
      effortHours: 1,
      urgency: 3,
      importance: 3,
      projectId: 'p3',
      due: d(2),
    }),
    card({
      id: 'c9',
      title: 'Security-Review',
      emoji: '🛡️',
      motif: 7,
      effortHours: 8,
      urgency: 3,
      importance: 5,
      projectId: 'p1',
      due: d(20),
      raci: raci(['Security'], 'CTO', ['Ich'], []),
    }),
    card({
      id: 'c10',
      title: 'Kickoff-Präsentation',
      emoji: '🎤',
      motif: 8,
      effortHours: 2,
      urgency: 4,
      importance: 3,
      status: 'done',
      projectId: 'p1',
      doneAt: new Date(Date.now() - 86400000).toISOString(),
    }),
  ]

  const links: Link[] = [
    { id: 'l1', from: 'c10', to: 'c1', type: 'happy' },
    { id: 'l2', from: 'c1', to: 'c2', type: 'decision' },
    { id: 'l3', from: 'c2', to: 'c5', type: 'depends' },
    { id: 'l4', from: 'c3', to: 'c4', type: 'blocks' },
    { id: 'l5', from: 'c9', to: 'c4', type: 'depends' },
    { id: 'l6', from: 'c1', to: 'c3', type: 'happy' },
    { id: 'l7', from: 'c5', to: 'c6', type: 'delay' },
    { id: 'l8', from: 'c7', to: 'c8', type: 'relates' },
  ]

  return {
    cards,
    links,
    projects,
    objectives,
    settings: {
      capacity: [6, 6, 6, 6, 5, 0, 0],
      capacityOverrides: {},
      sprintAnchor: '2026-01-05',
      theme: 'dark',
      sound: true,
    },
    stats: { xp: 60, streak: 1, lastDoneDay: d(-1) },
  }
}
