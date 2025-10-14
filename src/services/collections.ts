import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoke } from '@tauri-apps/api/core'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'
import type { Collection } from '@/types/pdf'

export function useFetchCollections() {
  return useQuery<Collection[], Error>({
    queryKey: ['collections'],
    queryFn: async () => {
      try {
        logger.debug('Fetching collections from backend')
        const result = await invoke<Collection[]>('get_collections')
        logger.info('Collections fetched successfully')
        return result
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to fetch collections', { error })
        toast.error('Failed to fetch collections', { description: message })
        throw error
      }
    },
  })
}

export function useCreateCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      try {
        logger.debug('Creating collection at backend', { name, color })
        const result = await invoke<Collection>('create_collection', {
          name,
          color,
        })
        logger.info('Collection created successfully')
        return result
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to create collection', { error, name, color })
        toast.error('Failed to create collection', { description: message })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useRenameCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, newName }: { id: string; newName: string }) => {
      try {
        logger.debug('Renaming collection at backend', { id, newName })
        await invoke('rename_collection', { id, newName })
        logger.info('Collection renamed successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to rename collection', { error, id, newName })
        toast.error('Failed to rename collection', { description: message })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useChangeCollectionColor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, newColor }: { id: string; newColor: string }) => {
      try {
        logger.debug('Changing collection color at backend', { id, newColor })
        await invoke('change_collection_color', { id, newColor })
        logger.info('Collection color changed successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to change collection color', {
          error,
          id,
          newColor,
        })
        toast.error('Failed to change collection color', {
          description: message,
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useDeleteCollection(options?: { onSuccess?: () => void }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      try {
        logger.debug('Deleting collection at backend', { id })
        await invoke('delete_collection', { id })
        logger.info('Collection deleted successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to delete collection', { error, id })
        toast.error('Failed to delete collection', { description: message })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })

      if (options?.onSuccess) {
        options.onSuccess()
      }
    },
  })
}

export function useAddPdfToCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      collectionId,
      pdfId,
    }: {
      collectionId: string
      pdfId: string
    }) => {
      try {
        logger.debug('Adding PDF to collection at backend', {
          collectionId,
          pdfId,
        })
        await invoke('add_pdf_to_collection', { collectionId, pdfId })
        logger.info('PDF added to collection successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to add PDF to collection', {
          error,
          collectionId,
          pdfId,
        })
        toast.error('Failed to add PDF to collection', {
          description: message,
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useRemovePdfFromCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      collectionId,
      pdfId,
    }: {
      collectionId: string
      pdfId: string
    }) => {
      try {
        logger.debug('Removing PDF from collection at backend', {
          collectionId,
          pdfId,
        })
        await invoke('remove_pdf_from_collection', { collectionId, pdfId })
        logger.info('PDF removed from collection successfully')
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to remove PDF from collection', {
          error,
          collectionId,
          pdfId,
        })
        toast.error('Failed to remove PDF from collection', {
          description: message,
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useTogglePdfInCollection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      collectionId,
      pdfId,
    }: {
      collectionId: string
      pdfId: string
    }) => {
      try {
        logger.debug('Toggling PDF in collection at backend', {
          collectionId,
          pdfId,
        })
        const result = await invoke<boolean>('toggle_pdf_in_collection', {
          collectionId,
          pdfId,
        })
        logger.info('PDF toggled in collection successfully', { result })
        return result
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to toggle PDF in collection', {
          error,
          collectionId,
          pdfId,
        })
        toast.error('Failed to toggle PDF in collection', {
          description: message,
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}

export function useRemovePdfFromAllCollections() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ pdfId }: { pdfId: string }) => {
      try {
        logger.debug('Removing PDF from all collections at backend', { pdfId })
        const result = await invoke<number>('remove_pdf_from_all_collections', {
          pdfId,
        })
        logger.info('PDF removed from all collections successfully', { result })
        return result
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unknown error occurred'
        logger.error('Failed to remove PDF from all collections', {
          error,
          pdfId,
        })
        toast.error('Failed to remove PDF from all collections', {
          description: message,
        })
        throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
    },
  })
}
