import { useState, useEffect } from "react"

export function useComparisonImageSize(count: number, containerRef: React.RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState(300)

  useEffect(() => {
    function recalculate() {
      const container = containerRef.current
      if (!container) return

      const availableW = container.clientWidth  - 24  // minus padding
      const availableH = container.clientHeight - 24

      // Aim for a roughly square grid of `count` items — estimate columns
      // as ceil(sqrt(count)), then size each item to fit that many per row
      // AND enough rows to fit vertically, whichever constraint is tighter
      const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
      const rows = Math.max(1, Math.ceil(count / cols))

      const gap = 16
      const maxByWidth  = (availableW - gap * (cols - 1)) / cols
      const maxByHeight = (availableH - gap * (rows - 1)) / rows - 30 // minus space for the text/metadata row beneath each image

      const computed = Math.max(80, Math.min(maxByWidth, maxByHeight) * 1.15)
      setSize(Math.floor(computed))
    }

    recalculate()
    window.addEventListener('resize', recalculate)
    return () => window.removeEventListener('resize', recalculate)
  }, [count, containerRef])

  return size
}