import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/lib/logger'
import type { LoadPdfResponse, PdfEntry } from '@/types/pdf'

// Query keys for preferences
export const pdfQueryKeys = {
  all: ['pdf'] as const,
  pdfList: () => [...pdfQueryKeys.all, 'list'] as const,
  loadPdf: (id: number) => [...pdfQueryKeys.all, id] as const,
}

// TanStack Query hooks following the architectural patterns
export function useFetchPdfList() {
  return useQuery({
    queryKey: pdfQueryKeys.pdfList(),
    queryFn: async (): Promise<PdfEntry[]> => {
      try {
        logger.debug('Loading pdf list from backend')
        const list = await invoke<PdfEntry[]>('list_pdf')
        logger.info('Pdf list loaded successfully', { list })
        return list
      } catch (error) {
        // Return defaults if preferences file doesn't exist yet
        logger.warn('Failed to pdf list, using defaults', { error })
        return []
      }
    },
    staleTime: 1000 * 60 * 1, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  })
}

export function useLoadPdf(id: number) {
  return useQuery({
    queryKey: pdfQueryKeys.loadPdf(id),
    queryFn: async (): Promise<LoadPdfResponse | null> => {
      try {
        logger.debug('Loading pdf information from backend')
        const response = await invoke<LoadPdfResponse>('load_pdf', { id })
        logger.info('Pdf list loaded successfully', { response })
        return response
      } catch (error) {
        // Return defaults if preferences file doesn't exist yet
        logger.warn('Failed to load pdf information, using defaults', { error })
        return null
      }
    },
    staleTime: 1000 * 60 * 0.5, // 30 seconds
    gcTime: 1000 * 60 * 1, // 1 minute
  })
}
