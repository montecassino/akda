import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/lib/logger'
import type {
  LoadPdfResponse,
  PdfEditorSyncProps,
  PdfEntry,
  PdfPagesThumbnails,
  PdfStrokes,
} from '@/types/pdf'
import { toast } from 'sonner'
import type { Stroke } from '@/types/editor'

export const pdfQueryKeys = {
  all: ['pdf'] as const,
  pdfList: () => [...pdfQueryKeys.all, 'list'] as const,
  loadPdf: (id: number) => [...pdfQueryKeys.all, id] as const,
  loadPdfStrokes: (id: number) =>
    [...pdfQueryKeys.all, 'pdf_strokes', id] as const,
  loadPdfThumbnails: (id: number) =>
    [...pdfQueryKeys.all, 'pdf_thumbnails', id] as const,
  loadEditorSettings: (id: number) => [
    ...pdfQueryKeys.all,
    'editor_settings',
    id,
  ],
}

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
    staleTime: 0,
    gcTime: 0,
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
    staleTime: 1000 * 60 * 0.25, // 30 seconds
    gcTime: 1000 * 60 * 1, // 1 minute
  })
}

export function useLoadPdfStrokes(id: number) {
  return useQuery({
    queryKey: pdfQueryKeys.loadPdfStrokes(id),
    queryFn: async (): Promise<PdfStrokes> => {
      try {
        logger.debug('Loading pdf strokes from backend')

        const response = await invoke<PdfStrokes>('load_pdf_strokes', {
          pdfId: id,
        })
        logger.info('Pdf strokes loaded successfully', { response })
        return response
      } catch (error) {
        // Return defaults if preferences file doesn't exist yet
        logger.warn('Failed to load pdf strokes, using defaults', { error })
        return {}
      }
    },
    gcTime: 0,
    staleTime: 0,
  })
}

export function useLoadPdfThumbnails(id: number) {
  return useQuery({
    queryKey: pdfQueryKeys.loadPdfThumbnails(id),
    queryFn: async (): Promise<PdfPagesThumbnails> => {
      try {
        logger.debug('Loading pdf thumbnails from backend')

        const response = await invoke<PdfPagesThumbnails>('load_thumbnails', {
          pdfId: id,
        })
        logger.info('Pdf thumbnails loaded successfully', { response })
        return response
      } catch (error) {
        // Return defaults if preferences file doesn't exist yet
        logger.warn('Failed to load pdf thumbnails, using defaults', { error })
        return {}
      }
    },
    gcTime: 0,
    staleTime: 0,
  })
}

export function useSavePdfStrokes() {
  return useMutation({
    mutationFn: async ({
      pdfId,
      pageId,
      stroke,
    }: {
      pdfId: number
      pageId: number
      stroke: Stroke
    }) => {
      try {
        logger.debug('Saving strokes to backend', { pdfId, pageId, stroke })
        await invoke('save_pdf_strokes', { pdfId, pageId, stroke })
        logger.info('Preferences saved successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to save pdf strokes', {
          error,
          pageId,
          pdfId,
          stroke,
        })
        toast.error('Failed to save pdf strokes', { description: message })
        throw error
      }
    },
  })
}

export function useRenamePdf() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      try {
        logger.debug('Renaming pdf at backend', { id, name })
        await invoke('rename_pdf', { id, name })
        logger.info('Pdf renamed successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to rename pdf', {
          error,
          id,
          name,
        })
        toast.error('Failed to rename pdf', { description: message })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pdf'] })
    },
  })
}

export function useRemovePdf() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: number }) => {
      try {
        logger.debug('Removing pdf at backend', { id })
        await invoke('remove_pdf', { id })
        logger.info('Pdf removed successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to remove pdf', { error, id })
        toast.error('Failed to remove pdf', { description: message })
        throw error
      }
    },
    onSuccess: (_, { id }) => {
      queryClient.removeQueries({ queryKey: pdfQueryKeys.loadPdf(id) })
      queryClient.removeQueries({ queryKey: pdfQueryKeys.loadPdfStrokes(id) })
      queryClient.removeQueries({
        queryKey: pdfQueryKeys.loadPdfThumbnails(id),
      })
      queryClient.removeQueries({
        queryKey: pdfQueryKeys.loadEditorSettings(id),
      })
      queryClient.invalidateQueries({ queryKey: pdfQueryKeys.pdfList() })
    },
  })
}

// 1 editor setting per pdf
export function useSaveEditorSettings() {
  return useMutation({
    mutationFn: async (props: PdfEditorSyncProps) => {
      try {
        logger.debug('Sync pdf editor settings at backend', { props })
        await invoke('save_editor_settings', { props })
        logger.info('Synced pdf editor settings')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to save editor settings', {
          error,
          id: props.id,
        })
        toast.error('Failed to save editor settings', { description: message })
        throw error
      }
    },
  })
}

export function useLoadEditorSettings(id: number) {
  return useQuery({
    queryKey: pdfQueryKeys.loadEditorSettings(id),
    queryFn: async (): Promise<PdfEditorSyncProps | null> => {
      try {
        logger.debug('Loading pdf editor settings')

        const response = await invoke<PdfEditorSyncProps>(
          'load_editor_settings',
          {
            id,
          }
        )
        logger.info('Pdf editor settings loaded successfully', { response })
        return response
      } catch (error) {
        // Return defaults if preferences file doesn't exist yet
        logger.warn('Failed to load pdf editor settings, using defaults', {
          error,
        })
        return null
      }
    },
    staleTime: 0,
    gcTime: 0,
  })
}
