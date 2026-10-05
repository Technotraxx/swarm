import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { parseISO } from 'date-fns'
import { capacityFor, fmt } from '../lib/dates'

/**
 * Zwei-Klick-Bestätigung statt confirm(): der erste Klick fragt nach, der zweite führt aus.
 * Nach 3 s ohne Bestätigung springt der Knopf zurück.
 */
export function ConfirmButton({
  onConfirm,
  children,
  ask = 'Wirklich?',
  className = 'danger',
  title,
}: {
  onConfirm: () => void
  children: ReactNode
  ask?: string
  className?: string
  title?: string
}) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return (
    <button
      className={`${className} ${armed ? 'armed' : ''}`}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        if (armed) {
          setArmed(false)
          onConfirm()
        } else setArmed(true)
      }}
    >
      {armed ? ask : children}
    </button>
  )
}

/** Kapazität eines Tages direkt im Kalender ändern (leer = Standard des Wochentags). */
export function CapacityButton({ date, booked }: { date: string; booked: number }) {
  const settings = useStore((s) => s.settings)
  const { updateSettings } = useStore.getState()
  const cap = capacityFor(date, settings)
  const [edit, setEdit] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (edit) ref.current?.select()
  }, [edit])

  const commit = (v: string) => {
    setEdit(false)
    const overrides = { ...settings.capacityOverrides }
    if (v.trim() === '') delete overrides[date]
    else overrides[date] = Math.max(0, Number(v.replace(',', '.')) || 0)
    updateSettings({ capacityOverrides: overrides })
  }

  if (edit)
    return (
      <input
        ref={ref}
        className="cap-input"
        aria-label={`Kapazität am ${fmt(date, 'EEEE, d. MMMM')} in Stunden, leer = Standard`}
        defaultValue={date in settings.capacityOverrides ? String(cap) : ''}
        placeholder={String(settings.capacity[(parseISO(date).getDay() + 6) % 7] ?? 0)}
        inputMode="decimal"
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(e.currentTarget.value)
          if (e.key === 'Escape') setEdit(false)
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    )
  return (
    <button
      className={`cap ${date in settings.capacityOverrides ? 'custom' : ''}`}
      onClick={() => setEdit(true)}
      title="Kapazität für diesen Tag ändern (Urlaub, Meetingtag …)"
    >
      {booked}/{cap} h
    </button>
  )
}
