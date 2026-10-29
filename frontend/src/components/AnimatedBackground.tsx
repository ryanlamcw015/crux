import { useEffect, useRef } from 'react'

/*
 * Animated background: slowly shifting topographic contour lines (like a climbing area map),
 * drifting chalk dust, and soft glowing orbs.
 *
 * Contours come from a 3D noise field (x, y, time). Marching squares traces where the field crosses
 * each contour level. Renders at ~30fps, pauses in hidden tabs, and draws one still frame when the
 * user prefers reduced motion.
 */

function hash(x: number, y: number, z: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

const fade = (t: number) => t * t * (3 - 2 * t)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const u = fade(x - xi)
  const v = fade(y - yi)
  const w = fade(z - zi)
  const c = (dx: number, dy: number, dz: number) => hash(xi + dx, yi + dy, zi + dz)
  const x00 = lerp(c(0, 0, 0), c(1, 0, 0), u)
  const x10 = lerp(c(0, 1, 0), c(1, 1, 0), u)
  const x01 = lerp(c(0, 0, 1), c(1, 0, 1), u)
  const x11 = lerp(c(0, 1, 1), c(1, 1, 1), u)
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w) * 2 - 1
}

const field = (x: number, y: number, t: number) => noise3(x, y, t) * 0.65 + noise3(x * 2.1, y * 2.1, t * 1.3) * 0.35

const LEVELS = [-0.5, -0.36, -0.22, -0.08, 0.06, 0.2, 0.34, 0.48]
const CELL = 22

interface Mote {
  x: number
  y: number
  r: number
  speed: number
  phase: number
  alpha: number
}

export function AnimatedBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let grid = new Float32Array(0)
    let motes: Mote[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(width / CELL) + 1
      rows = Math.ceil(height / CELL) + 1
      grid = new Float32Array(cols * rows)
      const count = Math.round(Math.min(48, (width * height) / 30000))
      motes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.4 + 0.4,
        speed: Math.random() * 0.25 + 0.08,
        phase: Math.random() * Math.PI * 2,
        alpha: Math.random() * 0.25 + 0.08,
      }))
    }

    const draw = (time: number) => {
      const t = time * 0.000035
      ctx.clearRect(0, 0, width, height)

      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          grid[j * cols + i] = field(i * CELL * 0.0032, j * CELL * 0.0032, t)
        }
      }

      LEVELS.forEach((level, li) => {
        const major = li % 3 === 1
        const warm = level > 0
        ctx.strokeStyle = warm
          ? `rgba(200, 245, 96, ${major ? 0.24 : 0.1})`
          : `rgba(108, 196, 255, ${major ? 0.2 : 0.085})`
        ctx.lineWidth = major ? 1.2 : 0.8
        ctx.beginPath()
        for (let j = 0; j < rows - 1; j++) {
          for (let i = 0; i < cols - 1; i++) {
            const a = grid[j * cols + i]
            const b = grid[j * cols + i + 1]
            const c = grid[(j + 1) * cols + i + 1]
            const d = grid[(j + 1) * cols + i]
            const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0)
            if (idx === 0 || idx === 15) continue
            const x = i * CELL
            const y = j * CELL
            const top = (): [number, number] => [x + CELL * ((level - a) / (b - a)), y]
            const right = (): [number, number] => [x + CELL, y + CELL * ((level - b) / (c - b))]
            const bottom = (): [number, number] => [x + CELL * ((level - d) / (c - d)), y + CELL]
            const left = (): [number, number] => [x, y + CELL * ((level - a) / (d - a))]
            const seg = (p: [number, number], q: [number, number]) => {
              ctx.moveTo(p[0], p[1])
              ctx.lineTo(q[0], q[1])
            }
            switch (idx) {
              case 1: case 14: seg(left(), bottom()); break
              case 2: case 13: seg(bottom(), right()); break
              case 3: case 12: seg(left(), right()); break
              case 4: case 11: seg(top(), right()); break
              case 6: case 9: seg(top(), bottom()); break
              case 7: case 8: seg(left(), top()); break
              case 5: seg(left(), top()); seg(bottom(), right()); break
              case 10: seg(top(), right()); seg(left(), bottom()); break
            }
          }
        }
        ctx.stroke()
      })

      for (const m of motes) {
        if (!reduceMotion) {
          m.y -= m.speed
          m.x += Math.sin(time * 0.0004 + m.phase) * 0.15
          if (m.y < -4) {
            m.y = height + 4
            m.x = Math.random() * width
          }
        }
        ctx.beginPath()
        ctx.fillStyle = `rgba(232, 237, 242, ${m.alpha})`
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    resize()
    window.addEventListener('resize', resize)

    if (reduceMotion) {
      draw(0)
      return () => window.removeEventListener('resize', resize)
    }

    let raf = 0
    let last = 0
    const loop = (time: number) => {
      raf = requestAnimationFrame(loop)
      if (time - last < 33) return // ~30fps is plenty for slow drift
      last = time
      draw(time)
    }
    raf = requestAnimationFrame(loop)

    const onVisibility = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) raf = requestAnimationFrame(loop)
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-[10vw] -top-[20vh] h-[60vh] w-[60vh] animate-float rounded-full bg-chalk/10 blur-[120px]" />
      <div
        className="absolute -right-[10vw] top-[20vh] h-[55vh] w-[55vh] animate-float rounded-full bg-sky/10 blur-[120px]"
        style={{ animationDelay: '-6s', animationDuration: '22s' }}
      />
      <div
        className="absolute bottom-[-25vh] left-[30vw] h-[50vh] w-[50vh] animate-float rounded-full bg-ember/10 blur-[120px]"
        style={{ animationDelay: '-12s', animationDuration: '26s' }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(7,11,16,0.85)_100%)]" />
    </div>
  )
}
