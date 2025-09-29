import { BookOpenIcon, FileTextIcon, UploadIcon } from 'lucide-react'
import React, { useCallback, useState } from 'react'
import { Button } from '../ui/button'

import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'

interface FileData {
  name: string
  pages: number
  lastOpened: string
}

interface FileItemProps {
  file: FileData
}

const DUMMY_FILES = [
  {
    id: 1,
    name: 'Project Proposal Q3 2025.pdf',
    pages: 45,
    lastOpened: '2 hours ago',
  },
  { id: 2, name: 'Gemini-API-Guide.pdf', pages: 12, lastOpened: 'Yesterday' },
  {
    id: 3,
    name: 'Tax-Form-2024-Review.pdf',
    pages: 3,
    lastOpened: '3 days ago',
  },
  {
    id: 4,
    name: 'Research-Paper-on-Signals.pdf',
    pages: 88,
    lastOpened: '1 week ago',
  },
]

const FileItem: React.FC<FileItemProps> = ({ file }) => (
  <div className="flex items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer border border-gray-200">
    <FileTextIcon className="w-6 h-6 text-blue-500 mr-4 flex-shrink-0" />
    <div className="flex-grow min-w-0">
      <p className="text-base font-semibold text-gray-800 truncate">
        {file.name}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">
        {file.pages} pages • Last opened: {file.lastOpened}
      </p>
    </div>
    <Button variant="outline" className="ml-4 flex-shrink-0">
      Open
    </Button>
  </div>
)

const MainWindowContent = () => {
  const [recentFiles] = useState(DUMMY_FILES)

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
    console.log('Try!!!!')
    const res = await invoke<string>('register_pdf', { pdfPath: filePath })

    console.log('Response: ', res)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans antialiased text-gray-900">
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
              Recently Opened Files
            </h2>

            <div className="space-y-4">
              {recentFiles.map(file => (
                <FileItem key={file.name} file={file} />
              ))}
            </div>

            {recentFiles.length === 0 && (
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
