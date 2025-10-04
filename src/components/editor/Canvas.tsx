import { usePlaceholderSize } from '@/hooks/use-placeholder-size'
import { StrokeBuilder } from '@/lib/editor'
import type { Stroke, ToolType } from '@/types/editor'
import React from 'react'
import { useRef, useState, useEffect } from 'react'

interface Props {
  id: number
  tool: ToolType
  scale?: number
  height?: number
  width?: number
  strokes: Stroke[]
  setStrokes: React.Dispatch<React.SetStateAction<Record<number, Stroke[]>>>
}

function Canvas({
  id,
  tool = 'pointer',
  scale = 1.0,
  height = 400,
  width = 300,
  strokes,
  setStrokes,
}: Props) {
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null) // background (all committed strokes)
  const liveCanvasRef = useRef<HTMLCanvasElement | null>(null) // overlay (live stroke)
  const strokeBuilderRef = useRef<StrokeBuilder | null>(null)

  const [isDrawing, setIsDrawing] = useState(false)

  const { placeholderWidth, placeholderHeight } = usePlaceholderSize({
    scale,
    height,
    width,
  })

  // redraw committed strokes when scale or strokes change
  useEffect(() => {
    const canvas = baseCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    strokes.forEach(stroke => {
      ctx.globalAlpha = stroke.opacity
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.miterLimit = 1
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.thickness * scale

      if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
      } else {
        ctx.globalCompositeOperation = 'source-over'
      }

      ctx.beginPath()
      stroke.path.forEach((p, i) => {
        const x = p.x * scale
        const y = p.y * scale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    })

    ctx.globalAlpha = 1.0
  }, [scale, strokes, placeholderWidth, placeholderHeight])

  const getPos = (e: React.MouseEvent<HTMLCanvasElement, MouseEvent>) => {
    const rect = liveCanvasRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    }
  }

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'pointer') return
    const pos = getPos(e)

    strokeBuilderRef.current = new StrokeBuilder(tool)
    strokeBuilderRef.current.addPoint(pos.x, pos.y)

    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === 'pointer' || !isDrawing) return
    const pos = getPos(e)
    strokeBuilderRef.current?.addPoint(pos.x, pos.y)

    const stroke = strokeBuilderRef.current?.build()
    if (!stroke) return

    if (tool === 'eraser') {
      // erase directly whats on the base canvas
      const baseCanvas = baseCanvasRef.current
      if (!baseCanvas) return
      const ctx = baseCanvas.getContext('2d')
      if (!ctx) return

      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.lineWidth = stroke.thickness * scale

      ctx.beginPath()
      stroke.path.forEach((p, i) => {
        const x = p.x * scale
        const y = p.y * scale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      const liveCanvas = liveCanvasRef.current
      if (!liveCanvas) return
      const ctx = liveCanvas.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, liveCanvas.width, liveCanvas.height)

      ctx.globalAlpha = stroke.opacity
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.thickness * scale
      ctx.globalCompositeOperation = 'source-over'

      ctx.beginPath()
      stroke.path.forEach((p, i) => {
        const x = p.x * scale
        const y = p.y * scale
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.globalAlpha = 1.0
    }
  }

  const stopDrawing = () => {
    if (tool === 'pointer') return
    const stroke = strokeBuilderRef.current?.build()
    if (isDrawing && stroke && stroke.path.length > 0) {
      setStrokes(prev => {
        const prevPageStrokes = prev[id] ?? []
        return {
          ...prev,
          [id]: [...prevPageStrokes, stroke],
        }
      })
    }

    const liveCanvas = liveCanvasRef.current
    if (liveCanvas) {
      const ctx = liveCanvas.getContext('2d')
      ctx?.clearRect(0, 0, liveCanvas.width, liveCanvas.height)
    }

    setIsDrawing(false)
    strokeBuilderRef.current = null
  }

  return (
    <div
      style={{
        position: 'relative',
        width: placeholderWidth,
        height: placeholderHeight,
      }}
    >
      <canvas
        ref={baseCanvasRef}
        width={placeholderWidth}
        height={placeholderHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
      />
      <canvas
        ref={liveCanvasRef}
        width={placeholderWidth}
        height={placeholderHeight}
        style={{ position: 'absolute', top: 0, left: 0 }}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  )
}

// memoizing won't hurt but can't prevent re-render if stroke changes.
export const MemoizedCanvas = React.memo(Canvas)
