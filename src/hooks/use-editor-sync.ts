import { useSaveEditorSettings } from '@/services/pdf'
import type { PdfEditorSyncProps } from '@/types/pdf'
import { useEffect } from 'react'

export function useEditorSync({
  id,
  penColor,
  penThickness,
  highlighterColor,
  highlighterThickness,
  eraserThickness,
  currentPage,
  scale,
}: PdfEditorSyncProps) {
  const { mutate } = useSaveEditorSettings()
  useEffect(() => {
    // mutate
    mutate({
      id,
      penColor,
      penThickness,
      highlighterColor,
      highlighterThickness,
      eraserThickness,
      currentPage,
      scale,
    })
  }, [
    penColor,
    penThickness,
    highlighterColor,
    highlighterThickness,
    eraserThickness,
    currentPage,
    scale,
    mutate,
    id,
  ])
}
