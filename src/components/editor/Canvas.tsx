import { usePlaceholderSize } from '@/hooks/use-placeholder-size'
import type { Stroke } from '@/types/editor'
import React from 'react'
import { useRef, useState, useEffect } from 'react'

function Canvas({
  id,
  scale = 1.0,
  height = 400,
  width = 300,
  strokes,
  setStrokes,
}: {
  id: number
  scale?: number
  height?: number
  width?: number
  strokes: Stroke[]
  setStrokes: React.Dispatch<React.SetStateAction<Record<number, Stroke[]>>>
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const [isDrawing, setIsDrawing] = useState(false)

  const currentStroke = useRef<Stroke>([])

  const { placeholderWidth, placeholderHeight } = usePlaceholderSize({
    scale,
    height,
    width,
  })

  // redraw when scale changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.miterLimit = 1
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 2 * scale

    strokes.forEach(stroke => {
      ctx.beginPath()
      stroke.forEach((p, i) => {
        const x = p.x * scale
        const y = p.y * scale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })
  }, [scale, strokes, placeholderWidth, placeholderHeight])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getPos(e)
    currentStroke.current = [pos]
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const pos = getPos(e)
    currentStroke.current.push(pos)

    // draw live stroke
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.miterLimit = 1
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 2 * scale

    ctx.beginPath()
    const stroke = currentStroke.current
    stroke.forEach((p, i) => {
      const x = p.x * scale
      const y = p.y * scale
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
  }

  const stopDrawing = () => {
    if (isDrawing && currentStroke.current.length > 0) {
      setStrokes(prev => {
        const prevPageStrokes = prev[id] ?? []
        return {
          ...prev,
          [id]: [...prevPageStrokes, currentStroke.current],
        }
      })
    }
    setIsDrawing(false)
    currentStroke.current = []
  }

  return (
    <canvas
      ref={canvasRef}
      width={placeholderWidth}
      height={placeholderHeight}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
    />
  )
}

// memoizing won't hurt but can't prevent re-render if stroke changes.
export const MemoizedCanvas = React.memo(Canvas)
