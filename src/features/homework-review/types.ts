export type AnnotationKind =
  | 'pin'
  | 'stamp'
  | 'textbox'
  | 'callout'
  | 'stroke'
  | 'underline'
  | 'highlight'
export type SurfaceMode = 'image' | 'pdf' | 'html'
export type ReviewTool =
  | 'select'
  | 'stamp'
  | 'textbox'
  | 'callout'
  | 'highlight'
  | 'underline'
  | 'pen'
export type StampSymbol = 'correct' | 'wrong' | 'half' | 'uncertain'

export const STAMP_SYMBOL_LABEL: Record<StampSymbol, string> = {
  correct: '✓',
  wrong: '✗',
  half: '◐',
  uncertain: '?',
}

export const TEXTBOX_PRESETS = ['单位未换算', '公式记错', '审题不清', '计算错误'] as const

export interface HtmlAnchor {
  start: number
  end: number
  quote: string
}

interface AnnotationBase {
  id: string
  kind: AnnotationKind
  surface: SurfaceMode
  pageIndex?: number
  comment?: string
  color?: string
  createdAt: number
}

export interface PinAnnotation extends AnnotationBase {
  kind: 'pin'
  /** image/pdf: normalized 0~1 relative to page; html layout cache only */
  x?: number
  y?: number
  htmlAnchor?: HtmlAnchor
}

export interface StampAnnotation extends AnnotationBase {
  kind: 'stamp'
  symbol: StampSymbol
  /** normalized 0~1 relative to stage/page */
  x: number
  y: number
  htmlAnchor?: HtmlAnchor
}

export interface TextboxAnnotation extends AnnotationBase {
  kind: 'textbox'
  text: string
  /** normalized 0~1 relative to stage/page */
  x: number
  y: number
}

/** Margin callout: tip points at issue, box holds long feedback, line connects them */
export interface CalloutAnnotation extends AnnotationBase {
  kind: 'callout'
  tipX: number
  tipY: number
  boxX: number
  boxY: number
  text: string
  /** pixel width of the long text box; default ~200 */
  boxWidth?: number
}

export interface StrokeAnnotation extends AnnotationBase {
  kind: 'stroke'
  points: Array<{ x: number; y: number }>
}

export interface UnderlineAnnotation extends AnnotationBase {
  kind: 'underline'
  surface: 'html'
  htmlAnchor: HtmlAnchor
}

export interface HighlightAnnotation extends AnnotationBase {
  kind: 'highlight'
  surface: 'html'
  htmlAnchor: HtmlAnchor
}

export type Annotation =
  | PinAnnotation
  | StampAnnotation
  | TextboxAnnotation
  | CalloutAnnotation
  | StrokeAnnotation
  | UnderlineAnnotation
  | HighlightAnnotation

export interface CalloutDraftTip {
  x: number
  y: number
}

export interface ViewportRect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/** Persistence contract for backend / localStorage */
export interface AnnotationDraft {
  homeworkId: string
  contentHash: string
  surface?: SurfaceMode
  annotations: Annotation[]
  updatedAt: number
}

export interface UnderlineRect {
  id: string
  left: number
  top: number
  width: number
  height: number
  color: string
}

export interface HighlightRect {
  id: string
  left: number
  top: number
  width: number
  height: number
  color: string
}
