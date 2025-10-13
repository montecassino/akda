import { useCallback, useEffect, useState } from 'react'
import {
  useLoadPdfBookmarks,
  useAddPdfBookmark,
  useDeletePdfBookmark,
  useUpdatePdfBookmark,
} from '@/services/bookmarks'

import { logger } from '@/lib/logger'

export function useBookmarks(pdfId: number) {
  const [bookmarkedPages, setBookmarkedPages] = useState<
    Record<number, boolean>
  >({})

  const { data: bookmarks = [], refetch } = useLoadPdfBookmarks(pdfId)
  const addBookmark = useAddPdfBookmark()
  const deleteBookmark = useDeletePdfBookmark()
  const updateBookmark = useUpdatePdfBookmark()

  useEffect(() => {
    if (bookmarks.length > 0) {
      const map: Record<number, boolean> = {}
      for (const b of bookmarks) {
        map[b.page_number] = true
      }
      setBookmarkedPages(map)
    } else {
      setBookmarkedPages({})
    }
  }, [bookmarks])

  const isPageBookmarked = useCallback(
    (page: number) => bookmarkedPages[page] ?? false,
    [bookmarkedPages]
  )

  const toggleBookmark = useCallback(
    async (page: number, label?: string) => {
      const currentlyBookmarked = isPageBookmarked(page)
      setBookmarkedPages(prev => ({ ...prev, [page]: !currentlyBookmarked }))

      try {
        if (currentlyBookmarked) {
          logger.debug('Removing bookmark from page', { pdfId, page })
          await deleteBookmark.mutateAsync({ pdfId, pageNumber: page })
        } else {
          logger.debug('Adding bookmark to page', { pdfId, page })
          await addBookmark.mutateAsync({
            pdfId,
            pageNumber: page,
            label: label ?? `Page ${page}`,
          })
        }

        await refetch()
      } catch (error) {
        logger.error('Failed to toggle bookmark, reverting UI', {
          error,
          pdfId,
          page,
        })
        setBookmarkedPages(prev => ({ ...prev, [page]: currentlyBookmarked }))
      }
    },
    [isPageBookmarked, pdfId, addBookmark, deleteBookmark, refetch]
  )

  const renameBookmark = useCallback(
    async (page: number, newLabel: string) => {
      try {
        logger.debug('Renaming bookmark', { pdfId, page, newLabel })
        await updateBookmark.mutateAsync({
          pdfId,
          pageNumber: page,
          label: newLabel,
        })
        await refetch()
      } catch (error) {
        logger.error('Failed to rename bookmark', { error, pdfId, page })
      }
    },
    [pdfId, updateBookmark, refetch]
  )

  return {
    isPageBookmarked,
    toggleBookmark,
    renameBookmark,
    bookmarkedPages,
  }
}
