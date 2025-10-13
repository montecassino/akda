import { useState, useRef, useMemo, useCallback } from 'react'
import { Grid3x3, Star, ImageOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import { convertFileSrc } from '@tauri-apps/api/core'
import React from 'react'

interface ThumbnailViewerProps {
  images?: string[]
  currentIndex?: number
  onPageChange?: (index: number) => void
  bookmarks?: Record<number, boolean>
  columnCount?: number
}

const PageThumbnail = React.memo(
  ({
    index,
    imagePath,
    currentIndex,
    bookmarked,
    broken,
    onClick,
    onImageError,
  }: {
    index: number
    imagePath?: string
    currentIndex: number
    bookmarked: boolean
    broken: boolean
    onClick: (index: number) => void
    onImageError: (index: number) => void
  }) => {
    const isEmpty = !imagePath || imagePath.trim() === ''

    return (
      <button
        onClick={() => onClick(index)}
        className={cn(
          'group relative flex flex-col items-center gap-1.5 p-2 rounded transition-colors',
          'hover:bg-accent/50',
          currentIndex === index && 'bg-accent'
        )}
      >
        <div
          className={cn(
            'relative w-full aspect-[8.5/11] rounded border bg-white overflow-hidden transition-all group-hover:shadow',
            currentIndex === index
              ? 'border-foreground ring-1 ring-foreground'
              : 'border-border'
          )}
        >
          {isEmpty || broken ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/30">
              <ImageOff size={32} className="text-muted-foreground/40 mb-2" />
              <span className="text-xs text-muted-foreground/60">
                {isEmpty ? 'No image' : 'Failed to load'}
              </span>
            </div>
          ) : (
            <img
              src={convertFileSrc(imagePath)}
              alt={`Page ${index + 1}`}
              className="w-full h-full object-cover"
              onError={() => onImageError(index)}
              loading="lazy"
            />
          )}
          {bookmarked && (
            <div className="absolute top-1.5 right-1.5">
              <Star size={14} className="fill-yellow-500 text-yellow-500" />
            </div>
          )}
        </div>
        <span
          className={cn(
            'text-xs font-medium',
            currentIndex === index ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          {index + 1}
        </span>
      </button>
    )
  }
)
PageThumbnail.displayName = 'PageThumbnail'

function VirtualizedGrid({
  indices,
  images,
  currentIndex,
  bookmarks,
  brokenImages,
  columnCount,
  onPageClick,
  onImageError,
}: {
  indices: number[]
  images: string[]
  currentIndex: number
  bookmarks: Record<number, boolean>
  brokenImages: Set<number>
  columnCount: number
  onPageClick: (index: number) => void
  onImageError: (index: number) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const rowCount = Math.ceil(indices.length / columnCount)

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 180, []),
    overscan: 3,
  })

  return (
    <div ref={parentRef} className="h-[calc(85vh-160px)] overflow-y-auto">
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map(virtualRow => {
          const startIdx = virtualRow.index * columnCount
          const rowIndices = indices.slice(startIdx, startIdx + columnCount)

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid gap-3 px-6 py-2"
                style={{
                  gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                }}
              >
                {rowIndices.map(idx => (
                  <PageThumbnail
                    key={idx}
                    index={idx}
                    imagePath={images[idx]}
                    currentIndex={currentIndex}
                    bookmarked={bookmarks[idx] === true}
                    broken={brokenImages.has(idx)}
                    onClick={onPageClick}
                    onImageError={onImageError}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ThumbnailViewer({
  images = [],
  currentIndex = 0,
  onPageChange,
  bookmarks = {},
  columnCount = 4,
}: ThumbnailViewerProps) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'bookmarks'>('all')
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set())

  const handlePageClick = useCallback(
    (index: number) => {
      onPageChange?.(index)
      setOpen(false)
    },
    [onPageChange]
  )

  const handleImageError = useCallback((index: number) => {
    setBrokenImages(prev => {
      const next = new Set(prev)
      next.add(index)
      return next
    })
  }, [])

  const bookmarkedIndices = useMemo(
    () =>
      Object.entries(bookmarks)
        .filter(([_, val]) => val)
        .map(([key]) => Number(parseInt(key) - 1)),
    [bookmarks]
  )

  const allIndices = useMemo(
    () => Array.from({ length: images.length }, (_, i) => i),
    [images.length]
  )

  if (images.length === 0) {
    return (
      <Button variant="outline" size="sm" className="gap-2" disabled>
        <Grid3x3 className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Grid3x3 className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle className="text-lg font-semibold">Pages</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={val => setActiveTab(val as 'all' | 'bookmarks')}
          className="w-full"
        >
          <div className="px-6 pb-3 border-b">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">
                All {images.length}
              </TabsTrigger>
              <TabsTrigger
                value="bookmarks"
                className="text-xs flex items-center"
              >
                <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                {bookmarkedIndices.length}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <VirtualizedGrid
              indices={allIndices}
              images={images}
              currentIndex={currentIndex}
              bookmarks={bookmarks}
              brokenImages={brokenImages}
              columnCount={columnCount}
              onPageClick={handlePageClick}
              onImageError={handleImageError}
            />
          </TabsContent>

          <TabsContent value="bookmarks" className="mt-0">
            {bookmarkedIndices.length > 0 ? (
              <div className="h-[calc(85vh-160px)] overflow-y-auto px-6 py-4">
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                  }}
                >
                  {bookmarkedIndices.map(idx => (
                    <PageThumbnail
                      key={idx}
                      index={idx}
                      imagePath={images[idx]}
                      currentIndex={currentIndex}
                      bookmarked
                      broken={brokenImages.has(idx)}
                      onClick={handlePageClick}
                      onImageError={handleImageError}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[calc(85vh-160px)] text-center">
                <Star className="h-10 w-10 fill-yellow-500 text-yellow-500 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">
                  No bookmarks
                </p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Star pages for quick access
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
