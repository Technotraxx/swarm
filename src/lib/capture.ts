import { addDays, nextDay, type Day } from 'date-fns'
import { iso } from './dates'

export interface Parsed {
  title: string
  project?: string
  urgency?: number
  importance?: number
  effortHours?: number
  due?: string
  tags: string[]
  link?: string
}

const WEEKDAYS: Record<string, Day> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 }

/**
 * Schnell-Eingabe wie in einer Kommandozeile:
 *   "Pitch-Deck bauen #launch !4 ^5 ~3h @fr +design https://figma.com/…"
 *   #projekt   !dringlichkeit (oder !!, !!!)   ^wichtigkeit   ~aufwand (30m, 2h, 1d)
 *   @heute @morgen @mo..@so @12.10. @2026-10-12   +tag   Links werden erkannt
 */
export function parseCapture(input: string, now = new Date()): Parsed {
  const res: Parsed = { title: '', tags: [] }
  const rest: string[] = []

  for (const tok of input.trim().split(/\s+/)) {
    let m: RegExpMatchArray | null
    if (/^https?:\/\//i.test(tok)) res.link = tok
    else if ((m = tok.match(/^#(.+)$/))) res.project = m[1]
    else if ((m = tok.match(/^!([1-5])$/))) res.urgency = Number(m[1])
    else if ((m = tok.match(/^(!{1,3})$/))) res.urgency = 2 + m[1].length
    else if ((m = tok.match(/^\^([1-5])$/))) res.importance = Number(m[1])
    else if ((m = tok.match(/^~(\d+(?:[.,]\d+)?)(m|min|h|d|t)?$/i))) {
      const n = Number(m[1].replace(',', '.'))
      const unit = (m[2] ?? 'h').toLowerCase()
      res.effortHours = unit.startsWith('m') ? Math.max(0.25, n / 60) : unit === 'd' || unit === 't' ? n * 8 : n
    } else if ((m = tok.match(/^@(.+)$/))) {
      const due = parseDue(m[1].toLowerCase(), now)
      if (due) res.due = due
      else rest.push(tok)
    } else if ((m = tok.match(/^\+(.+)$/))) res.tags.push(m[1])
    else rest.push(tok)
  }
  res.title = rest.join(' ')
  return res
}

function parseDue(s: string, now: Date): string | undefined {
  if (s === 'heute' || s === 'today') return iso(now)
  if (s === 'morgen' || s === 'tomorrow') return iso(addDays(now, 1))
  if (s === 'übermorgen') return iso(addDays(now, 2))
  const wd = WEEKDAYS[s.slice(0, 2)]
  if (wd !== undefined && /^[a-zä]+$/.test(s)) return iso(nextDay(now, wd))
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m) return s
  m = s.match(/^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/)
  if (m) {
    let y = m[3] ? Number(m[3]) : now.getFullYear()
    if (y < 100) y += 2000
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]))
    if (!m[3] && d < addDays(now, -1)) d.setFullYear(y + 1)
    return iso(d)
  }
  return undefined
}

/** Einfache unscharfe Suche: alle Wörter der Anfrage müssen vorkommen. */
export function fuzzy(haystack: string, query: string) {
  const h = haystack.toLowerCase()
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => h.includes(w))
}
