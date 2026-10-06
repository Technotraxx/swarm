import type { Card } from '../types'
import type { Data } from '../store'
import type { LegacyProject } from '../types'
import { fmt, inRange, type Range } from './dates'
import { points } from './game'
import { blocksForDay } from './schedule'

export const SCHEMA = 'questdeck/v1'

export function exportJSON(d: Data): string {
  return JSON.stringify({ schema: SCHEMA, exportedAt: new Date().toISOString(), ...d }, null, 2)
}

/** Liest ein exportiertes Deck – auch alte Exporte mit separaten Projekten (die Umwandlung macht der Store). */
export function parseJSON(text: string): Partial<Data> & { projects?: LegacyProject[] } {
  const raw = JSON.parse(text)
  if (!raw || typeof raw !== 'object') throw new Error('Keine gültige JSON-Datei')
  if (!Array.isArray(raw.cards)) throw new Error('Datei enthält keine Karten (cards)')
  return {
    cards: raw.cards,
    links: Array.isArray(raw.links) ? raw.links : [],
    projects: Array.isArray(raw.projects) ? raw.projects : [],
    objectives: Array.isArray(raw.objectives) ? raw.objectives : [],
    settings: raw.settings,
    stats: raw.stats,
  }
}

/* ---------------- CSV ---------------- */

const CSV_COLS = ['title', 'level', 'description', 'status', 'effortHours', 'urgency', 'importance', 'due', 'project', 'tags', 'link'] as const

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportCSV(cards: Card[]): string {
  const title = new Map(cards.map((c) => [c.id, c.title]))
  const rows = cards.map((c) =>
    [c.title, c.level, c.description, c.status, c.effortHours, c.urgency, c.importance, c.due, c.parentId ? title.get(c.parentId) : '', c.tags.join('|'), c.link]
      .map(esc)
      .join(','),
  )
  return [CSV_COLS.join(','), ...rows].join('\n')
}

/** Minimaler CSV-Parser (Komma oder Semikolon, Anführungszeichen, Zeilenumbrüche in Feldern). */
export function parseCSV(text: string): Record<string, string>[] {
  const firstLine = text.split('\n')[0] ?? ''
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (field += '"'), i++
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) row.push(field), (field = '')
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else field += ch
  }
  if (field || row.length) row.push(field), rows.push(row)
  const [head, ...body] = rows.filter((r) => r.some((x) => x.trim()))
  if (!head) return []
  const keys = head.map((h) => h.trim().toLowerCase())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}

const ALIASES: Record<string, string[]> = {
  title: ['title', 'titel', 'summary', 'name', 'aufgabe', 'task'],
  description: ['description', 'beschreibung', 'notes', 'notizen'],
  status: ['status'],
  effortHours: ['efforthours', 'aufwand', 'effort', 'hours', 'stunden', 'estimate'],
  urgency: ['urgency', 'dringlichkeit', 'priority', 'priorität'],
  importance: ['importance', 'wichtigkeit'],
  due: ['due', 'fällig', 'due date', 'deadline', 'faellig'],
  project: ['project', 'projekt', 'parent', 'epic', 'epic link', 'initiative'],
  level: ['level', 'ebene', 'issue type', 'type', 'typ'],
  tags: ['tags', 'labels'],
  link: ['link', 'url'],
}

const pick = (r: Record<string, string>, key: string) => {
  for (const a of ALIASES[key]) if (r[a] !== undefined && r[a] !== '') return r[a]
  return undefined
}

const LEVEL: Record<string, Card['level']> = {
  task: 'task',
  story: 'task',
  bug: 'task',
  'sub-task': 'task',
  subtask: 'task',
  aufgabe: 'task',
  project: 'project',
  projekt: 'project',
  epic: 'project',
  roadmap: 'roadmap',
  initiative: 'roadmap',
}

const PRIO: Record<string, number> = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1, hoch: 4, mittel: 3, niedrig: 2 }
const STATUS: Record<string, Card['status']> = {
  backlog: 'backlog',
  'to do': 'hand',
  todo: 'hand',
  hand: 'hand',
  'in progress': 'doing',
  doing: 'doing',
  done: 'done',
  erledigt: 'done',
}

/** Wandelt CSV-Zeilen (auch Jira-/Trello-Exporte mit ähnlichen Spalten) in Karten-Rohdaten um. */
export function csvToCards(rows: Record<string, string>[]): (Partial<Card> & { projectName?: string })[] {
  const num = (v: string | undefined, d: number) => {
    if (!v) return d
    const n = Number(v.replace(',', '.'))
    return Number.isFinite(n) ? n : (PRIO[v.toLowerCase()] ?? d)
  }
  const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)))
  return rows
    .filter((r) => pick(r, 'title'))
    .map((r) => {
      const due = pick(r, 'due')
      const iso = due?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? due?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/)?.slice(1).reverse().map((x) => x.padStart(2, '0')).join('-')
      const level = LEVEL[(pick(r, 'level') ?? '').toLowerCase()] ?? 'task'
      return {
        title: pick(r, 'title')!,
        level,
        description: pick(r, 'description') ?? '',
        status: STATUS[(pick(r, 'status') ?? '').toLowerCase()] ?? 'backlog',
        effortHours: num(pick(r, 'effortHours'), level === 'task' ? 2 : 0),
        urgency: clamp(num(pick(r, 'urgency'), 3)),
        importance: clamp(num(pick(r, 'importance'), 3)),
        due: iso,
        projectName: pick(r, 'project'),
        tags: (pick(r, 'tags') ?? '').split(/[|,]/).map((t) => t.trim()).filter(Boolean),
        link: pick(r, 'link'),
      }
    })
}

const rid = () => Math.random().toString(36).slice(2, 10)

/**
 * Hängt importierte Zeilen an ihre Eltern: Spalte „Projekt/Epic“ wird mit vorhandenen
 * oder in derselben Datei importierten Projekten/Initiativen abgeglichen (nach Titel);
 * unbekannte Namen werden als neues Projekt angelegt.
 */
export function csvImportCards(rows: ReturnType<typeof csvToCards>, existing: Card[]): Partial<Card>[] {
  const out: Partial<Card>[] = rows.map(({ projectName: _p, ...c }) => (void _p, { ...c, id: rid() }))
  const containers = new Map<string, Partial<Card>>()
  for (const c of [...existing, ...out]) if (c.level !== 'task' && c.title) containers.set(c.title.toLowerCase(), c)
  rows.forEach((r, i) => {
    if (!r.projectName) return
    const key = r.projectName.toLowerCase()
    let parent = containers.get(key)
    if (!parent) {
      parent = { id: rid(), level: 'project', title: r.projectName, emoji: '📦', status: 'hand', effortHours: 0, krIds: [] }
      containers.set(key, parent)
      out.push(parent)
    }
    if (parent.id !== out[i].id) out[i].parentId = parent.id
  })
  return out
}

/* ---------------- Kalender (ICS) ---------------- */

export function exportICS(cards: Card[], dayStart = 9): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Questdeck//DE', 'CALSCALE:GREGORIAN']
  const icsText = (s: string) => s.replace(/[\\;,]/g, (m) => '\\' + m).replace(/\n/g, '\\n')
  const f = (d: Date) => fmt(d, "yyyyMMdd'T'HHmmss")
  const dates = new Set(cards.flatMap((c) => c.slots.map((s) => s.date)))
  for (const date of dates) {
    for (const b of blocksForDay(cards, date, dayStart, false)) {
      const c = cards.find((x) => x.id === b.cardId)!
      const start = new Date(`${date}T00:00:00`)
      start.setMinutes(Math.round(b.start * 60))
      const end = new Date(start.getTime() + b.hours * 3600_000)
      lines.push(
        'BEGIN:VEVENT',
        `UID:${c.id}-${date}@questdeck`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${f(start)}`,
        `DTEND:${f(end)}`,
        `SUMMARY:${icsText(`${c.emoji} ${c.title}`)}`,
        `DESCRIPTION:${icsText(c.description + (c.link ? `\n${c.link}` : ''))}`,
        'END:VEVENT',
      )
    }
  }
  for (const c of cards) {
    if (c.status === 'done') continue
    if (c.due) {
      lines.push(
        'BEGIN:VEVENT',
        `UID:${c.id}-due@questdeck`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${c.due.replace(/-/g, '')}`,
        `SUMMARY:${icsText(`🏁 Fällig: ${c.title}`)}`,
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/* ---------------- Markdown-Standup (z. B. für Slack) ---------------- */

export function standupMarkdown(cards: Card[], range: Range, label: string): string {
  const done = cards.filter((c) => c.status === 'done' && c.doneAt && inRange(c.doneAt.slice(0, 10), range))
  const doing = cards.filter((c) => c.status === 'doing')
  const hand = cards.filter((c) => c.status === 'hand')
  const line = (c: Card) => `• ${c.emoji} ${c.title} _(${points(c.effortHours)} ◇${c.due ? `, fällig ${fmt(c.due, 'd.M.')}` : ''})_`
  return [
    `*Questdeck · ${label}*`,
    '',
    `✅ *Erledigt (${done.length})*`,
    ...done.map(line),
    '',
    `▶️ *Im Spiel (${doing.length})*`,
    ...doing.map(line),
    '',
    `🃏 *Auf der Hand (${hand.length})*`,
    ...hand.map(line),
  ].join('\n')
}

export function download(name: string, content: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
