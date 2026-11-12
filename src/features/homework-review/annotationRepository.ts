import type { AnnotationDraft } from './types'

export const DEMO_HOMEWORK_ID = 'demo-homework-1'
/** Default demo uses JSON paper → HTML; bump when mock paper structure changes. */
export const DEMO_CONTENT_HASH = 'sample-paper-json-v1'

function storageKey(homeworkId: string): string {
  return `homework-review:${homeworkId}`
}

export async function saveDraft(draft: AnnotationDraft): Promise<void> {
  const payload: AnnotationDraft = {
    ...draft,
    updatedAt: Date.now(),
  }
  localStorage.setItem(storageKey(draft.homeworkId), JSON.stringify(payload))
}

export async function loadDraft(homeworkId: string): Promise<AnnotationDraft | null> {
  const raw = localStorage.getItem(storageKey(homeworkId))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as AnnotationDraft
    if (!parsed || !Array.isArray(parsed.annotations)) return null
    return parsed
  } catch {
    return null
  }
}

export async function clearDraft(homeworkId: string): Promise<void> {
  localStorage.removeItem(storageKey(homeworkId))
}
