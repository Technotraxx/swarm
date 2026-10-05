import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  format,
  getISOWeek,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import { de } from 'date-fns/locale'
import type { Horizon, Settings } from '../types'

export const iso = (d: Date) => format(d, 'yyyy-MM-dd')
export const today = () => iso(new Date())
export const parse = (s: string) => parseISO(s)

export const HORIZONS: { id: Horizon; label: string; short: string }[] = [
  { id: 'day', label: 'Tag', short: 'T' },
  { id: 'week', label: 'Woche', short: 'W' },
  { id: 'sprint', label: 'Sprint', short: 'S' },
  { id: 'month', label: 'Monat', short: 'M' },
  { id: 'quarter', label: 'Quartal', short: 'Q' },
  { id: 'year', label: 'Jahr', short: 'J' },
]

export interface Range {
  start: Date
  end: Date
}

const WEEK = { weekStartsOn: 1 as const }

/** Sprints sind 2 Wochen lang und laufen ab einem frei wählbaren Anker-Montag. */
export function sprintRange(anchor: string, at: Date): Range {
  const a = startOfWeek(parseISO(anchor), WEEK)
  const diff = differenceInCalendarDays(startOfDay(at), a)
  const idx = Math.floor(diff / 14)
  const start = addDays(a, idx * 14)
  return { start, end: endOfDay(addDays(start, 13)) }
}

export function sprintNumber(anchor: string, at: Date): number {
  const a = startOfWeek(parseISO(anchor), WEEK)
  return Math.floor(differenceInCalendarDays(startOfDay(at), a) / 14) + 1
}

export function horizonRange(h: Horizon, cursor: Date, settings: Pick<Settings, 'sprintAnchor'>): Range {
  switch (h) {
    case 'day':
      return { start: startOfDay(cursor), end: endOfDay(cursor) }
    case 'week':
      return { start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) }
    case 'sprint':
      return sprintRange(settings.sprintAnchor, cursor)
    case 'month':
      return { start: startOfMonth(cursor), end: endOfMonth(cursor) }
    case 'quarter':
      return { start: startOfQuarter(cursor), end: endOfQuarter(cursor) }
    case 'year':
      return { start: startOfYear(cursor), end: endOfYear(cursor) }
  }
}

export function shiftCursor(h: Horizon, cursor: Date, dir: 1 | -1): Date {
  switch (h) {
    case 'day':
      return addDays(cursor, dir)
    case 'week':
      return addWeeks(cursor, dir)
    case 'sprint':
      return addWeeks(cursor, 2 * dir)
    case 'month':
      return addMonths(cursor, dir)
    case 'quarter':
      return addQuarters(cursor, dir)
    case 'year':
      return addYears(cursor, dir)
  }
}

export function horizonLabel(h: Horizon, cursor: Date, settings: Pick<Settings, 'sprintAnchor'>): string {
  const r = horizonRange(h, cursor, settings)
  switch (h) {
    case 'day':
      return format(cursor, 'EEEE, d. MMMM', { locale: de })
    case 'week':
      return `KW ${getISOWeek(cursor)} · ${format(r.start, 'd.M.')}–${format(r.end, 'd.M.')}`
    case 'sprint':
      return `Sprint ${sprintNumber(settings.sprintAnchor, cursor)} · ${format(r.start, 'd.M.')}–${format(r.end, 'd.M.')}`
    case 'month':
      return format(cursor, 'MMMM yyyy', { locale: de })
    case 'quarter':
      return `Q${Math.floor(cursor.getMonth() / 3) + 1} ${cursor.getFullYear()}`
    case 'year':
      return String(cursor.getFullYear())
  }
}

export const daysIn = (r: Range) => eachDayOfInterval({ start: r.start, end: r.end })

export const inRange = (dateStr: string | undefined, r: Range) => {
  if (!dateStr) return false
  const d = parseISO(dateStr)
  return d >= startOfDay(r.start) && d <= r.end
}

export function capacityFor(date: string, settings: Pick<Settings, 'capacity' | 'capacityOverrides'>): number {
  if (date in settings.capacityOverrides) return settings.capacityOverrides[date]
  const dow = (parseISO(date).getDay() + 6) % 7 // Montag = 0
  return settings.capacity[dow] ?? 0
}

export const fmt = (d: Date | string, pattern: string) =>
  format(typeof d === 'string' ? parseISO(d) : d, pattern, { locale: de })

export const quarterOf = (d: Date) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`

export const daysUntil = (dateStr: string) => differenceInCalendarDays(parseISO(dateStr), startOfDay(new Date()))
