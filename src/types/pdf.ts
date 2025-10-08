import type { Stroke } from './editor'

export interface PdfEntry {
  id: string
  original_path: string
  file_name: string
  cover_path: string
  clone_path: string
}

export interface Dimensions {
  height: number
  width: number
}

export type PdfPagesDimensions = Record<number, Dimensions>
export type PdfStrokes = Record<number, Stroke[]>

export interface LoadPdfResponse {
  pdf_entry: PdfEntry
  pdf_pages_dims: PdfPagesDimensions
}

export interface PdfEditorSyncProps {
  id: number,
  penColor: string
  penThickness: number
  highlighterColor: string
  highlighterThickness: number
  eraserThickness: number
  currentPage: number
  scale: number
}