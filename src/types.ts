export type ID = string

/** Wo liegt die Karte auf dem Tisch? */
export type CardStatus = 'backlog' | 'hand' | 'doing' | 'done'

export type LinkType =
  | 'depends' // B braucht A (Standard-Abhängigkeit)
  | 'blocks' // A blockiert B hart
  | 'happy' // Happy Path – die gewünschte Reihenfolge
  | 'delay' // A verzögert B
  | 'decision' // A ist eine Entscheidung, die B freigibt
  | 'relates' // lose Verbindung

export interface ChecklistItem {
  id: ID
  text: string
  done: boolean
  createdAt: string
}

export interface LogEntry {
  id: ID
  text: string
  at: string
}

/** Ein Zeitblock im Kalender: an diesem Tag arbeite ich x Stunden an der Karte. */
export interface Slot {
  date: string // yyyy-MM-dd
  hours: number
  /** Startzeit in Stunden (z. B. 9.5 = 9:30). Fehlt sie, wird der Block in die erste freie Lücke gelegt. */
  start?: number
}

export interface Raci {
  r: string[]
  a: string
  c: string[]
  i: string[]
}

export interface Card {
  id: ID
  title: string
  description: string
  emoji: string
  /** Index in die Motiv-Paletten (Hintergrund der Kartenillustration) */
  motif: number
  imageUrl?: string
  link?: string
  effortHours: number
  urgency: number // 1..5
  importance: number // 1..5
  status: CardStatus
  projectId?: ID
  krId?: ID
  due?: string // yyyy-MM-dd
  slots: Slot[]
  tags: string[]
  checklist: ChecklistItem[]
  log: LogEntry[]
  raci: Raci
  decider?: string
  /** Position im Abhängigkeits-Netz */
  pos?: { x: number; y: number }
  createdAt: string
  /** Zuletzt bewusst angefasst (verschoben, geplant, ToDo/Notiz) – Grundlage für die Alterung */
  touchedAt?: string
  startedAt?: string
  doneAt?: string
  order: number
}

export interface Link {
  id: ID
  from: ID
  to: ID
  type: LinkType
  note?: string
}

export interface Project {
  id: ID
  name: string
  emoji: string
  color: string
  description: string
  start: string
  end: string
  krIds: ID[]
  archived?: boolean
}

export interface KeyResult {
  id: ID
  title: string
  /** manuell gepflegter Fortschritt 0..1 – wird mit Kartenfortschritt kombiniert */
  manual?: number
}

export interface Objective {
  id: ID
  title: string
  emoji: string
  quarter: string // z.B. "2026-Q4"
  keyResults: KeyResult[]
}

export type Horizon = 'day' | 'week' | 'sprint' | 'month' | 'quarter' | 'year'

export type ViewId = 'board' | 'projects' | 'roadmap' | 'graph' | 'calendar' | 'okr'

export interface Settings {
  /** Kapazität in Stunden je Wochentag, Index 0 = Montag */
  capacity: number[]
  /** Abweichende Kapazität pro Datum (Urlaub, Meetingtag …) */
  capacityOverrides: Record<string, number>
  sprintAnchor: string // Startdatum eines Sprints, von dem aus 2-Wochen-Sprints gezählt werden
  /** Arbeitsbeginn in Stunden; die Tageskapazität zählt ab hier */
  dayStart?: number
  theme: 'dark' | 'light'
  sound: boolean
}

export interface Stats {
  xp: number
  streak: number
  lastDoneDay?: string
}
