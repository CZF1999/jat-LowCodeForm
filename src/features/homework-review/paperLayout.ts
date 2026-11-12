/** HTML/Vue 答卷内容区固定宽（不含左右 gutter），避免视口变窄换行导致位置类标注漂移。 */
export const PAPER_CONTENT_WIDTH = 794

/** Vue 宽版试卷内容宽（题号导航等更宽排版）。 */
export const PAPER_CONTENT_WIDTH_WIDE = 980

/** stage 左右 gutter（px），与 Surface CSS padding 一致。 */
export const PAPER_GUTTER_X = 64

export const PAPER_STAGE_WIDTH = PAPER_CONTENT_WIDTH + PAPER_GUTTER_X * 2

export const PAPER_STAGE_WIDTH_WIDE = PAPER_CONTENT_WIDTH_WIDE + PAPER_GUTTER_X * 2
