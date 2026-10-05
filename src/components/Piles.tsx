import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { parseISO } from 'date-fns'
import { useStore, type Flight } from '../store'
import { CardBack, TaskCard } from './Card'
import { Drop } from './Dnd'
import { fmt, horizonLabel, horizonRange, inRange } from '../lib/dates'
import { xpFor } from '../lib/game'

const tilt = (id: string, spread = 10) => {
  let h = 0
  for (const ch of id) h = (h * 17 + ch.charCodeAt(0)) % 1000
  return (h / 1000 - 0.5) * spread
}

/** Ablagestapel unten rechts: hier landen erledigte Karten. Karten können auch direkt hierher gezogen werden. */
export function DiscardPile() {
  const cards = useStore((s) => s.cards)
  const bump = useStore((s) => s.pileBump)
  const [open, setOpen] = useState(false)
  const controls = useAnimationControls()
  const done = cards
    .filter((c) => c.status === 'done')
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))

  useEffect(() => {
    if (bump) controls.start({ scale: [1, 1.12, 0.96, 1], rotate: [0, -3, 2, 0], transition: { duration: 0.45 } })
  }, [bump, controls])

  return (
    <>
      <Drop id="pile" className="pile pile-discard">
        <motion.div id="discard-pile" className="pile-stack" animate={controls} onClick={() => setOpen(true)} title="Ablage ansehen">
          {done.length === 0 && <div className="pile-empty">Ablage</div>}
          {done
            .slice(0, 4)
            .reverse()
            .map((c, i) => (
              <div key={c.id} className="pile-card" style={{ transform: `rotate(${tilt(c.id)}deg) translateY(${-i * 2}px)` }}>
                <TaskCard card={c} size="sm" tilt={false} />
              </div>
            ))}
          <span className="pile-count">{done.length}</span>
        </motion.div>
        <div className="pile-label">Ablage · hierher ziehen = erledigt</div>
      </Drop>
      <AnimatePresence>{open && <DoneDrawer onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

/** Ziehstapel unten links: „Karte ziehen“ holt die wichtigste Karte aus dem Backlog auf die Hand. */
export function DrawPile() {
  const count = useStore((s) => s.cards.filter((c) => c.status === 'backlog').length)
  const drawHand = useStore((s) => s.drawHand)
  const drawOne = useStore((s) => s.drawCard)
  const [flip, setFlip] = useState(0)
  return (
    <Drop id="draw" className="pile pile-draw">
      <motion.div
        className="pile-stack"
        whileHover={{ y: -4 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => (e.shiftKey ? drawOne() : drawHand(), setFlip((f) => f + 1))}
        title="Hand ziehen (D): füllt heute bis zur Kapazität, Blockiertes bleibt liegen · ⇧-Klick: nur eine Karte"
      >
        {Array.from({ length: Math.min(4, Math.max(1, count)) }).map((_, i) => (
          <div key={i} className="pile-card" style={{ transform: `translate(${i * 1.5}px, ${-i * 2.5}px)` }}>
            <CardBack size="sm" />
          </div>
        ))}
        <AnimatePresence>
          {flip > 0 && (
            <motion.div
              key={flip}
              className="pile-card draw-ghost"
              initial={{ y: 0, rotateY: 0, opacity: 1 }}
              animate={{ y: -120, x: 80, rotateY: 180, opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <CardBack size="sm" />
            </motion.div>
          )}
        </AnimatePresence>
        <span className="pile-count">{count}</span>
      </motion.div>
      <div className="pile-label">Stapel · klicken = Hand für heute ziehen</div>
    </Drop>
  )
}

function DoneDrawer({ onClose }: { onClose: () => void }) {
  const cards = useStore((s) => s.cards)
  const horizon = useStore((s) => s.horizon)
  const cursor = useStore((s) => s.cursor)
  const settings = useStore((s) => s.settings)
  const { reopenCard, select } = useStore.getState()
  const [all, setAll] = useState(false)
  const range = horizonRange(horizon, parseISO(cursor), settings)
  const done = cards
    .filter((c) => c.status === 'done' && (all || inRange(c.doneAt?.slice(0, 10), range)))
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  const xp = done.reduce((s, c) => s + xpFor(c), 0)
  const hours = done.reduce((s, c) => s + c.effortHours, 0)

  return (
    <motion.div className="backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        className="drawer"
        initial={{ x: 480 }}
        animate={{ x: 0 }}
        exit={{ x: 480 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="drawer-head">
          <h2>🏆 Ablage</h2>
          <button className="ghost" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="seg small">
          <button className={!all ? 'active' : ''} onClick={() => setAll(false)}>
            {horizonLabel(horizon, parseISO(cursor), settings)}
          </button>
          <button className={all ? 'active' : ''} onClick={() => setAll(true)}>
            Alles
          </button>
        </div>
        <div className="done-summary">
          <div>
            <b>{done.length}</b>
            <small>Karten</small>
          </div>
          <div>
            <b>{hours} h</b>
            <small>Aufwand</small>
          </div>
          <div>
            <b>{xp}</b>
            <small>XP</small>
          </div>
        </div>
        <div className="done-list">
          {done.length === 0 && <p className="muted">Hier ist noch nichts gelandet. Leg los! ✨</p>}
          {done.map((c) => (
            <div key={c.id} className="done-row">
              <span className="done-emoji">{c.emoji}</span>
              <div className="grow" onClick={() => (select(c.id), onClose())}>
                <b>{c.title}</b>
                <small>{c.doneAt && fmt(c.doneAt, "EEE d. MMM, HH:mm 'Uhr'")}</small>
              </div>
              <button className="ghost small" onClick={() => reopenCard(c.id)} title="Zurück auf die Hand">
                ↩
              </button>
            </div>
          ))}
        </div>
      </motion.aside>
    </motion.div>
  )
}

/** Animiert erledigte Karten vom Spielfeld auf den Ablagestapel – mit Funkenregen. */
export function FlightLayer() {
  const flights = useStore((s) => s.flights)
  return (
    <div className="flight-layer">
      <AnimatePresence>
        {flights.map((f) => (
          <FlyingCard key={f.id} flight={f} />
        ))}
      </AnimatePresence>
    </div>
  )
}

function FlyingCard({ flight }: { flight: Flight }) {
  const land = useStore((s) => s.landFlight)
  const target = document.getElementById('discard-pile')?.getBoundingClientRect()
  const { from } = flight
  // TaskCard "md" hat eine feste Größe; skaliert wird um die Mitte
  const baseW = 182
  const baseH = baseW * 1.4
  const startScale = from.width / baseW
  const sx = from.x + from.width / 2 - baseW / 2
  const sy = from.y + from.height / 2 - baseH / 2
  const tx = (target ? target.x + target.width / 2 : window.innerWidth - 90) - baseW / 2
  const ty = (target ? target.y + target.height / 2 : window.innerHeight - 110) - baseH / 2
  const endScale = target ? target.width / baseW : 0.5

  return (
    <>
      <Sparks x={from.x + from.width / 2} y={from.y + from.height / 2} />
      <motion.div
        className="flying"
        initial={{ x: sx, y: sy, scale: startScale, rotate: 0 }}
        animate={{
          x: [sx, sx - 10, tx],
          y: [sy, sy - 60, ty],
          scale: [startScale, startScale * 1.12, endScale],
          rotate: [0, -8, 360 + tilt(flight.card.id)],
        }}
        transition={{ duration: 0.9, times: [0, 0.25, 1], ease: ['easeOut', 'easeInOut'] }}
        onAnimationComplete={() => land(flight.id)}
        style={{ position: 'fixed', left: 0, top: 0, transformOrigin: 'center center' }}
      >
        <TaskCard card={flight.card} size="md" tilt={false} className="flying-card" />
      </motion.div>
    </>
  )
}

function Sparks({ x, y }: { x: number; y: number }) {
  const n = 18
  return (
    <div className="sparks" style={{ left: x, top: y }}>
      {Array.from({ length: n }).map((_, i) => {
        const a = (i / n) * Math.PI * 2
        const r = 70 + (i % 3) * 30
        return (
          <motion.i
            key={i}
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, opacity: 0, scale: 0.3 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            style={{ background: ['#ffd36b', '#7c6cff', '#4fd18b', '#ff7a9a'][i % 4] }}
          />
        )
      })}
    </div>
  )
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toasts">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            className="toast"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40 }}
          >
            {t.icon && <span>{t.icon}</span>}
            <span className="grow">{t.text}</span>
            {t.action && (
              <button
                className="ghost small"
                onClick={() => {
                  t.action!.run()
                  dismiss(t.id)
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
