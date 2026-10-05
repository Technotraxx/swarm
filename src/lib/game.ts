import type { Card, LinkType } from '../types'
import { daysUntil } from './dates'

/** Aufwand in Stunden → "Mana-Kosten" auf Fibonacci-Skala wie im Planning Poker */
export function points(hours: number): number {
  if (hours <= 1) return 1
  if (hours <= 2) return 2
  if (hours <= 4) return 3
  if (hours <= 8) return 5
  if (hours <= 16) return 8
  return 13
}

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export const RARITY: Record<Rarity, { label: string; color: string }> = {
  common: { label: 'Gewöhnlich', color: '#9aa3b2' },
  uncommon: { label: 'Ungewöhnlich', color: '#4fd18b' },
  rare: { label: 'Selten', color: '#4aa8ff' },
  epic: { label: 'Episch', color: '#b06bff' },
  legendary: { label: 'Legendär', color: '#ffb547' },
}

export function rarity(card: Pick<Card, 'effortHours' | 'importance'>): Rarity {
  const p = points(card.effortHours) + (card.importance >= 5 ? 3 : card.importance >= 4 ? 1 : 0)
  if (p >= 13) return 'legendary'
  if (p >= 8) return 'epic'
  if (p >= 5) return 'rare'
  if (p >= 3) return 'uncommon'
  return 'common'
}

/** Wie dringend sollte ich diese Karte jetzt ziehen? Höher = früher. */
export function priority(card: Card): number {
  let s = (card.urgency * 2 + card.importance * 1.5) / Math.sqrt(Math.max(0.5, card.effortHours))
  if (card.status === 'backlog' || card.status === 'hand') {
    const idle = (Date.now() - new Date(card.touchedAt ?? card.createdAt).getTime()) / 86_400_000
    if (idle >= 7) s += Math.min(3, idle / 14)
  }
  if (card.due) {
    const d = daysUntil(card.due)
    if (d < 0) s += 6
    else if (d <= 1) s += 4
    else if (d <= 3) s += 2
    else if (d <= 7) s += 1
  }
  return s
}

export function xpFor(card: Card): number {
  return points(card.effortHours) * 10 + card.urgency * 2 + card.importance * 3
}

export function level(xp: number) {
  // Jedes Level braucht etwas mehr XP als das vorherige
  let lvl = 1
  let need = 100
  let rest = xp
  while (rest >= need) {
    rest -= need
    lvl++
    need = Math.round(need * 1.15)
  }
  return { level: lvl, progress: rest / need, need, rest }
}

export const MOTIFS: string[] = [
  'linear-gradient(135deg,#ff9a8b 0%,#ff6a88 55%,#ff99ac 100%)',
  'linear-gradient(135deg,#6a85f1 0%,#b06bff 100%)',
  'linear-gradient(135deg,#43e97b 0%,#38f9d7 100%)',
  'linear-gradient(135deg,#f6d365 0%,#fda085 100%)',
  'linear-gradient(135deg,#30cfd0 0%,#330867 100%)',
  'linear-gradient(135deg,#a1c4fd 0%,#c2e9fb 100%)',
  'linear-gradient(135deg,#fccb90 0%,#d57eeb 100%)',
  'linear-gradient(135deg,#0f2027 0%,#2c5364 100%)',
  'radial-gradient(circle at 30% 20%,#ffe29f 0%,#ffa99f 45%,#ff719a 100%)',
  'radial-gradient(circle at 70% 30%,#84fab0 0%,#8fd3f4 100%)',
  'linear-gradient(160deg,#1e3c72 0%,#2a5298 50%,#7f53ac 100%)',
  'linear-gradient(135deg,#ee9ca7 0%,#ffdde1 100%)',
]

export const EMOJIS = [
  '📝', '🚀', '🎯', '🧠', '🛠️', '📊', '💡', '🔥', '📣', '🤝', '🧪', '🗺️', '📦', '🧩', '⚙️', '🎨',
  '📅', '✉️', '🔍', '🏁', '🐛', '🧭', '💬', '🏗️', '🎤', '📈', '🛡️', '⚖️', '🌱', '🗝️', '🎁', '☕',
]

export const LINK_TYPES: Record<LinkType, { label: string; color: string; dash?: string; hint: string }> = {
  depends: { label: 'Abhängigkeit', color: '#8fa3c7', hint: 'B braucht A vorher' },
  blocks: { label: 'Blocker', color: '#ff5c6c', hint: 'A blockiert B hart' },
  happy: { label: 'Happy Path', color: '#4fd18b', hint: 'gewünschte Reihenfolge' },
  delay: { label: 'Verzögerung', color: '#ffa53d', dash: '7 6', hint: 'A verzögert B' },
  decision: { label: 'Entscheidung', color: '#b06bff', dash: '2 5', hint: 'A ist eine Entscheidung für B' },
  relates: { label: 'Bezug', color: '#5d6678', dash: '3 4', hint: 'lose verbunden' },
}

/** Link-Typen, die eine harte Reihenfolge erzwingen (für Blocker & Critical Path) */
export const ORDERING: LinkType[] = ['depends', 'blocks', 'happy', 'decision']

export const remainingHours = (c: Card) => (c.status === 'done' ? 0 : c.effortHours * (1 - checklistProgress(c) * 0.5))

export function checklistProgress(c: Card) {
  if (!c.checklist.length) return 0
  return c.checklist.filter((i) => i.done).length / c.checklist.length
}

export const scheduledHours = (c: Card) => c.slots.reduce((s, x) => s + x.hours, 0)

export const unscheduledHours = (c: Card) => Math.max(0, Math.round((c.effortHours - scheduledHours(c)) * 2) / 2)

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

export function personColor(name: string) {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  return `hsl(${h} 70% 62%)`
}
