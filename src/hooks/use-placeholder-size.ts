import { useMemo } from 'react'

export function usePlaceholderSize({
  scale,
  height,
  width,
}: {
  scale: number
  height?: number
  width?: number
}) {
  return useMemo(() => {
    if (height && width) {
      return {
        placeholderWidth: Math.round(width * scale),
        placeholderHeight: Math.round(height * scale),
      }
    }

    // fallback to US letter 8.5x11 portrait
    const fallbackHeight = Math.round(1200 * scale)
    const fallbackWidth = Math.round(((1200 * 8.5) / 11) * scale)

    return {
      placeholderWidth: fallbackWidth,
      placeholderHeight: fallbackHeight,
    }
  }, [scale, height, width])
}
