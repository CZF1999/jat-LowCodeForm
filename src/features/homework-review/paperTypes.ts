/** Backend paper / answer payload field names keep pinyin abbreviations. */

export type Tmlxdm = 'dxt' | 'duoxt' | 'bdxt' | 'pdt' | 'tkt' | 'jdt' | 'alt' | (string & {})

export const TMLXDM_LABEL: Record<string, string> = {
  dxt: '单选题',
  duoxt: '多选题',
  bdxt: '不定项选择题',
  pdt: '判断题',
  tkt: '填空题',
  jdt: '简答题',
  alt: '案例题',
}

export interface XztOption {
  sfzq: string
  tmid: number
  xxdm: string
  xxnr: string
}

export interface PdtOption {
  sfzq: string
  tmid: number
}

export interface TktBlank {
  sx: number
  tmid: number
  zqda: string
}

export interface JdtRef {
  ckda: string
  tmid: number
}

export interface TmItem {
  df: number
  flid: number
  jb?: string
  kgtda: string
  tkid: number
  tm: string
  tmid: number
  tmlxdm: Tmlxdm
  zgtda: string
  tmjx?: string
  xztxx?: XztOption[]
  pdtxx?: PdtOption[]
  tktxx?: TktBlank[]
  jdtxx?: JdtRef[]
  ztmList?: TmItem[]
}

export interface YjtGroup {
  dgtmlxdf: number
  dgtmlxzf: number
  fs: number
  tmlxdm: Tmlxdm
  tmsl: number
  tmxx: TmItem[]
}

export interface PaperDetail {
  bmmc: string
  ksmc: string
  ryjh: string
  ryxm: string
  sc: number
  sjid: number
  sjzf: number
  stjkssj: string
  strtkssj: string
  tmldzfm: number
  yjtxxx: YjtGroup[]
}

export type AnswerContentInput = string | PaperDetail
