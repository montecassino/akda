import {
  BookOpen,
  FileText,
  Pencil,
  Trash2,
  Upload,
  Plus,
  X,
  FolderPlus,
  Check,
} from 'lucide-react'
import React, { useCallback, useState, useMemo } from 'react'
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
import type { PdfEntry, Collection } from '@/types/pdf' // Import Collection type
import { useFetchPdfList, useRemovePdf, useRenamePdf } from '@/services/pdf'
import {
  useFetchCollections,
  useCreateCollection,
  useRenameCollection,
  useDeleteCollection,
  useTogglePdfInCollection,
  useRemovePdfFromAllCollections,
} from '@/services/collections' // Import new hooks
import { Spinner } from '../ui/shadcn-io/spinner'
import { useNavigate } from '@tanstack/react-router'
import { Textarea } from '../ui/textarea'
import { Input } from '../ui/input'

interface FileItemProps extends PdfEntry {
  doRenamePdf: ({ id, newName }: { id: string; newName: string }) => void // id is string now
  doRemovePdf: ({ id }: { id: string }) => void // id is string now
  collections: Collection[]
  onToggleCollection: (pdfId: string, collectionId: string) => void
}

const FileItem: React.FC<FileItemProps> = ({
  id,
  file_name,
  cover_path,
  doRenamePdf,
  doRemovePdf,
  collections,
  onToggleCollection,
}) => {
  const navigate = useNavigate()
  const [isRenaming, setIsRenaming] = React.useState(false)
  const [newName, setNewName] = React.useState(file_name)
  const [isHovered, setIsHovered] = React.useState(false)
  const [showCollections, setShowCollections] = React.useState(false)

  const { mutate: removePdfFromAllCollections } =
    useRemovePdfFromAllCollections()

  const handleNavigate = () => {
    if (!isRenaming) {
      navigate({ to: `/editor/${id}`, params: { id } })
    }
  }

  const handleMouseEnter = () => setIsHovered(true)
  const handleMouseLeave = () => {
    if (!isRenaming) setShowCollections(false) // Close collections dropdown on mouse leave
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
      doRenamePdf({ id, newName })
      setIsRenaming(false)
    } catch {
      setIsRenaming(false)
      setNewName(file_name)
    }
  }

  const handleDelete = async () => {
    doRemovePdf({ id })
    removePdfFromAllCollections({ pdfId: id.toString() })
  }

  return (
    <div
      key={id}
      onClick={handleNavigate}
      className="flex flex-col flex-grow bg-card rounded-xl border border-border hover:bg-muted/40 transition-colors relative cursor-pointer"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isHovered && !isRenaming && (
        <div className="absolute left-3 top-3 flex gap-2 z-10">
          <div className="group relative">
            <Button
              size="icon"
              className="h-8 w-8 bg-background shadow-sm hover:bg-accent transition-colors cursor-pointer"
              onClick={e => {
                e.stopPropagation()
                setShowCollections(!showCollections)
              }}
            >
              <FolderPlus className="w-4 h-4 text-muted-foreground group-hover:text-green-600 transition-colors" />
            </Button>

            {showCollections && (
              <div
                className="absolute left-0 top-10 w-48 bg-background border border-border rounded-lg shadow-lg p-2 z-20"
                onClick={e => e.stopPropagation()}
              >
                <div className="text-xs font-semibold text-muted-foreground mb-2 px-2">
                  Add to collection
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {collections.length === 0 ? (
                    <div className="text-xs text-muted-foreground px-2 py-2">
                      No collections yet
                    </div>
                  ) : (
                    collections.map(collection => {
                      const isInCollection = collection.pdfIds[id]
                      return (
                        <button
                          key={collection.id}
                          onClick={e => {
                            e.stopPropagation()
                            onToggleCollection(id, collection.id)
                          }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted rounded text-sm transition-colors"
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: collection.color }}
                          />
                          <span className="flex-1 text-left truncate">
                            {collection.name}
                          </span>
                          {isInCollection && (
                            <Check className="w-4 h-4 text-green-600" />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>
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
              <Pencil className="w-4 h-4 text-muted-foreground group-hover:text-blue-600 transition-colors" />
            </Button>
          </div>
          <div className="group">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 bg-background shadow-sm transition-colors cursor-pointer"
                  onClick={e => e.stopPropagation()}
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
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
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
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
  collections,
  onToggleCollection,
}: {
  pdfList: PdfEntry[]
  isLoading: boolean
  doRenamePdf: ({ id, newName }: { id: string; newName: string }) => void
  doRemovePdf: ({ id }: { id: string }) => void
  collections: Collection[]
  onToggleCollection: (pdfId: string, collectionId: string) => void
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
            collections={collections}
            onToggleCollection={onToggleCollection}
          />
        ))}
      </div>
      {pdfList.length === 0 && (
        <div className="text-center p-10 border-2 border-dashed border-border rounded-xl mt-8 bg-muted/30">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto" />
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

const CollectionsSidebar = ({
  collections,
  selectedCollection,
  onSelectCollection,
  onAddCollection,
  onDeleteCollection,
  onRenameCollection,
  isAddingCollection,
  setIsAddingCollection,
  newCollectionName,
  setNewCollectionName,
}: {
  collections: Collection[]
  selectedCollection: string | null
  onSelectCollection: (id: string | null) => void
  onAddCollection: (name: string) => void
  onDeleteCollection: (id: string) => void
  onRenameCollection: (id: string, newName: string) => void
  isAddingCollection: boolean
  setIsAddingCollection: React.Dispatch<React.SetStateAction<boolean>>
  newCollectionName: string
  setNewCollectionName: React.Dispatch<React.SetStateAction<string>>
}) => {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const handleAddCollection = () => {
    if (newCollectionName.trim()) {
      onAddCollection(newCollectionName.trim())
      setNewCollectionName('')
      setIsAddingCollection(false)
    }
  }

  const handleRenameCollection = (id: string) => {
    if (editName.trim()) {
      onRenameCollection(id, editName.trim())
      setEditingId(null)
      setEditName('')
    }
  }

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-foreground">Collections</h3>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setIsAddingCollection(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {isAddingCollection && (
          <div className="flex gap-2 mb-2">
            <Input
              value={newCollectionName}
              onChange={e => setNewCollectionName(e.target.value)}
              placeholder="Collection name"
              className="h-8 text-sm"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddCollection()
                if (e.key === 'Escape') {
                  setIsAddingCollection(false)
                  setNewCollectionName('')
                }
              }}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleAddCollection}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => {
                setIsAddingCollection(false)
                setNewCollectionName('')
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => onSelectCollection(null)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            selectedCollection === null
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="font-medium">All Books</span>
        </button>

        <div className="mt-2 space-y-1">
          {collections.map(collection => (
            <div key={collection.id} className="group relative">
              {editingId === collection.id ? (
                <div className="flex gap-2 px-3 py-2">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-7 text-sm"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter')
                        handleRenameCollection(collection.id)
                      if (e.key === 'Escape') {
                        setEditingId(null)
                        setEditName('')
                      }
                    }}
                    onBlur={() => {
                      // Only reset if it's still in editing mode for this collection
                      if (editingId === collection.id) {
                        setEditingId(null)
                        setEditName('')
                      }
                    }}
                  />
                </div>
              ) : (
                <button
                  onClick={() => onSelectCollection(collection.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCollection === collection.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full`}
                    style={{ backgroundColor: collection.color }}
                  />
                  <span className="flex-1 text-left truncate">
                    {collection.name}
                  </span>
                  <span className="text-xs opacity-70">
                    ({Object.keys(collection.pdfIds).length})
                  </span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        setEditingId(collection.id)
                        setEditName(collection.name)
                      }}
                      className="p-1 hover:bg-background/50 rounded"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          onClick={e => e.stopPropagation()}
                          className="p-1 hover:bg-background/50 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="sm:max-w-[400px]">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Collection</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete{' '}
                            <strong>{collection.name}</strong>? This will not
                            delete the PDFs.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                            onClick={() => onDeleteCollection(collection.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const MainWindowContent = () => {
  const {
    isLoading: isPdfListLoading,
    data: pdfList = [],
    refetch: refetchPdfList,
  } = useFetchPdfList()

  const { isLoading: isCollectionsLoading, data: collections = [] } =
    useFetchCollections()

  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  )

  const [isAddingCollection, setIsAddingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState('')

  const { mutate: createCollection } = useCreateCollection()
  const { mutate: renameCollection } = useRenameCollection()
  const { mutate: deleteCollection } = useDeleteCollection({
    onSuccess: () => {
      setSelectedCollection(null)
    },
  })
  const { mutate: togglePdfInCollection } = useTogglePdfInCollection()

  const openPdfFile = useCallback(async () => {
    const filePath = await open({
      multiple: false,
      directory: false,
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    })
    if (filePath) {
      await invoke<string>('register_pdf', { pdfPath: filePath })
      refetchPdfList()
    }
  }, [refetchPdfList])

  const { mutate: renamePdf } = useRenamePdf()
  const { mutate: removePdf } = useRemovePdf()

  const doRenamePdf = useCallback(
    ({ id, newName }: { id: string; newName: string }) =>
      renamePdf({ id: parseInt(id), name: newName }), // id is number in rust, string in frontend
    [renamePdf]
  )

  const doRemovePdf = useCallback(
    ({ id }: { id: string }) => removePdf({ id: parseInt(id) }), // id is number in rust, string in frontend
    [removePdf]
  )

  const handleAddCollection = (name: string) => {
    const colors = [
      '#3b82f6', // blue-500
      '#10b981', // green-500
      '#f59e0b', // amber-500
      '#ef4444', // red-500
      '#8b5cf6', // violet-500
      '#ec4899', // pink-500
    ]
    const randomColor =
      colors[Math.floor(Math.random() * colors.length)] ?? '#ec4899'
    createCollection({ name, color: randomColor })
  }

  const handleDeleteCollection = (id: string) => {
    deleteCollection({ id })
  }

  const handleRenameCollection = (id: string, newName: string) => {
    renameCollection({ id, newName })
  }

  const handleToggleCollection = (pdfId: string, collectionId: string) => {
    togglePdfInCollection({ collectionId, pdfId: pdfId.toString() })
  }

  const filteredPdfList = useMemo(() => {
    if (selectedCollection === null) {
      return pdfList
    }
    const collection = collections.find(c => c.id === selectedCollection)
    if (!collection) return []
    return pdfList.filter(pdf => collection.pdfIds[pdf.id])
  }, [pdfList, selectedCollection, collections])

  return (
    <div className="h-full flex bg-background text-foreground font-sans antialiased">
      <CollectionsSidebar
        collections={collections}
        selectedCollection={selectedCollection}
        onSelectCollection={setSelectedCollection}
        onAddCollection={handleAddCollection}
        onDeleteCollection={handleDeleteCollection}
        onRenameCollection={handleRenameCollection}
        isAddingCollection={isAddingCollection}
        setIsAddingCollection={setIsAddingCollection}
        newCollectionName={newCollectionName}
        setNewCollectionName={setNewCollectionName}
      />

      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center">
              <BookOpen className="w-6 h-6 text-primary mr-2" />
              <h1 className="text-xl font-bold tracking-tight">Akda</h1>
            </div>
            <Button className="hidden sm:flex" onClick={openPdfFile}>
              <Upload className="w-4 h-4 mr-2" />
              Open New PDF
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 lg:px-8 py-8 md:py-12">
            <div className="w-full">
              <h2 className="text-2xl font-bold mb-6 border-b border-border pb-2">
                {selectedCollection === null
                  ? 'Your Library'
                  : collections.find(c => c.id === selectedCollection)?.name ||
                    'Collection'}
              </h2>
              <PdfListArea
                pdfList={filteredPdfList}
                isLoading={isPdfListLoading || isCollectionsLoading}
                doRenamePdf={doRenamePdf}
                doRemovePdf={doRemovePdf}
                collections={collections}
                onToggleCollection={handleToggleCollection}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default MainWindowContent
