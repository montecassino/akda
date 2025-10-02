import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Document, pdfjs } from 'react-pdf'
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
import MemoizedPageWrapper from './Page'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  './pdf.worker.mjs',
  import.meta.url
).toString()

interface PageDimensions {
  width: number
  height: number
}

export function Editor() {
  const { originalPath } = useSearch({ from: '/editor' }) as {
    originalPath: string
  }
  const router = useRouter()

  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const [pdfData, setPdfData] = useState<ArrayBuffer | undefined>(undefined)
  const [isLoadingPdf, setIsLoadingPdf] = useState(true)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageDimensions, setPageDimensions] = useState<
    Map<number, PageDimensions>
  >(new Map())

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (pdf: any) => {
      const { numPages } = pdf
      setNumPages(numPages)
      logger.debug('Loaded PDF with pages: ', { numPages })

      // Fetch all page dimensions
      const dimensions = new Map<number, PageDimensions>()

      for (let i = 1; i <= numPages; i++) {
        try {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale: 1 })
          dimensions.set(i, {
            width: viewport.width,
            height: viewport.height,
          })
        } catch {
          logger.error(`Failed to get dimensions for page ${i}`)
        }
      }

      setPageDimensions(dimensions)
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

  // Timer logic
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

  useEffect(() => {
    if (!showPenPalette && !showHighlighterPalette) return

    function onClick(e: PointerEvent) {
      const target = e.target as HTMLElement
      if (showPenPalette && !target.closest('[data-pen]')) {
        setShowPenPalette(false)
      }
      if (showHighlighterPalette && !target.closest('[data-highlighter]')) {
        setShowHighlighterPalette(false)
      }
    }
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

  const pageNumbers = useMemo(
    () => Array.from({ length: numPages }, (_, i) => i + 1),
    [numPages]
  )

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
        <div className="relative flex flex-col items-center gap-6 bg-muted/30 p-4 border-r w-20">
          <div className="text-xs font-semibold mt-2">
            {currentPage}
            <span className="text-muted-foreground">/{numPages}</span>
          </div>

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

        <div className="flex-1 overflow-auto bg-gray-100 p-6">
          <div className="flex flex-col items-center">
            {pdfData && (
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Spinner variant="ring" />}
                error={<p className="text-destructive">Failed to load PDF</p>}
              >
                {pageNumbers.map(pageNum => {
                  const dims = pageDimensions.get(pageNum)
                  return (
                    <MemoizedPageWrapper
                      key={pageNum}
                      pageNumber={pageNum}
                      scale={scale}
                      onPageChange={setCurrentPage}
                      pageWidth={dims?.width}
                      pageHeight={dims?.height}
                    />
                  )
                })}
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
