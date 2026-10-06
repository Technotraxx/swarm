import type { Card, ID, Link, Settings } from '../types'
import { capacityFor } from './dates'
import { priority, unscheduledHours } from './game'
import { isBlocked } from './graph'

export const DEFAULT_DAY_START = 9
export const dayStartOf = (s: Pick<Settings, 'dayStart'>) => s.dayStart ?? DEFAULT_DAY_START

export interface Block {
  cardId: ID
  date: string
  start: number
  hours: number
}

const overlaps = (a: number, ah: number, b: number, bh: number) => a < b + bh - 1e-6 && b < a + ah - 1e-6

/** Erste freie Startzeit (in 0,5-h-Schritten) ab Tagesbeginn, an der `hours` Platz haben. */
export function firstFree(taken: { start: number; hours: number }[], hours: number, dayStart: number): number {
  for (let s = dayStart; s + hours <= 24; s += 0.5) {
    if (taken.every((t) => !overlaps(s, hours, t.start, t.hours))) return s
  }
  return Math.max(dayStart, ...taken.map((t) => t.start + t.hours))
}

/**
 * Alle Zeitblöcke eines Tages mit Uhrzeit. Ältere Blöcke ohne Startzeit
 * werden der Reihe nach in die erste freie Lücke gelegt.
 */
export function blocksForDay(cards: Card[], date: string, dayStart: number, includeDone = true): Block[] {
  const fixed: Block[] = []
  const loose: Block[] = []
  for (const c of cards) {
    if (!includeDone && c.status === 'done') continue
    for (const s of c.slots) {
      if (s.date !== date) continue
      const b = { cardId: c.id, date, start: s.start ?? NaN, hours: s.hours }
      ;(s.start === undefined ? loose : fixed).push(b)
    }
  }
  for (const b of loose) {
    b.start = firstFree(fixed, b.hours, dayStart)
    fixed.push(b)
  }
  return fixed.sort((a, b) => a.start - b.start)
}

/** Nebeneinanderliegende Spalten für überlappende Blöcke (wie im Kalender). */
export function lanes(blocks: Block[]): Map<Block, { lane: number; of: number }> {
  const res = new Map<Block, { lane: number; of: number }>()
  let cluster: Block[] = []
  let clusterEnd = -1
  let ends: number[] = []
  const flush = () => {
    for (const b of cluster) res.get(b)!.of = ends.length
    cluster = []
    ends = []
  }
  for (const b of [...blocks].sort((x, y) => x.start - y.start)) {
    if (b.start >= clusterEnd - 1e-6) (flush(), (clusterEnd = -1))
    let lane = ends.findIndex((e) => e <= b.start + 1e-6)
    if (lane < 0) lane = ends.push(0) - 1
    ends[lane] = b.start + b.hours
    clusterEnd = Math.max(clusterEnd, b.start + b.hours)
    cluster.push(b)
    res.set(b, { lane, of: 1 })
  }
  flush()
  return res
}

export interface HandPlan {
  picks: { cardId: ID; hours: number; start: number }[]
  skippedBlocked: number
  free: number
}

/**
 * „Hand ziehen“: füllt einen Tag nach Priorität bis zur Kapazität.
 * Blockierte Karten bleiben liegen, schon für den Tag verplante Karten werden nicht doppelt gezogen.
 */
export function planHand(
  cards: Card[],
  links: Link[],
  date: string,
  settings: Pick<Settings, 'capacity' | 'capacityOverrides' | 'dayStart'>,
): HandPlan {
  const dayStart = dayStartOf(settings)
  const map = new Map(cards.map((c) => [c.id, c]))
  const taken = blocksForDay(cards, date, dayStart, false)
  let free = capacityFor(date, settings) - taken.reduce((s, b) => s + b.hours, 0)
  const picks: HandPlan['picks'] = []
  let skippedBlocked = 0

  const candidates = cards
    .filter((c) => c.level === 'task' && (c.status === 'backlog' || c.status === 'hand' || c.status === 'doing') && !c.slots.some((s) => s.date === date))
    .sort((a, b) => Number(b.status === 'doing') - Number(a.status === 'doing') || priority(b) - priority(a))

  for (const c of candidates) {
    if (free < 0.5) break
    if (isBlocked(c.id, map, links)) {
      skippedBlocked++
      continue
    }
    const rest = unscheduledHours(c)
    if (rest <= 0) continue
    const hours = Math.floor(Math.min(rest, free) * 2) / 2
    if (hours < 0.5) continue
    const start = firstFree(taken, hours, dayStart)
    taken.push({ cardId: c.id, date, start, hours })
    picks.push({ cardId: c.id, hours, start })
    free -= hours
  }
  return { picks, skippedBlocked, free }
}

/* ---------- Alterung ---------- */

export type Age = 0 | 1 | 2 | 3

/** Karten, die lange niemand anfasst, setzen Staub an: ab 7, 14 und 28 Tagen. */
export function cardAge(card: Pick<Card, 'status' | 'createdAt' | 'touchedAt'>, now = Date.now()): { age: Age; days: number } {
  if (card.status === 'done' || card.status === 'doing') return { age: 0, days: 0 }
  const since = new Date(card.touchedAt ?? card.createdAt).getTime()
  if (Number.isNaN(since)) return { age: 0, days: 0 }
  const days = Math.floor((now - since) / 86_400_000)
  return { age: days >= 28 ? 3 : days >= 14 ? 2 : days >= 7 ? 1 : 0, days }
}

export const AGE_LABEL: Record<Age, string> = {
  0: '',
  1: 'liegt',
  2: 'verstaubt',
  3: 'vergessen',
}

export const fmtHour = (h: number) => `${Math.floor(h)}:${h % 1 ? '30' : '00'}`
