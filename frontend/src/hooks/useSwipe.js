import { useRef } from 'react'

/**
 * Hook gestur geser horizontal (touch & pointer) untuk berpindah tab/halaman.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 55 } = {}) {
  const startRef = useRef(null)

  function onTouchStart(e) {
    if (e.touches.length !== 1) return
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    startRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    }
  }

  function onTouchEnd(e) {
    if (!startRef.current || e.changedTouches.length !== 1) return
    const dx = e.changedTouches[0].clientX - startRef.current.x
    const dy = e.changedTouches[0].clientY - startRef.current.y
    const dt = Date.now() - startRef.current.time
    startRef.current = null

    if (dt > 600) return
    if (Math.abs(dx) < threshold) return
    if (Math.abs(dx) < Math.abs(dy) * 1.4) return

    if (dx < 0) onSwipeLeft?.()
    else onSwipeRight?.()
  }

  return { onTouchStart, onTouchEnd }
}

