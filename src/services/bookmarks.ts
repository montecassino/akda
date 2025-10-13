import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import type { PdfBookmark } from '@/types/pdf'

export const pdfBookmarkKeys = {
  all: ['pdf_bookmarks'] as const,
  byPdf: (pdfId: number) => [...pdfBookmarkKeys.all, pdfId] as const,
}

export function useLoadPdfBookmarks(pdfId: number) {
  return useQuery({
    queryKey: pdfBookmarkKeys.byPdf(pdfId),
    queryFn: async (): Promise<PdfBookmark[]> => {
      try {
        logger.debug('Loading pdf bookmarks from backend', { pdfId })
        const bookmarks = await invoke<PdfBookmark[]>('get_pdf_bookmarks', {
          pdfId,
        })
        logger.info('Pdf bookmarks loaded successfully', { bookmarks })
        return bookmarks
      } catch (error) {
        logger.warn('Failed to load pdf bookmarks, returning empty list', {
          error,
          pdfId,
        })
        return []
      }
    },
    gcTime: 0,
    staleTime: 0,
  })
}

export function useAddPdfBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pdfId,
      pageNumber,
      label,
    }: {
      pdfId: number
      pageNumber: number
      label: string
    }) => {
      try {
        logger.debug('Adding pdf bookmark at backend', {
          pdfId,
          pageNumber,
          label,
        })
        const updated = await invoke<PdfBookmark[]>('add_pdf_bookmark', {
          pdfId,
          pageNumber,
          label,
        })
        logger.info('Pdf bookmark added successfully', { updated })
        return updated
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to add pdf bookmark', { error, pdfId, pageNumber })
        toast.error('Failed to add bookmark', { description: message })
        throw error
      }
    },
    onSuccess: (_, { pdfId }) => {
      queryClient.invalidateQueries({
        queryKey: pdfBookmarkKeys.byPdf(pdfId),
      })
    },
  })
}

export function useUpdatePdfBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pdfId,
      pageNumber,
      label,
    }: {
      pdfId: number
      pageNumber: number
      label?: string
    }) => {
      try {
        logger.debug('Updating pdf bookmark at backend', {
          pdfId,
          pageNumber,
          label,
        })
        const updated = await invoke<PdfBookmark[]>('update_pdf_bookmark', {
          pdfId,
          pageNumber,
          label,
        })
        logger.info('Pdf bookmark updated successfully', { updated })
        return updated
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to update pdf bookmark', {
          error,
          pdfId,
          pageNumber,
        })
        toast.error('Failed to update bookmark', { description: message })
        throw error
      }
    },
    onSuccess: (_, { pdfId }) => {
      queryClient.invalidateQueries({
        queryKey: pdfBookmarkKeys.byPdf(pdfId),
      })
    },
  })
}

export function useDeletePdfBookmark() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      pdfId,
      pageNumber,
    }: {
      pdfId: number
      pageNumber: number
    }) => {
      try {
        logger.debug('Deleting pdf bookmark at backend', {
          pdfId,
          pageNumber,
        })
        const updated = await invoke<PdfBookmark[]>('delete_pdf_bookmark', {
          pdfId,
          pageNumber,
        })
        logger.info('Pdf bookmark deleted successfully', { updated })
        return updated
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to delete pdf bookmark', {
          error,
          pdfId,
          pageNumber,
        })
        toast.error('Failed to delete bookmark', { description: message })
        throw error
      }
    },
    onSuccess: (_, { pdfId }) => {
      queryClient.invalidateQueries({
        queryKey: pdfBookmarkKeys.byPdf(pdfId),
      })
    },
  })
}
