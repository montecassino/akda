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

export interface LoadPdfResponse {
  pdf_entry: PdfEntry
  pdf_pages_dims: PdfPagesDimensions
}
