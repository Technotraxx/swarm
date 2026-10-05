let ctx: AudioContext | undefined

/** Kleine synthetisierte Sounds – kein Asset nötig. */
export function play(kind: 'done' | 'draw' | 'link' | 'drop') {
  try {
    ctx ??= new AudioContext()
    const t = ctx.currentTime
    const notes: Record<typeof kind, number[]> = {
      done: [523.25, 659.25, 783.99, 1046.5],
      draw: [392, 523.25],
      link: [660, 880],
      drop: [300],
    }
    notes[kind].forEach((f, i) => {
      const o = ctx!.createOscillator()
      const g = ctx!.createGain()
      o.type = kind === 'drop' ? 'sine' : 'triangle'
      o.frequency.value = f
      const s = t + i * 0.07
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.08, s + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.25)
      o.connect(g).connect(ctx!.destination)
      o.start(s)
      o.stop(s + 0.3)
    })
  } catch {
    /* Audio nicht verfügbar – egal */
  }
}
