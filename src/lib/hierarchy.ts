import type { Card, ID, LegacyProject, Level } from '../types'

export const LEVELS: { id: Level; label: string; plural: string; icon: string }[] = [
  { id: 'task', label: 'Task', plural: 'Tasks', icon: '🃏' },
  { id: 'project', label: 'Projekt', plural: 'Projekte', icon: '🗂️' },
  { id: 'roadmap', label: 'Initiative', plural: 'Initiativen', icon: '🗺️' },
]
export const LEVEL_LABEL: Record<Level, string> = { task: 'Task', project: 'Projekt', roadmap: 'Initiative' }

export const isContainer = (c: Pick<Card, 'level'>) => c.level !== 'task'

/** Welche Ebenen dürfen Eltern dieser Ebene sein? */
export function parentLevels(level: Level): Level[] {
  if (level === 'task') return ['project', 'roadmap']
  if (level === 'project') return ['roadmap']
  return []
}

export const canParent = (child: Pick<Card, 'level' | 'id'>, parent: Pick<Card, 'level' | 'id'>) =>
  child.id !== parent.id && parentLevels(child.level).includes(parent.level)

export const childrenOf = (cards: Card[], id: ID) => cards.filter((c) => c.parentId === id)

/** Alle Karten unterhalb (Kinder, Enkel …), zyklensicher. */
export function descendants(cards: Card[], id: ID): Card[] {
  const out: Card[] = []
  const seen = new Set<ID>([id])
  const stack = [id]
  while (stack.length) {
    const cur = stack.pop()!
    for (const c of cards)
      if (c.parentId === cur && !seen.has(c.id)) {
        seen.add(c.id)
        out.push(c)
        stack.push(c.id)
      }
  }
  return out
}

/** Kette nach oben: Elternkarte, deren Elternkarte … */
export function ancestors(cards: Card[] | Map<ID, Card>, card: Card): Card[] {
  const map = cards instanceof Map ? cards : new Map(cards.map((c) => [c.id, c]))
  const out: Card[] = []
  const seen = new Set<ID>([card.id])
  let cur = card.parentId ? map.get(card.parentId) : undefined
  while (cur && !seen.has(cur.id)) {
    out.push(cur)
    seen.add(cur.id)
    cur = cur.parentId ? map.get(cur.parentId) : undefined
  }
  return out
}

export const ancestorOfLevel = (cards: Card[] | Map<ID, Card>, card: Card, level: Level) =>
  ancestors(cards, card).find((a) => a.level === level)

/** Farbe: eigene oder die des nächsten Projekts/der nächsten Initiative darüber */
export function colorOf(cards: Card[] | Map<ID, Card>, card: Card): string | undefined {
  if (card.color) return card.color
  return ancestors(cards, card).find((a) => a.color)?.color
}

export interface Rollup {
  /** Stunden aller Tasks darunter (oder eigener Aufwand, wenn es keine gibt) */
  total: number
  done: number
  value: number
  count: number
  open: number
}

/** Aufwand und Fortschritt rechnen sich von den Tasks nach oben zusammen. */
export function rollup(cards: Card[], card: Card): Rollup {
  const tasks = card.level === 'task' ? [card] : descendants(cards, card.id).filter((c) => c.level === 'task')
  if (!tasks.length) {
    const done = card.status === 'done' ? card.effortHours : 0
    return { total: card.effortHours, done, value: card.status === 'done' ? 1 : 0, count: 0, open: 0 }
  }
  const total = tasks.reduce((s, c) => s + c.effortHours, 0)
  const done = tasks.filter((c) => c.status === 'done').reduce((s, c) => s + c.effortHours, 0)
  return {
    total,
    done,
    value: total ? done / total : 0,
    count: tasks.length,
    open: tasks.filter((c) => c.status !== 'done').length,
  }
}

/** Key Results einer Karte – eigene plus die ihrer Projekte/Initiativen. */
export function krsOf(cards: Card[] | Map<ID, Card>, card: Card): ID[] {
  const own = [card.krId, ...(card.krIds ?? [])].filter(Boolean) as ID[]
  return [...new Set([...own, ...ancestors(cards, card).flatMap((a) => a.krIds ?? [])])]
}

/** Zeitspanne für die Roadmap: eigene Daten, sonst aus den Karten darunter abgeleitet. */
export function spanOf(cards: Card[], card: Card): { start: string; end: string } {
  const kids = descendants(cards, card.id)
  const dates = kids.flatMap((k) => [k.start, k.due].filter(Boolean) as string[]).sort()
  const start = card.start ?? dates[0] ?? card.createdAt.slice(0, 10)
  let end = card.due ?? dates[dates.length - 1] ?? start
  if (end < start) end = start
  return { start, end }
}

/**
 * Bis Version 1 waren Projekte eigene Objekte. Hier werden sie zu Projekt-Karten,
 * und `projectId` der Tasks wird zu `parentId`.
 */
export function migrateLegacy<T extends { cards?: unknown[]; projects?: LegacyProject[] }>(
  data: T,
): Omit<T, 'projects'> & { cards: Partial<Card>[] } {
  const { projects = [], ...rest } = data
  const cards = (data.cards ?? []) as (Partial<Card> & { projectId?: ID })[]
  const projectCards: Partial<Card>[] = projects.map((p, i) => ({
    id: p.id,
    level: 'project',
    title: p.name,
    emoji: p.emoji,
    color: p.color,
    description: p.description,
    start: p.start,
    due: p.end,
    krIds: p.krIds ?? [],
    status: 'hand',
    effortHours: 0,
    motif: i,
  }))
  const converted = cards.map(({ projectId, ...c }) => ({
    ...c,
    level: c.level ?? 'task',
    parentId: c.parentId ?? projectId,
  }))
  const ids = new Set(converted.map((c) => c.id))
  return { ...rest, cards: [...converted, ...projectCards.filter((p) => !ids.has(p.id))] }
}
