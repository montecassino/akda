import { BookOpenIcon, FileTextIcon, UploadIcon } from 'lucide-react'
import React, { useCallback } from 'react'
import { Button } from '../ui/button'

import { open } from '@tauri-apps/plugin-dialog'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import type { PdfEntry } from '@/types/pdf'
import { useFetchPdfList } from '@/services/pdf'
import { Spinner } from '../ui/shadcn-io/spinner'

import { useNavigate } from '@tanstack/react-router'

// interface FileData {
//   name: string
//   pages: number
//   lastOpened: string
// }

// interface FileItemProps {
//   file: FileData
// }

// const DUMMY_FILES = [
//   {
//     id: 1,
//     name: 'Project Proposal Q3 2025.pdf',
//     pages: 45,
//     lastOpened: '2 hours ago',
//   },
//   { id: 2, name: 'Gemini-API-Guide.pdf', pages: 12, lastOpened: 'Yesterday' },
//   {
//     id: 3,
//     name: 'Tax-Form-2024-Review.pdf',
//     pages: 3,
//     lastOpened: '3 days ago',
//   },
//   {
//     id: 4,
//     name: 'Research-Paper-on-Signals.pdf',
//     pages: 88,
//     lastOpened: '1 week ago',
//   },
// ]

const FileItem: React.FC<PdfEntry> = ({ id, file_name, cover_path }) => {
  const navigate = useNavigate()

  return (
    <div
      key={id}
      onClick={() => navigate({ to: '/editor/$id', params: { id } })}
      className="flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden cursor-pointer
               hover:bg-gray-50 transition-colors"
      style={{ willChange: 'transform' }} // hint GPU acceleration
    >
      {/* PDF cover thumbnail */}
      <div className="relative w-full aspect-[3/4] bg-gray-100 flex items-center justify-center">
        {cover_path ? (
          <img
            src={`${convertFileSrc(cover_path)}`}
            alt={file_name}
            loading="lazy" // important for performance
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400">
            <FileTextIcon className="w-10 h-10 mb-2" />
            <span className="text-xs">No cover</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-col flex-1 p-3">
        <p className="text-sm font-medium text-gray-800 truncate">
          {file_name}
        </p>
      </div>
    </div>
  )
}

const PdfListArea = ({
  pdfList,
  isLoading,
}: {
  pdfList: PdfEntry[]
  isLoading: boolean
}) => {
  if (isLoading) {
    return <Spinner variant="ring" />
  }
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {pdfList.map(file => (
          <FileItem key={file.id} {...file} />
        ))}
      </div>

      {pdfList.length === 0 && (
        <div className="text-center p-10 border-2 border-dashed border-gray-300 rounded-xl mt-8">
          <FileTextIcon className="w-12 h-12 text-gray-400 mx-auto" />
          <p className="mt-4 text-lg font-medium text-gray-600">
            No recent files found.
          </p>
          <p className="text-sm text-gray-500">
            Click &quot;Load a PDF Document&quot; to get started.
          </p>
        </div>
      )}
    </>
  )
}

const MainWindowContent = () => {
  const {
    isLoading,
    data: pdfList = [],
    refetch: refetchPdfList,
  } = useFetchPdfList()

  const openPdfFile = useCallback(async () => {
    const filePath = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name: 'PDF',
          extensions: ['pdf'],
        },
      ],
    })

    await invoke<string>('register_pdf', { pdfPath: filePath })
    refetchPdfList()
  }, [refetchPdfList])

  return (
    <div className="h-full flex flex-col bg-gray-50 font-sans antialiased text-gray-900">
      {/* Header stays fixed */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <BookOpenIcon className="w-6 h-6 text-blue-600 mr-2" />
            <h1 className="text-xl font-bold tracking-tight">PDF Viewer App</h1>
          </div>
          <Button className="hidden sm:flex" onClick={openPdfFile}>
            <UploadIcon className="w-4 h-4" />
            Open New PDF
          </Button>
        </div>
      </header>

      {/* Main area scrolls */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="w-full">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">
              Your Library
            </h2>

            <PdfListArea pdfList={pdfList} isLoading={isLoading} />

            <h3 className="text-xl font-semibold mt-12 mb-4 text-gray-800">
              Tips
            </h3>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                • Use the search bar (if implemented) to quickly find documents.
              </p>
              <p>
                • File paths are typically stored locally (in a real app) for
                quick re-access.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default MainWindowContent
