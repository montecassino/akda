import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { readFile } from '@tauri-apps/plugin-fs'
import { Button } from '@/components/ui/button'
import {
  Pencil,
  Highlighter,
  Eraser,
  ZoomIn,
  ZoomOut,
  MousePointer,
  ArrowLeft,
} from 'lucide-react'
import { useRouter, useSearch } from '@tanstack/react-router'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { logger } from '@/lib/logger'
import { Spinner } from '../ui/shadcn-io/spinner'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  './pdf.worker.mjs',
  import.meta.url
).toString()

function PageWrapper({
  pageNumber,
  scale,
}: {
  pageNumber: number
  scale: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (!ref.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.isIntersecting && !isVisible) {
          setIsVisible(true)
          // Stop observing once it's visible to prevent unnecessary work
          observer.unobserve(entry.target)
        }
      },
      {
        // Generous rootMargin for pre-loading pages just outside the viewport
        rootMargin: '1000px 0px',
        threshold: 0,
      }
    )

    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [isVisible])

  const placeholderHeight = useMemo(() => Math.round(1200 * scale), [scale])

  const SkeletonPlaceholder = (
    <div
      style={{ height: placeholderHeight }}
      className="my-10 flex items-center justify-center rounded-xl bg-gray-200 relative overflow-hidden shadow-inner"
    >
      {/* Skeleton shimmer effect */}
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
          // Note: If you want nothing at all for that brief internal render, use loading={<></>}
        />
      ) : (
        // This is your lazy-load placeholder before the Page component is even mounted
        SkeletonPlaceholder
      )}
    </div>
  )
}

const MemoizedPageWrapper = React.memo(PageWrapper)

export function Editor() {
  const { originalPath } = useSearch({ from: '/editor' }) as {
    originalPath: string
  }
  const router = useRouter()

  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const [pdfData, setPdfData] = useState<ArrayBuffer | undefined>(undefined)
  const [isLoadingPdf, setIsLoadingPdf] = useState(true)

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsLoadingPdf(true)
        const bytes = await readFile(originalPath)
        setPdfData(bytes.buffer)
      } finally {
        setIsLoadingPdf(false)
      }
    }
    loadPdf()
  }, [originalPath])

  // Memoized callback for document load success
  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages)
      logger.debug('Loaded PDF with pages: ', { numPages })
      // No need to set pageNumber, as we are displaying all pages
    },
    []
  )

  // Memoized zoom handlers
  const zoomIn = useCallback(
    () => setScale(prev => Math.min(prev + 0.25, 3)),
    []
  )
  const zoomOut = useCallback(
    () => setScale(prev => Math.max(prev - 0.25, 0.5)),
    []
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === '+' || event.code === 'Equal')) {
        event.preventDefault()
        zoomIn()
      }

      if (event.ctrlKey && (event.key === '-' || event.code === 'Minus')) {
        event.preventDefault()
        zoomOut()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [zoomIn, zoomOut])

  // Tool State
  const colors = useMemo(
    () => [
      '#ff0000',
      '#ffa500',
      '#ffff00',
      '#008000',
      '#0000ff',
      '#4b0082',
      '#ee82ee',
    ],
    []
  )
  const [penColor, setPenColor] = useState<string>(colors[0] as string)
  const [highlighterColor, setHighlighterColor] = useState<string>(
    colors[2] as string
  )
  const [showPenPalette, setShowPenPalette] = useState(false)
  const [showHighlighterPalette, setShowHighlighterPalette] = useState(false)

  // Timer logic (no major perf changes needed here, just cleaner structure)
  const penHoldTimer = useRef<number | null>(null)
  const highHoldTimer = useRef<number | null>(null)
  const HOLD_DELAY = 300

  const onPenPointerDown = () => {
    if (penHoldTimer.current) window.clearTimeout(penHoldTimer.current)
    penHoldTimer.current = window.setTimeout(
      () => setShowPenPalette(true),
      HOLD_DELAY
    )
  }
  const onPenPointerUpOrLeave = () => {
    if (!showPenPalette && penHoldTimer.current) {
      window.clearTimeout(penHoldTimer.current)
      penHoldTimer.current = null
    }
  }

  const onHighPointerDown = () => {
    if (highHoldTimer.current) window.clearTimeout(highHoldTimer.current)
    highHoldTimer.current = window.setTimeout(
      () => setShowHighlighterPalette(true),
      HOLD_DELAY
    )
  }
  const onHighPointerUpOrLeave = () => {
    if (!showHighlighterPalette && highHoldTimer.current) {
      window.clearTimeout(highHoldTimer.current)
      highHoldTimer.current = null
    }
  }

  // Effect for closing palettes on outside click (No major optimization, just cleaner)
  useEffect(() => {
    if (!showPenPalette && !showHighlighterPalette) return

    function onClick(e: PointerEvent) {
      const target = e.target as HTMLElement
      // Check both palettes in one listener
      if (showPenPalette && !target.closest('[data-pen]')) {
        setShowPenPalette(false)
      }
      if (showHighlighterPalette && !target.closest('[data-highlighter]')) {
        setShowHighlighterPalette(false)
      }
    }
    // Optimization: Use a single listener for both palettes
    document.addEventListener('pointerdown', onClick)
    return () => document.removeEventListener('pointerdown', onClick)
  }, [showPenPalette, showHighlighterPalette])

  const pickPenColor = useCallback((c: string) => {
    setPenColor(c)
    setShowPenPalette(false)
  }, [])

  const pickHighColor = useCallback((c: string) => {
    setHighlighterColor(c)
    setShowHighlighterPalette(false)
  }, [])

  // Memoize the array of page numbers since it only changes on load
  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  )

  // If the entire component should wait for the PDF file to be read
  if (isLoadingPdf && !pdfData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <Spinner variant="ring" className="h-16 w-16 text-blue-500" />
          <p className="text-lg font-medium text-gray-700">Loading PDF...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background">
      <div className="sticky top-0 z-50 flex items-center justify-between border-b px-4 py-2 bg-muted/40">
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => router.history.back()}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="text-sm font-medium">
            Editing Document:{' '}
            <span className="font-semibold">{originalPath}</span>
          </h1>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline">
            Save
          </Button>
          <Button size="sm">Export</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (Tool Panel) - Memoization is less critical here */}
        <div className="relative flex flex-col items-center gap-6 bg-muted/30 p-4 border-r w-20">
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={zoomOut}
              disabled={scale <= 0.5}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="outline"
              size="icon"
              onClick={zoomIn}
              disabled={scale >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          <div className="h-px bg-border w-full my-2" />

          <div className="flex flex-col items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              aria-label="Pointer"
              title="Pointer"
            >
              <MousePointer className="h-4 w-4" />
            </Button>

            {/* Pen Palette */}
            <div className="relative" data-pen>
              <Button
                variant="outline"
                size="icon"
                onPointerDown={onPenPointerDown}
                onPointerUp={onPenPointerUpOrLeave}
                onPointerLeave={onPenPointerUpOrLeave}
                aria-label="Pen (hold to choose color)"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <span
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full border"
                style={{ backgroundColor: penColor }}
              />
              {showPenPalette && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 rounded-md p-2 shadow-lg bg-popover border">
                  {colors.map(c => (
                    <button
                      key={c}
                      className="w-6 h-6 rounded-full border"
                      style={{ backgroundColor: c }}
                      onClick={() => pickPenColor(c)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Highlighter Palette */}
            <div className="relative" data-highlighter>
              <Button
                variant="outline"
                size="icon"
                onPointerDown={onHighPointerDown}
                onPointerUp={onHighPointerUpOrLeave}
                onPointerLeave={onHighPointerUpOrLeave}
                aria-label="Highlighter (hold to choose color)"
              >
                <Highlighter className="h-4 w-4" />
              </Button>
              <span
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full border opacity-80"
                style={{ backgroundColor: highlighterColor }}
              />
              {showHighlighterPalette && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 rounded-md p-2 shadow-lg bg-popover border">
                  {colors.map(c => (
                    <button
                      key={c}
                      className="w-6 h-6 rounded-full border opacity-80"
                      style={{ backgroundColor: c }}
                      onClick={() => pickHighColor(c)}
                    />
                  ))}
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              aria-label="Eraser"
              title="Eraser"
            >
              <Eraser className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main Content Area (PDF Viewer) */}
        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div className="flex flex-col items-center">
            {/* Optimization: Document only renders once pdfData is available */}
            {pdfData && (
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Spinner variant="ring" />}
                error={<p className="text-destructive">Failed to load PDF</p>}
              >
                {pageNumbers.map(pageNum => (
                  <MemoizedPageWrapper
                    key={pageNum}
                    pageNumber={pageNum}
                    scale={scale}
                  />
                ))}
              </Document>
            )}
            {!pdfData && !isLoadingPdf && (
              <p className="text-destructive">
                Could not load document data from{' '}
                <span className="font-mono">{originalPath}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Editor
