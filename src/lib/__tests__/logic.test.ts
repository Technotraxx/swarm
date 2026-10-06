import { describe, expect, it } from 'vitest'
import { parseCapture } from '../capture'
import { criticalPath, createsCycle, isBlocked } from '../graph'
import { horizonRange, sprintRange } from '../dates'
import { level, points } from '../game'
import { csvImportCards, csvToCards, parseCSV } from '../io'
import { canParent, colorOf, krsOf, migrateLegacy, rollup } from '../hierarchy'
import { blocksForDay, cardAge, firstFree, lanes, planHand } from '../schedule'
import { krProgress, newCard } from '../../store'
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

describe('Planung', () => {
  const settings = { capacity: [6, 6, 6, 6, 6, 0, 0], capacityOverrides: {}, dayStart: 9 }
  const day = '2026-10-05' // Montag

  it('firstFree findet die erste Lücke', () => {
    expect(firstFree([], 2, 9)).toBe(9)
    expect(firstFree([{ start: 9, hours: 1 }, { start: 11, hours: 1 }], 1, 9)).toBe(10)
    expect(firstFree([{ start: 9, hours: 1 }, { start: 10.5, hours: 1 }], 1, 9)).toBe(11.5)
  })

  it('legt alte Blöcke ohne Uhrzeit in freie Lücken', () => {
    const a = newCard({ id: 'a', slots: [{ date: day, hours: 2, start: 9 }] })
    const b = newCard({ id: 'b', slots: [{ date: day, hours: 1 }] })
    expect(blocksForDay([a, b], day, 9).map((x) => [x.cardId, x.start])).toEqual([
      ['a', 9],
      ['b', 11],
    ])
  })

  it('verteilt überlappende Blöcke auf Spalten', () => {
    const a = newCard({ id: 'a', slots: [{ date: day, hours: 2, start: 9 }] })
    const b = newCard({ id: 'b', slots: [{ date: day, hours: 1, start: 10 }] })
    const c = newCard({ id: 'c', slots: [{ date: day, hours: 1, start: 12 }] })
    const l = lanes(blocksForDay([a, b, c], day, 9))
    expect([...l.values()]).toEqual([
      { lane: 0, of: 2 },
      { lane: 1, of: 2 },
      { lane: 0, of: 1 },
    ])
  })

  it('Hand ziehen füllt bis zur Kapazität und lässt Blockiertes liegen', () => {
    const urgent = newCard({ id: 'u', urgency: 5, importance: 5, effortHours: 3 })
    const blocked = newCard({ id: 'x', urgency: 5, importance: 5, effortHours: 1 })
    const blocker = newCard({ id: 'y', urgency: 1, importance: 1, effortHours: 4, status: 'hand' })
    const links: Link[] = [{ id: 'yx', from: 'y', to: 'x', type: 'blocks' }]
    const plan = planHand([urgent, blocked, blocker], links, day, settings)
    expect(plan.skippedBlocked).toBe(1)
    expect(plan.picks).toEqual([
      { cardId: 'u', hours: 3, start: 9 },
      { cardId: 'y', hours: 3, start: 12 },
    ])
    expect(plan.free).toBe(0)
  })
})

describe('Alterung', () => {
  const now = Date.parse('2026-10-30T12:00:00Z')
  it('altert nach 7, 14 und 28 Tagen ohne Berührung', () => {
    const at = (d: string) => cardAge({ status: 'backlog', createdAt: d }, now).age
    expect(at('2026-10-28T00:00:00Z')).toBe(0)
    expect(at('2026-10-20T00:00:00Z')).toBe(1)
    expect(at('2026-10-10T00:00:00Z')).toBe(2)
    expect(at('2026-09-01T00:00:00Z')).toBe(3)
  })
  it('Anfassen und „Im Spiel“ setzen die Uhr zurück', () => {
    expect(cardAge({ status: 'backlog', createdAt: '2026-09-01', touchedAt: '2026-10-29T00:00:00Z' }, now).age).toBe(0)
    expect(cardAge({ status: 'doing', createdAt: '2026-09-01' }, now).age).toBe(0)
  })
})

describe('Ebenen (Task → Projekt → Initiative)', () => {
  const ini = newCard({ id: 'r', level: 'roadmap', effortHours: 0, krIds: ['krA'] })
  const proj = newCard({ id: 'p', level: 'project', parentId: 'r', effortHours: 0, krIds: ['krB'] })
  const t1 = newCard({ id: 't1', parentId: 'p', effortHours: 3, status: 'done' })
  const t2 = newCard({ id: 't2', parentId: 'p', effortHours: 1 })
  const all = [ini, proj, t1, t2]

  it('rechnet Aufwand und Fortschritt nach oben zusammen', () => {
    expect(rollup(all, proj)).toMatchObject({ total: 4, done: 3, value: 0.75, count: 2, open: 1 })
    expect(rollup(all, ini)).toMatchObject({ total: 4, done: 3, count: 2 })
  })
  it('erlaubt nur sinnvolle Eltern', () => {
    expect(canParent(t2, proj)).toBe(true)
    expect(canParent(t2, ini)).toBe(true)
    expect(canParent(proj, ini)).toBe(true)
    expect(canParent(ini, proj)).toBe(false)
    expect(canParent(proj, t1)).toBe(false)
  })
  it('vererbt Key Results und Farbe nach unten', () => {
    expect(krsOf(all, t2).sort()).toEqual(['krA', 'krB'])
    expect(colorOf(all, t2)).toBeUndefined()
    expect(colorOf([{ ...ini, color: '#abc' }, proj, t2], t2)).toBe('#abc')
  })
  it('zählt KR-Fortschritt über das Projekt mit', () => {
    expect(krProgress('krB', all).value).toBe(0.75)
  })
  it('wandelt alte Projekte in Projektkarten um', () => {
    const m = migrateLegacy({
      cards: [{ id: 'x', title: 'Alt', projectId: 'p9' }],
      projects: [{ id: 'p9', name: 'Altes Projekt', emoji: '📦', color: '#123', description: '', start: '2026-01-01', end: '2026-02-01', krIds: ['k'] }],
    })
    expect(m.cards).toEqual([
      expect.objectContaining({ id: 'x', level: 'task', parentId: 'p9' }),
      expect.objectContaining({ id: 'p9', level: 'project', title: 'Altes Projekt', due: '2026-02-01', krIds: ['k'] }),
    ])
    expect('projects' in m).toBe(false)
  })
})

describe('Schnell-Eingabe mit Ebene', () => {
  it('=projekt und =initiative setzen die Ebene', () => {
    expect(parseCapture('Website =projekt #markt', now)).toMatchObject({ title: 'Website', level: 'project', project: 'markt' })
    expect(parseCapture('Markteintritt =i', now).level).toBe('roadmap')
    expect(parseCapture('a=b bleibt', now).title).toBe('a=b bleibt')
  })
})

describe('CSV mit Epics', () => {
  it('hängt Zeilen an vorhandene oder neue Projekte', () => {
    const rows = csvToCards(parseCSV('Summary,Issue Type,Epic Link\nLogin,Story,Auth\nAuth,Epic,\nAPI,Task,Neu'))
    const out = csvImportCards(rows, [])
    const auth = out.find((c) => c.title === 'Auth')!
    expect(auth.level).toBe('project')
    expect(out.find((c) => c.title === 'Login')!.parentId).toBe(auth.id)
    const neu = out.find((c) => c.title === 'Neu')!
    expect(neu.level).toBe('project')
    expect(out.find((c) => c.title === 'API')!.parentId).toBe(neu.id)
  })
})
