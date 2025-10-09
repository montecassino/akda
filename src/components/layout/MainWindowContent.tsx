import {
  BookOpenIcon,
  FileText,
  FileTextIcon,
  Pencil,
  Trash2,
  UploadIcon,
} from 'lucide-react'
import React, { useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog'

import { open } from '@tauri-apps/plugin-dialog'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import type { PdfEntry } from '@/types/pdf'
import { useFetchPdfList, useRemovePdf, useRenamePdf } from '@/services/pdf'
import { Spinner } from '../ui/shadcn-io/spinner'

import { useNavigate } from '@tanstack/react-router'
import { Textarea } from '../ui/textarea'

interface FileItemProps extends PdfEntry {
  doRenamePdf: ({ id, newName }: { id: number; newName: string }) => void
  doRemovePdf: ({ id }: { id: number }) => void
}

const FileItem: React.FC<FileItemProps> = ({
  id,
  file_name,
  cover_path,
  doRenamePdf,
  doRemovePdf,
}) => {
  const navigate = useNavigate()
  const [isRenaming, setIsRenaming] = React.useState(false)
  const [newName, setNewName] = React.useState(file_name)
  const [isHovered, setIsHovered] = React.useState(false)

  const handleNavigate = () => {
    if (!isRenaming) {
      navigate({ to: `/editor/${id}`, params: { id } })
    }
  }

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    if (!isRenaming) setIsHovered(false)
  }

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || newName === file_name) {
      setIsRenaming(false)
      setNewName(file_name)
      return
    }

    try {
      doRenamePdf({ id: parseInt(id), newName })
      setIsRenaming(false)
    } catch {
      setIsRenaming(false)
      setNewName(file_name)
    }
  }

  const handleDelete = async () => {
    doRemovePdf({ id: parseInt(id) })
  }

  return (
    <div
      key={id}
      onClick={handleNavigate}
      className="flex flex-col flex-grow bg-card rounded-xl border border-border hover:bg-muted/40 transition-colors relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isHovered && !isRenaming && (
        <div className="absolute left-3 top-3 flex gap-2 z-10">
          {/* Rename (keeps group so group-hover works) */}
          <div className="group">
            <Button
              size="icon"
              className="h-8 w-8 bg-background shadow-sm hover:bg-accent transition-colors cursor-pointer"
              onClick={e => {
                e.stopPropagation()
                setIsRenaming(true)
                setIsHovered(false)
              }}
            >
              {/* explicit blue on hover */}
              <Pencil className="w-4 h-4 text-gray-600 group-hover:text-blue-600 transition-colors" />
            </Button>
          </div>

          {/* Delete (group + explicit red hover) */}
          <div className="group">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-background shadow-sm transition-colors cursor-pointer"
                  onClick={e => e.stopPropagation()}
                >
                  {/* explicit red on hover */}
                  <Trash2 className="w-4 h-4 text-gray-600 group-hover:text-red-500 transition-colors" />
                </Button>
              </AlertDialogTrigger>

              <AlertDialogContent
                onClick={e => e.stopPropagation()}
                className="sm:max-w-[400px]"
              >
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete PDF</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete <strong>{file_name}</strong>
                    ? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700 text-white"
                    onClick={() => handleDelete()}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}

      <div className="relative w-full aspect-[3/4] bg-muted flex items-center justify-center rounded-t-xl overflow-hidden">
        {cover_path ? (
          <img
            src={convertFileSrc(cover_path)}
            alt={file_name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-muted-foreground">
            <FileText className="w-10 h-10 mb-2" />
            <span className="text-xs">No cover</span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-3 relative">
        {isRenaming ? (
          <form onSubmit={handleRename}>
            <Textarea
              value={newName}
              onChange={e => setNewName(e.target.value)}
              autoFocus
              className="text-sm font-medium w-full text-foreground"
              onBlur={() => {
                setIsRenaming(false)
                setNewName(file_name)
              }}
              onKeyDown={e => {
                if (e.key === 'Escape') {
                  setIsRenaming(false)
                  setNewName(file_name)
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleRename(e as unknown as React.FormEvent)
                }
              }}
            />
          </form>
        ) : (
          <p
            className="text-sm font-medium truncate text-foreground"
            onClick={e => e.stopPropagation()}
          >
            {file_name}
          </p>
        )}
      </div>
    </div>
  )
}

const PdfListArea = ({
  pdfList,
  isLoading,
  doRenamePdf,
  doRemovePdf,
}: {
  pdfList: PdfEntry[]
  isLoading: boolean
  doRenamePdf: ({ id, newName }: { id: number; newName: string }) => void
  doRemovePdf: ({ id }: { id: number }) => void
}) => {
  if (isLoading) return <Spinner variant="ring" />

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
        {pdfList.map(file => (
          <FileItem
            key={file.id}
            {...file}
            doRenamePdf={doRenamePdf}
            doRemovePdf={doRemovePdf}
          />
        ))}
      </div>

      {pdfList.length === 0 && (
        <div className="text-center p-10 border-2 border-dashed border-border rounded-xl mt-8 bg-muted/30">
          <FileTextIcon className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="mt-4 text-lg font-medium text-foreground">
            No recent files found.
          </p>
          <p className="text-sm text-muted-foreground">
            Click &quot;Open New PDF&quot; to get started.
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
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })

    await invoke<string>('register_pdf', { pdfPath: filePath })
    refetchPdfList()
  }, [refetchPdfList])

  const { mutate: renamePdf } = useRenamePdf()
  const { mutate: removePdf } = useRemovePdf()

  const doRenamePdf = useCallback(
    ({ id, newName }: { id: number; newName: string }) =>
      renamePdf({ id, name: newName }),
    [renamePdf]
  )

  const doRemovePdf = useCallback(
    ({ id }: { id: number }) => removePdf({ id }),
    [removePdf]
  )

  return (
    <div className="h-full flex flex-col bg-background text-foreground font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <BookOpenIcon className="w-6 h-6 text-primary mr-2" />
            <h1 className="text-xl font-bold tracking-tight">PDF Viewer App</h1>
          </div>
          <Button className="hidden sm:flex" onClick={openPdfFile}>
            <UploadIcon className="w-4 h-4 mr-2" />
            Open New PDF
          </Button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="w-full">
            <h2 className="text-2xl font-bold mb-6 border-b border-border pb-2">
              Your Library
            </h2>

            <PdfListArea
              pdfList={pdfList}
              isLoading={isLoading}
              doRenamePdf={doRenamePdf}
              doRemovePdf={doRemovePdf}
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default MainWindowContent
