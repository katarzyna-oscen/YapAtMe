import { useEffect, useRef } from 'react'

const GRID = 5
const N = GRID * GRID
const CHECK = new Set([5, 11, 17, 13, 9])

const SNAKE = (() => {
  const order = []
  for (let row = 0; row < GRID; row += 1) {
    const entries = Array.from({ length: GRID }, (_value, col) => row * GRID + col)
    order.push(...(row % 2 ? [...entries].reverse() : entries))
  }
  return order
})()

function getBrightness(index, frame, mode) {
  const row = Math.floor(index / GRID)
  const col = index % GRID

  switch (mode) {
    case 'snake': {
      const pos = SNAKE.indexOf(index)
      const tail = 6
      const current = frame % N
      const diff = (pos - current + N) % N
      return diff < tail ? 1 - (diff / tail) * 0.82 : 0.12
    }
    case 'wave': {
      const phase = (col / (GRID - 1)) * Math.PI * 2 - frame * 0.22
      return (Math.sin(phase) + 1) / 2 * 0.88 + 0.12
    }
    case 'pulse': {
      const cx = (GRID - 1) / 2
      const cy = (GRID - 1) / 2
      const dist = Math.sqrt((row - cy) ** 2 + (col - cx) ** 2)
      const phase = dist * 1.1 - frame * 0.28
      return (Math.sin(phase) + 1) / 2 * 0.88 + 0.12
    }
    case 'rain': {
      const phase = (frame + col * 13) % (GRID * 4)
      const active = phase % GRID
      const diff = Math.abs(row - active)
      return diff === 0 ? 1 : diff === 1 ? 0.45 : 0.12
    }
    case 'scan': {
      const scan = frame % (GRID * 2)
      const activeRow = scan >= GRID ? GRID * 2 - 1 - scan : scan
      const diff = Math.abs(row - activeRow)
      return diff === 0 ? 1 : diff === 1 ? 0.48 : 0.12
    }
    default:
      return 0.12
  }
}

export default function DotGrid({
  mode = 'snake',
  dotPx = 5,
  gapPx = 2,
  speed = 80,
  activeRgb = '180, 195, 240',
  active = false,
}) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ frame: 0, lastTime: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const total = GRID * dotPx + (GRID - 1) * gapPx
    const dpr = window.devicePixelRatio || 1

    canvas.width = total * dpr
    canvas.height = total * dpr
    canvas.style.width = `${total}px`
    canvas.style.height = `${total}px`

    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    const drawFrame = (frame) => {
      ctx.clearRect(0, 0, total, total)

      for (let i = 0; i < N; i += 1) {
        const row = Math.floor(i / GRID)
        const col = i % GRID
        const x = col * (dotPx + gapPx) + dotPx / 2
        const y = row * (dotPx + gapPx) + dotPx / 2
        const brightness = getBrightness(i, frame, mode)

        ctx.beginPath()
        ctx.arc(x, y, dotPx / 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${activeRgb}, ${brightness})`
        ctx.fill()
      }
    }

    const drawIdle = () => {
      ctx.clearRect(0, 0, total, total)

      for (let i = 0; i < N; i += 1) {
        const row = Math.floor(i / GRID)
        const col = i % GRID
        const x = col * (dotPx + gapPx) + dotPx / 2
        const y = row * (dotPx + gapPx) + dotPx / 2
        const brightness = CHECK.has(i) ? 0.95 : 0.12

        ctx.beginPath()
        ctx.arc(x, y, dotPx / 2, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${activeRgb}, ${brightness})`
        ctx.fill()
      }
    }

    if (!active) {
      drawIdle()
      return undefined
    }

    let rafId = 0

    const draw = (timestamp) => {
      const { frame, lastTime } = stateRef.current
      if (timestamp - lastTime >= speed) {
        drawFrame(frame)

        stateRef.current = { frame: frame + 1, lastTime: timestamp }
      }

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [mode, dotPx, gapPx, speed, activeRgb, active])

  const total = GRID * dotPx + (GRID - 1) * gapPx

  return (
    <canvas
      ref={canvasRef}
      width={total}
      height={total}
      style={{ display: 'block', imageRendering: 'pixelated' }}
      aria-hidden="true"
    />
  )
}