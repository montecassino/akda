import { useQuery } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/lib/logger'
import type { PdfEntry } from '@/types/pdf'

// Query keys for preferences
export const pdfQueryKeys = {
  all: ['pdf'] as const,
  pdfList: () => [...pdfQueryKeys.all, 'list'] as const,
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
