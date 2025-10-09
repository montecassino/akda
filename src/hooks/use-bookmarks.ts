import { useCallback, useState } from 'react'

export function useBookmarks() {
  const [bookmarkedPages, setBookmarkedPages] = useState<
    Record<number, boolean>
  >({})

  const isPageBookmarked = useCallback(
    (page: number) => bookmarkedPages[page] ?? false,
    [bookmarkedPages]
  )

  const toggleBookmark = useCallback(
    (page: number) => {
      setBookmarkedPages(prev => {
        return { ...prev, [page]: !isPageBookmarked(page) }
      })
    },
    [isPageBookmarked]
  )

  return {
    isPageBookmarked,
    toggleBookmark,
  }
}
