# Patch — DotGrid Loader Component + Sidebar Placement
**Scope:** New `DotGrid` component (canvas-based, no dependencies) + sidebar header update to place it top-right, replacing the green square placeholder.

---

## Step 1 — Create DotGrid component

Create `src/components/DotGrid.jsx`:

```jsx
// src/components/DotGrid.jsx
// 5×5 canvas dot grid with CLI-style animation modes.
// Uses requestAnimationFrame with timestamp throttling — smooth and efficient.
// No external dependencies.

import { useEffect, useRef } from 'react'

const GRID = 5
const N    = GRID * GRID

// Pre-compute snake traversal order (left→right, right→left alternating rows)
const SNAKE = (() => {
  const o = []
  for (let r = 0; r < GRID; r++) {
    const row = Array.from({ length: GRID }, (_, c) => r * GRID + c)
    o.push(...(r % 2 ? [...row].reverse() : row))
  }
  return o
})()

function getBrightness(i, frame, mode) {
  const r = Math.floor(i / GRID)
  const c = i % GRID
  switch (mode) {
    case 'snake': {
      const pos  = SNAKE.indexOf(i)
      const tail = 6
      const cur  = frame % N
      const diff = (pos - cur + N) % N
      return diff < tail ? 1 - (diff / tail) * 0.82 : 0.12
    }
    case 'wave': {
      const phase = (c / (GRID - 1)) * Math.PI * 2 - frame * 0.22
      return (Math.sin(phase) + 1) / 2 * 0.88 + 0.12
    }
    case 'pulse': {
      const cx = (GRID - 1) / 2, cy = (GRID - 1) / 2
      const dist  = Math.sqrt((r - cy) ** 2 + (c - cx) ** 2)
      const phase = dist * 1.1 - frame * 0.28
      return (Math.sin(phase) + 1) / 2 * 0.88 + 0.12
    }
    case 'rain': {
      const phase     = (frame + c * 13) % (GRID * 4)
      const active    = phase % GRID
      const d         = Math.abs(r - active)
      return d === 0 ? 1 : d === 1 ? 0.45 : 0.12
    }
    case 'scan': {
      const s   = frame % (GRID * 2)
      const row = s >= GRID ? GRID * 2 - 1 - s : s
      const d   = Math.abs(r - row)
      return d === 0 ? 1 : d === 1 ? 0.48 : 0.12
    }
    default:
      return 0.12
  }
}

export default function DotGrid({
  mode  = 'snake',   // 'snake' | 'wave' | 'pulse' | 'rain' | 'scan'
  dotPx = 5,         // dot diameter in px
  gapPx = 2,         // gap between dots in px
  speed = 80,        // ms per frame
  // Active dot color — rgba string with {b} replaced by brightness value
  // Defaults to the sidebar's blue-grey text tone
  activeRgb = '180, 195, 240',
}) {
  const canvasRef = useRef(null)
  const stateRef  = useRef({ frame: 0, lastTime: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const total       = GRID * dotPx + (GRID - 1) * gapPx
    canvas.width      = total
    canvas.height     = total
    // Retina sharpness
    const dpr         = window.devicePixelRatio || 1
    canvas.width      = total * dpr
    canvas.height     = total * dpr
    canvas.style.width  = `${total}px`
    canvas.style.height = `${total}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    let rafId

    const draw = (timestamp) => {
      const { frame, lastTime } = stateRef.current
      if (timestamp - lastTime >= speed) {
        ctx.clearRect(0, 0, total, total)
        for (let i = 0; i < N; i++) {
          const row = Math.floor(i / GRID)
          const col = i % GRID
          const x   = col * (dotPx + gapPx) + dotPx / 2
          const y   = row * (dotPx + gapPx) + dotPx / 2
          const b   = getBrightness(i, frame, mode)
          ctx.beginPath()
          ctx.arc(x, y, dotPx / 2, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(${activeRgb}, ${b})`
          ctx.fill()
        }
        stateRef.current = { frame: frame + 1, lastTime: timestamp }
      }
      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [mode, dotPx, gapPx, speed, activeRgb])

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
```

---

## Step 2 — Sidebar header: add DotGrid top-right

Open `src/components/Sidebar.jsx`.

### 2a — Import DotGrid

```js
import DotGrid from './DotGrid'
```

### 2b — Update the header div

Find the sidebar header div (the one with `padding: '18px 18px 14px'`). It currently has the app name and vault name stacked vertically. Make it a flex row so the text sits left and the DotGrid sits right:

```jsx
{/* Sidebar header */}
<div style={{
  padding: '18px 18px 14px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}}>

  {/* App name + vault name */}
  <div>
    <div style={{
      fontSize: 11, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase',
      color: 'var(--text)', marginBottom: 2,
    }}>
      Memory OS
    </div>
    <div style={{
      fontSize: 12,
      color: 'var(--text-dim)',
    }}>
      {folderName || 'No vault'}
    </div>
  </div>

  {/* Dot grid loader — top right of header */}
  <DotGrid
    mode="snake"
    dotPx={5}
    gapPx={2}
    speed={90}
  />

</div>
```

The `DotGrid` at `dotPx=5, gapPx=2` produces a `5×5 + 4×2 = 33px` square — compact enough for the header without crowding the text.

---

## Build check

1. `bun run build` — passes
2. **Sidebar header** — dot grid appears top-right of the sidebar header, vertically centred with "MEMORY OS" / "Demo vault"
3. **Animation** — snake mode: bright dot travels the grid in a snake path, trailing dots fade. Smooth at ~11fps
4. **Retina** — dots are sharp on high-DPI displays (canvas scaled by `devicePixelRatio`)
5. **No layout shift** — the grid is `33×33px`, flexbox keeps the text left-aligned regardless of vault name length
6. **No memory leak** — navigating away and back cancels the animation frame correctly
