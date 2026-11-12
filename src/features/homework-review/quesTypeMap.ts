import type { Component } from 'vue'
import CaseAnalysis from './components/topic/CaseAnalysis.vue'
import determine from './components/topic/determine.vue'
import fillVacancy from './components/topic/fillVacancy.vue'
import multipleChoice from './components/topic/multipleChoice.vue'
import shortAnswer from './components/topic/shortAnswer.vue'
import singalRadio from './components/topic/singalRadio.vue'
import { TMLXDM_LABEL } from './paperTypes'

export const chineseNum: Record<number, string> = {
  1: '一',
  2: '二',
  3: '三',
  4: '四',
  5: '五',
  6: '六',
  7: '七',
  8: '八',
  9: '九',
  10: '十',
  11: '十一',
  12: '十二',
}

export interface QuesTypeMeta {
  lxmc: string
  quesName: Component
}

export const quesTypeMap: Record<string, QuesTypeMeta> = {
  dxt: { lxmc: TMLXDM_LABEL.dxt, quesName: singalRadio },
  duoxt: { lxmc: TMLXDM_LABEL.duoxt, quesName: multipleChoice },
  bdxt: { lxmc: TMLXDM_LABEL.bdxt, quesName: multipleChoice },
  pdt: { lxmc: TMLXDM_LABEL.pdt, quesName: determine },
  tkt: { lxmc: TMLXDM_LABEL.tkt, quesName: fillVacancy },
  jdt: { lxmc: TMLXDM_LABEL.jdt, quesName: shortAnswer },
  alt: { lxmc: TMLXDM_LABEL.alt, quesName: CaseAnalysis },
}

export function resolveQuesType(tmlxdm: string): QuesTypeMeta {
  return (
    quesTypeMap[tmlxdm] || {
      lxmc: tmlxdm,
      quesName: shortAnswer,
    }
  )
}
