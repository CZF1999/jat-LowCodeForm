/** HTML/Vue 答卷内容区固定宽（不含左右 gutter），避免视口变窄换行导致位置类标注漂移。 */
export const PAPER_CONTENT_WIDTH = 794

/** Vue 试卷内容宽：略宽于 A4，保证得分表题型表头单行不换行。 */
export const PAPER_CONTENT_WIDTH_WIDE = 1080

/** stage 左右 gutter（px），与 Surface CSS padding 一致。 */
export const PAPER_GUTTER_X = 64

export const PAPER_STAGE_WIDTH = PAPER_CONTENT_WIDTH + PAPER_GUTTER_X * 2

export const PAPER_STAGE_WIDTH_WIDE = PAPER_CONTENT_WIDTH_WIDE + PAPER_GUTTER_X * 2
