import { describe, expect, it } from 'vitest'
import { parseCapture } from '../capture'
import { criticalPath, createsCycle, isBlocked } from '../graph'
import { horizonRange, sprintRange } from '../dates'
import { level, points } from '../game'
import { csvToCards, parseCSV } from '../io'
import { newCard } from '../../store'
import type { Link } from '../../types'

const now = new Date(2026, 9, 5) // Montag, 5. Okt. 2026

describe('parseCapture', () => {
  it('erkennt Projekt, Dringlichkeit, Aufwand, Fälligkeit, Tags und Link', () => {
    const p = parseCapture('Angebot schreiben #launch !4 ^5 ~90m @fr +sales https://x.de', now)
    expect(p).toMatchObject({
      title: 'Angebot schreiben',
      project: 'launch',
      urgency: 4,
      importance: 5,
      effortHours: 1.5,
      due: '2026-10-09',
      tags: ['sales'],
      link: 'https://x.de',
    })
  })
  it('versteht !!!, Tage als Aufwand und deutsche Datumsangaben', () => {
    expect(parseCapture('X !!! ~2d @12.10.', now)).toMatchObject({ urgency: 5, effortHours: 16, due: '2026-10-12' })
    expect(parseCapture('Y @morgen', now).due).toBe('2026-10-06')
  })
  it('lässt unbekannte @-Wörter im Titel', () => {
    expect(parseCapture('Mail an @jonas', now).title).toBe('Mail an @jonas')
  })
})

describe('Graph', () => {
  const a = newCard({ id: 'a', effortHours: 2 })
  const b = newCard({ id: 'b', effortHours: 8 })
  const c = newCard({ id: 'c', effortHours: 1 })
  const d = newCard({ id: 'd', effortHours: 3 })
  const links: Link[] = [
    { id: 'ab', from: 'a', to: 'b', type: 'depends' },
    { id: 'ac', from: 'a', to: 'c', type: 'depends' },
    { id: 'bd', from: 'b', to: 'd', type: 'blocks' },
    { id: 'cd', from: 'c', to: 'd', type: 'relates' },
  ]
  it('findet den längsten Weg nach Aufwand', () => {
    const cp = criticalPath([a, b, c, d], links)
    expect([...cp.cards]).toEqual(['a', 'b', 'd'])
    expect(cp.hours).toBe(13)
  })
  it('erkennt Blocker nur bei offenen Vorgängern', () => {
    const map = new Map([a, b, c, d].map((x) => [x.id, x]))
    expect(isBlocked('b', map, links)).toBe(true)
    map.set('a', { ...a, status: 'done' })
    expect(isBlocked('b', map, links)).toBe(false)
  })
  it('verhindert Zyklen', () => {
    expect(createsCycle('d', 'a', links)).toBe(true)
    expect(createsCycle('c', 'b', links)).toBe(false)
  })
})

describe('Zeiträume', () => {
  it('Woche beginnt am Montag', () => {
    const r = horizonRange('week', new Date(2026, 9, 8), { sprintAnchor: '2026-01-05' })
    expect(r.start.getDate()).toBe(5)
    expect(r.end.getDate()).toBe(11)
  })
  it('Sprints sind 2 Wochen ab Anker', () => {
    const r = sprintRange('2026-01-05', new Date(2026, 0, 20))
    expect(r.start.getDate()).toBe(19)
    expect(r.end.getDate()).toBe(1)
  })
})

describe('Spielwerte', () => {
  it('Aufwand → Mana', () => {
    expect([0.5, 2, 3, 6, 12, 30].map(points)).toEqual([1, 2, 3, 5, 8, 13])
  })
  it('Level steigt mit XP', () => {
    expect(level(0).level).toBe(1)
    expect(level(100).level).toBe(2)
  })
})

describe('CSV-Import', () => {
  it('liest Jira-artige Spalten mit Semikolon', () => {
    const rows = parseCSV('Summary;Priority;Due Date;Epic\n"Login; fixen";High;12.10.2026;Auth\n')
    expect(csvToCards(rows)[0]).toMatchObject({ title: 'Login; fixen', urgency: 4, due: '2026-10-12', projectName: 'Auth' })
  })
})
