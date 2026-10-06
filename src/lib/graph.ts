import type { Card, ID, Link } from '../types'
import { ORDERING, remainingHours } from './game'

/** Offene Karten, die diese Karte (noch) aufhalten. */
export function blockers(cardId: ID, cards: Map<ID, Card>, links: Link[]): Card[] {
  const res: Card[] = []
  for (const l of links) {
    if (l.to !== cardId || !ORDERING.includes(l.type)) continue
    const from = cards.get(l.from)
    if (from && from.status !== 'done') res.push(from)
  }
  return res
}

export function isBlocked(cardId: ID, cards: Map<ID, Card>, links: Link[]) {
  return blockers(cardId, cards, links).length > 0
}

/**
 * Critical Path: längste Kette (nach Rest-Aufwand) offener Karten über ordnende Links.
 * Zyklen werden ignoriert (die betroffene Kante wird übersprungen).
 */
export function criticalPath(
  cards: Card[],
  links: Link[],
  weight: (c: Card) => number = remainingHours,
): { cards: Set<ID>; links: Set<ID>; hours: number } {
  const open = new Map(cards.filter((c) => c.status !== 'done').map((c) => [c.id, c]))
  const out = new Map<ID, Link[]>()
  for (const l of links) {
    if (!ORDERING.includes(l.type) || !open.has(l.from) || !open.has(l.to)) continue
    if (!out.has(l.from)) out.set(l.from, [])
    out.get(l.from)!.push(l)
  }

  const memo = new Map<ID, { len: number; next?: Link }>()
  const visiting = new Set<ID>()

  const longest = (id: ID): number => {
    const m = memo.get(id)
    if (m) return m.len
    visiting.add(id)
    const own = weight(open.get(id)!)
    let best = 0
    let next: Link | undefined
    for (const l of out.get(id) ?? []) {
      if (visiting.has(l.to)) continue // Zyklus
      const len = longest(l.to)
      if (len > best) {
        best = len
        next = l
      }
    }
    visiting.delete(id)
    memo.set(id, { len: own + best, next })
    return own + best
  }

  let start: ID | undefined
  let max = 0
  for (const id of open.keys()) {
    // nur Ketten mit mindestens einer Kante zählen
    if (!out.has(id)) continue
    const len = longest(id)
    if (len > max) {
      max = len
      start = id
    }
  }

  const resCards = new Set<ID>()
  const resLinks = new Set<ID>()
  let cur = start
  while (cur) {
    resCards.add(cur)
    const step: { len: number; next?: Link } | undefined = memo.get(cur)
    if (!step?.next) break
    resLinks.add(step.next.id)
    cur = step.next.to
  }
  return { cards: resCards, links: resLinks, hours: max }
}

/** Ebene im Graphen = längster Weg von einer Wurzel (für Auto-Layout). */
export function depthMap(cards: Card[], links: Link[]): Map<ID, number> {
  const ids = new Set(cards.map((c) => c.id))
  const incoming = new Map<ID, ID[]>()
  for (const l of links) {
    if (l.type === 'relates' || !ids.has(l.from) || !ids.has(l.to)) continue
    if (!incoming.has(l.to)) incoming.set(l.to, [])
    incoming.get(l.to)!.push(l.from)
  }
  const depth = new Map<ID, number>()
  const visiting = new Set<ID>()
  const d = (id: ID): number => {
    if (depth.has(id)) return depth.get(id)!
    if (visiting.has(id)) return 0
    visiting.add(id)
    const v = Math.max(-1, ...(incoming.get(id) ?? []).map(d)) + 1
    visiting.delete(id)
    depth.set(id, v)
    return v
  }
  for (const c of cards) d(c.id)
  return depth
}

export function autoLayout(cards: Card[], links: Link[], colW = 260, rowH = 200, colOffset: (c: Card) => number = () => 0) {
  const depth = depthMap(cards, links)
  const rows = new Map<number, number>()
  const pos = new Map<ID, { x: number; y: number }>()
  const sorted = [...cards].sort((a, b) => (a.parentId ?? '').localeCompare(b.parentId ?? '') || a.order - b.order)
  for (const c of sorted) {
    const col = colOffset(c) + (depth.get(c.id) ?? 0)
    const row = rows.get(col) ?? 0
    rows.set(col, row + 1)
    pos.set(c.id, { x: 60 + col * colW, y: 60 + row * rowH })
  }
  return pos
}

/** Würde ein Link from → to einen Zyklus erzeugen? */
export function createsCycle(from: ID, to: ID, links: Link[]): boolean {
  if (from === to) return true
  const stack = [to]
  const seen = new Set<ID>()
  while (stack.length) {
    const cur = stack.pop()!
    if (cur === from) return true
    if (seen.has(cur)) continue
    seen.add(cur)
    for (const l of links) if (l.from === cur && l.type !== 'relates') stack.push(l.to)
  }
  return false
}
