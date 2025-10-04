export interface Point {
  x: number
  y: number
}

export type ToolType = 'pointer' | 'pen' | 'highlighter' | 'eraser'

export type DrawingToolType = Exclude<ToolType, 'pointer'>

export interface Stroke {
  tool: DrawingToolType
  color: string
  opacity: number
  thickness: number // px
  path: { x: number; y: number }[]
}
