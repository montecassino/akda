import { useState, useRef } from 'react'
import { Grid3x3, Star } from 'lucide-react'
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

export default function ThumbnailViewer() {
  const [open, setOpen] = useState(false)
  const [currentPage, setCurrentPage] = useState(3)
  const [bookmarkedPages] = useState([2, 5, 8, 12])
  const [activeTab, setActiveTab] = useState('all')
  const totalPages = 5000

  const handlePageClick = (pageNum: number) => {
    setCurrentPage(pageNum)
    setOpen(false)
  }

  const isBookmarked = (pageNum: number) => bookmarkedPages.includes(pageNum)

  const PageThumbnail = ({ pageNum }: { pageNum: number }) => (
    <button
      onClick={() => handlePageClick(pageNum)}
      className={cn(
        'group relative flex flex-col items-center gap-1.5 p-2 rounded transition-colors',
        'hover:bg-accent/50',
        currentPage === pageNum && 'bg-accent'
      )}
    >
      <div
        className={cn(
          'relative w-full aspect-[8.5/11] rounded border bg-white overflow-hidden',
          'transition-all group-hover:shadow',
          currentPage === pageNum
            ? 'border-foreground ring-1 ring-foreground'
            : 'border-border'
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted/30 to-muted/50">
          <span className="text-2xl font-semibold text-muted-foreground/40">
            {pageNum}
          </span>
        </div>

        {isBookmarked(pageNum) && (
          <div className="absolute top-1.5 right-1.5">
            <Star size={14} className="fill-yellow-500 text-yellow-500" />
          </div>
        )}
      </div>

      <span
        className={cn(
          'text-xs font-medium',
          currentPage === pageNum ? 'text-foreground' : 'text-muted-foreground'
        )}
      >
        {pageNum}
      </span>
    </button>
  )

  const VirtualizedGrid = ({ pages }: { pages: number[] }) => {
    const parentRef = useRef<HTMLDivElement>(null)

    const columnCount = 5
    const rowCount = Math.ceil(pages.length / columnCount)

    const rowVirtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 180,
      overscan: 2,
    })

    return (
      <div ref={parentRef} className="h-[calc(85vh-160px)] overflow-y-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const startIdx = virtualRow.index * columnCount
            const rowPages = pages.slice(startIdx, startIdx + columnCount)

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
                <div className="grid grid-cols-5 gap-3 px-6 py-2">
                  {rowPages.map(pageNum => (
                    <PageThumbnail key={pageNum} pageNum={pageNum} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const allPages = Array.from({ length: totalPages }, (_, i) => i + 1)

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

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="px-6 pb-3 border-b">
            <TabsList className="h-9">
              <TabsTrigger value="all" className="text-xs">
                All {totalPages}
              </TabsTrigger>
              <TabsTrigger value="bookmarks" className="text-xs">
                <Star className="h-3 w-3 mr-1 fill-yellow-500 text-yellow-500" />
                {bookmarkedPages.length}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="mt-0">
            <VirtualizedGrid pages={allPages} />
          </TabsContent>

          <TabsContent value="bookmarks" className="mt-0">
            {bookmarkedPages.length > 0 ? (
              <div className="h-[calc(85vh-160px)] overflow-y-auto px-6 py-4">
                <div className="grid grid-cols-5 gap-3">
                  {bookmarkedPages.map(pageNum => (
                    <PageThumbnail key={pageNum} pageNum={pageNum} />
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
