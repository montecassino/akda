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
import { useParams, useRouter } from '@tanstack/react-router'
import { useVirtualizer } from '@tanstack/react-virtual'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

import { logger } from '@/lib/logger'
import { Spinner } from '../ui/shadcn-io/spinner'
import MemoizedPageWrapper from './Page'
import {
  useLoadPdf,
  useLoadPdfStrokes,
  useSavePdfStrokes,
} from '@/services/pdf'
import type { PdfPagesDimensions } from '@/types/pdf'
import { MemoizedCanvas } from './Canvas'
import type { Stroke, ToolType } from '@/types/editor'
import { cn } from '@/lib/utils'
import { useEditorSync } from '@/hooks/use-editor-sync'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  './pdf.worker.mjs',
  import.meta.url
).toString()

export function Editor() {
  const { id: pdfId } = useParams({ from: '/editor/$id' })
  const { isLoading: isLoadingPdf, data: pdfInformation } = useLoadPdf(
    parseInt(pdfId)
  )
  const { data: _strokes = {} } = useLoadPdfStrokes(parseInt(pdfId))

  const { mutate: mutateSavePdfStrokes } = useSavePdfStrokes()

  const router = useRouter()

  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.0)
  const [pdfData, setPdfData] = useState<ArrayBuffer | undefined>(undefined)
  const [jumpPage, setJumpPage] = useState<string>('')

  const [currentTool, setCurrentTool] = useState<ToolType>('pointer')

  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageDimensions, setPageDimensions] = useState<PdfPagesDimensions>({})

  const [strokes, setStrokes] = useState<Record<number, Stroke[]>>({})

  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => parentRef.current,
    estimateSize: index => {
      const dims = pageDimensions[index + 1]
      const GAP = 24 // gap between pages in pixels
      return (dims?.height ?? 800) * scale + GAP
    },
    overscan: 2,
  })

  // recalc according to scale factor
  useEffect(() => {
    rowVirtualizer.measure()
  }, [scale, pageDimensions, rowVirtualizer])

  useEffect(() => {
    setStrokes(_strokes)
  }, [_strokes])

  useEffect(() => {
    const loadPdf = async () => {
      if (pdfInformation) {
        try {
          const bytes = await readFile(pdfInformation.pdf_entry.clone_path)
          setPdfData(bytes.buffer)
          setPageDimensions(pdfInformation.pdf_pages_dims)
        } catch {
          logger.error('Error in loading pdf information')
        }
      }
    }

    loadPdf()
  }, [pdfInformation])

  const onDocumentLoadSuccess = useCallback(
    async ({ numPages }: { numPages: number }) => {
      setNumPages(numPages)
      logger.debug('Loaded PDF with pages: ', { numPages })
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

  const handleJumpToPage = useCallback(() => {
    const pageNum = parseInt(jumpPage)
    if (!pageNum || pageNum < 1 || pageNum > numPages) return

    rowVirtualizer.scrollToIndex(pageNum - 1, { align: 'start' })
    setJumpPage('')
  }, [jumpPage, numPages, rowVirtualizer])

  const savePdfStrokes = useCallback(
    ({ newStroke, pageId }: { newStroke: Stroke; pageId: number }) => {
      setStrokes(prev => {
        const prevPageStrokes = prev[pageId] ?? []
        return {
          ...prev,
          [pageId]: [...prevPageStrokes, newStroke],
        }
      })

      mutateSavePdfStrokes({
        pdfId: parseInt(pdfId),
        pageId: pageId,
        stroke: newStroke,
      })
    },
    [mutateSavePdfStrokes, pdfId]
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

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault()
        if (event.deltaY < 0) {
          zoomIn()
        } else if (event.deltaY > 0) {
          zoomOut()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('wheel', handleWheel)
    }
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
  const [showEraserThickness, setShowEraserThickness] = useState(false)

  const [penThickness, setPenThickness] = useState<number>(2)
  const [highlighterThickness, setHighlighterThickness] = useState<number>(12)
  const [eraserThickness, setEraserThickness] = useState<number>(12)

  const thicknessOptions = useMemo(() => [1, 2, 4, 8, 12, 20], [])

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

  const onEraserPointerDown = () => {
    if (highHoldTimer.current) window.clearTimeout(highHoldTimer.current)
    highHoldTimer.current = window.setTimeout(
      () => setShowEraserThickness(true),
      HOLD_DELAY
    )
  }
  const onEraserPointerUpOrLeave = () => {
    if (!showHighlighterPalette && highHoldTimer.current) {
      window.clearTimeout(highHoldTimer.current)
      highHoldTimer.current = null
    }
  }

  useEffect(() => {
    if (!showPenPalette && !showHighlighterPalette && !showEraserThickness)
      return

    function onClick(e: PointerEvent) {
      const target = e.target as HTMLElement
      if (showPenPalette && !target.closest('[data-pen]')) {
        setShowPenPalette(false)
      }
      if (showHighlighterPalette && !target.closest('[data-highlighter]')) {
        setShowHighlighterPalette(false)
      }

      if (showEraserThickness && !target.closest('[data-eraser]')) {
        setShowEraserThickness(false)
      }
    }
    document.addEventListener('pointerdown', onClick)
    return () => document.removeEventListener('pointerdown', onClick)
  }, [showPenPalette, showHighlighterPalette, showEraserThickness])

  useEditorSync({
    id: parseInt(pdfId),
    penColor,
    penThickness,
    highlighterColor,
    highlighterThickness,
    eraserThickness,
    currentPage,
    scale,
  })

  const pickPenColor = useCallback((c: string) => {
    setPenColor(c)
    setShowPenPalette(false)
  }, [])

  const pickHighColor = useCallback((c: string) => {
    setHighlighterColor(c)
    setShowHighlighterPalette(false)
  }, [])

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
    <div className="flex flex-col h-full w-full bg-background">
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
            <span className="font-semibold">
              {pdfInformation?.pdf_entry.file_name}
            </span>
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
              variant={currentTool === 'pointer' ? 'default' : 'outline'}
              size="icon"
              aria-label="Pointer"
              title="Pointer"
              onClick={() => setCurrentTool('pointer')}
            >
              <MousePointer className="h-4 w-4" />
            </Button>

            <div className="relative" data-pen>
              <Button
                variant={currentTool === 'pen' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setCurrentTool('pen')}
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
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 rounded-md p-2 shadow-lg bg-popover border">
                  <div className="flex items-center gap-2">
                    {thicknessOptions.map(t => (
                      <button
                        key={t}
                        className={cn(
                          'flex items-center justify-center border rounded-full',
                          penThickness === t &&
                            'border-blue-500 ring-2 ring-blue-300'
                        )}
                        style={{ width: 28, height: 28 }}
                        onClick={() => setPenThickness(t)}
                      >
                        <div
                          className="rounded-full bg-black"
                          style={{ width: t, height: t }}
                        />
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    {colors.map(c => (
                      <button
                        key={c}
                        className="w-6 h-6 rounded-full border"
                        style={{ backgroundColor: c }}
                        onClick={() => pickPenColor(c)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" data-highlighter>
              <Button
                variant={currentTool === 'highlighter' ? 'default' : 'outline'}
                size="icon"
                onClick={() => setCurrentTool('highlighter')}
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
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 rounded-md p-2 shadow-lg bg-popover border">
                  <div className="flex items-center gap-2">
                    {thicknessOptions.map(t => (
                      <button
                        key={t}
                        className={cn(
                          'flex items-center justify-center border rounded-full',
                          highlighterThickness === t &&
                            'border-blue-500 ring-2 ring-blue-300'
                        )}
                        style={{ width: 28, height: 28 }}
                        onClick={() => setHighlighterThickness(t)}
                      >
                        <div
                          className="rounded-full bg-black"
                          style={{ width: t, height: t }}
                        />
                      </button>
                    ))}
                  </div>

                  {/* Color options BELOW */}
                  <div className="flex items-center gap-2">
                    {colors.map(c => (
                      <button
                        key={c}
                        className="w-6 h-6 rounded-full border opacity-80"
                        style={{ backgroundColor: c }}
                        onClick={() => pickHighColor(c)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative" data-eraser>
              <Button
                variant={currentTool === 'eraser' ? 'default' : 'outline'}
                size="icon"
                aria-label="Eraser"
                title="Eraser"
                onClick={() => setCurrentTool('eraser')}
                onPointerDown={onEraserPointerDown}
                onPointerUp={onEraserPointerUpOrLeave}
                onPointerLeave={onEraserPointerUpOrLeave}
                onContextMenu={e => {
                  e.preventDefault()
                  setShowEraserThickness(prev => !prev)
                }}
              >
                <Eraser className="h-4 w-4" />
              </Button>

              {showEraserThickness && (
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3 rounded-md p-2 shadow-lg bg-popover border">
                  <div className="flex items-center gap-2">
                    {thicknessOptions.map(t => (
                      <button
                        key={t}
                        className={cn(
                          'flex items-center justify-center border rounded-full',
                          eraserThickness === t &&
                            'border-blue-500 ring-2 ring-blue-300'
                        )}
                        style={{ width: 28, height: 28 }}
                        onClick={() => setEraserThickness(t)}
                      >
                        <div
                          className="rounded-full bg-gray-400"
                          style={{ width: t, height: t }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100 py-10" ref={parentRef}>
          <div className="flex flex-col items-center">
            {pdfData && (
              <Document
                file={pdfData}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<Spinner variant="ring" />}
                error={<p className="text-destructive">Failed to load PDF</p>}
              >
                <div
                  style={{
                    height: rowVirtualizer.getTotalSize(),
                    position: 'relative',
                    width: '100%',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map(virtualRow => {
                    const pageNum = virtualRow.index + 1
                    const dims = pageDimensions[pageNum]
                    const s = strokes[pageNum] ?? []

                    return (
                      <div
                        key={pageNum}
                        ref={rowVirtualizer.measureElement}
                        data-index={virtualRow.index}
                        style={{
                          position: 'absolute',
                          left: '50%',
                          transform: `translate(-50%, ${virtualRow.start}px)`,
                          height: `${virtualRow.size}px`,
                        }}
                      >
                        <div className="relative">
                          <div className="absolute inset-0 z-10">
                            <MemoizedCanvas
                              id={pageNum}
                              tool={currentTool}
                              savePdfStrokes={savePdfStrokes}
                              strokes={s}
                              scale={scale}
                              height={dims?.height}
                              width={dims?.width}
                              penColor={penColor}
                              highlighterColor={highlighterColor}
                              penThickness={penThickness}
                              highlighterThickness={highlighterThickness}
                              eraserThickness={eraserThickness}
                            />
                          </div>

                          <MemoizedPageWrapper
                            pageNumber={pageNum}
                            scale={scale}
                            onPageChange={setCurrentPage}
                            pageWidth={dims?.width}
                            pageHeight={dims?.height}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Document>
            )}

            {!pdfInformation && !pdfData && !isLoadingPdf && (
              <p className="text-destructive">Could not load document data</p>
            )}
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 z-50 flex flex-col items-center justify-center w-full border-t bg-background/80 backdrop-blur-md py-3">
        <div className="flex items-center justify-center gap-4">
          <span className="text-sm font-semibold tracking-tight">
            {currentPage}
            <span className="text-muted-foreground font-normal">
              {' '}
              / {numPages}
            </span>
          </span>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-muted/40 shadow-sm hover:bg-muted/60 transition">
            <input
              type="number"
              min={1}
              max={numPages}
              value={jumpPage}
              onChange={e => setJumpPage(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleJumpToPage()
              }}
              className="w-12 text-center text-sm bg-transparent focus:outline-none focus:ring-0 appearance-none"
              placeholder="Pg"
            />
            <Button
              variant="secondary"
              size="sm"
              className="h-7 px-3 text-xs rounded-full shadow-sm"
              onClick={handleJumpToPage}
              disabled={!jumpPage}
            >
              Jump
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Editor
