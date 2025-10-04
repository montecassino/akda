import type { Stroke, DrawingToolType, Point } from '@/types/editor'

export class StrokeBuilder {
  private stroke: Stroke

  constructor(tool: DrawingToolType) {
    if (tool === 'eraser') {
      this.stroke = {
        tool,
        color: '#000000',
        opacity: 1.0,
        thickness: 20,
        path: [],
      }
    } else if (tool === 'highlighter') {
      this.stroke = {
        tool,
        color: '#ffff00',
        opacity: 0.3,
        thickness: 20,
        path: [],
      }
    } else {
      this.stroke = {
        tool,
        color: '#000000',
        opacity: 1.0,
        thickness: 1,
        path: [],
      }
    }
  }

  setColor(color: string): this {
    this.stroke.color = color
    return this
  }

  setOpacity(opacity: number): this {
    this.stroke.opacity = opacity
    return this
  }

  setThickness(thickness: number): this {
    this.stroke.thickness = thickness
    return this
  }

  addPoint(x: number, y: number): this {
    this.stroke.path.push({ x, y })
    return this
  }

  addPoints(points: Point[]): this {
    this.stroke.path.push(...points)
    return this
  }

  build(): Stroke {
    return { ...this.stroke, path: [...this.stroke.path] }
  }
}
