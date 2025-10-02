import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Page } from 'react-pdf'

interface Props {
  pageNumber: number
  scale: number
  onPageChange?: (pageNumber: number) => void
  pageWidth?: number // Add this prop
  pageHeight?: number // Add this prop
}

function PageWrapper({
  pageNumber,
  scale,
  onPageChange,
  pageWidth,
  pageHeight,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null)

  // Debounced page change
  const handlePageChange = useCallback(
    (pageNumber: number) => {
      if (!onPageChange) return

      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current)
      }

      debounceTimeout.current = setTimeout(() => {
        onPageChange(pageNumber)
      }, 200)
    },
    [onPageChange]
  )

  useEffect(() => {
    if (!ref.current) return

    const pageRenderObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting && !isVisible) {
          setIsVisible(true)
          pageRenderObserver.unobserve(entry.target)
        }
      },
      {
        rootMargin: '1200px 0px',
        threshold: 0,
      }
    )

    const pageNumberObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting && onPageChange) {
          handlePageChange(pageNumber)
        }
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: 0.6,
      }
    )

    pageRenderObserver.observe(ref.current)
    pageNumberObserver.observe(ref.current)

    return () => {
      pageRenderObserver.disconnect()
      pageNumberObserver.disconnect()
    }
  }, [handlePageChange, isVisible, onPageChange, pageNumber])

  // Calculate accurate placeholder height based on actual page dimensions
  const placeholderHeight = useMemo(() => {
    if (pageHeight && pageWidth) {
      // Use actual page dimensions
      return Math.round(pageHeight * scale)
    }
    // Fallback to estimated height (letter size portrait: 11/8.5 ratio)
    return Math.round(1200 * scale)
  }, [scale, pageHeight, pageWidth])

  const SkeletonPlaceholder = (
    <div
      style={{ height: placeholderHeight }}
      className="my-10 flex items-center justify-center rounded-xl bg-gray-200 relative overflow-hidden shadow-inner"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />
      <span className="z-10 text-gray-500 font-medium">
        Loading page {pageNumber}…
      </span>
    </div>
  )

  return (
    <div ref={ref}>
      {isVisible ? (
        <Page
          pageNumber={pageNumber}
          scale={scale}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          className="my-10"
          loading={
            <div
              style={{ height: placeholderHeight }}
              className="my-10 flex items-center justify-center rounded-xl bg-gray-200 relative overflow-hidden shadow-inner"
            >
              <span className="z-10 text-gray-500 font-medium">
                Rendering page {pageNumber}...
              </span>
            </div>
          }
        />
      ) : (
        SkeletonPlaceholder
      )}
    </div>
  )
}

const MemoizedPageWrapper = React.memo(PageWrapper)
export default MemoizedPageWrapper
