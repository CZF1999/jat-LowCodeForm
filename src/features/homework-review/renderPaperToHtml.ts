import {
  TMLXDM_LABEL,
  type AnswerContentInput,
  type PaperDetail,
  type TmItem,
  type YjtGroup,
} from './paperTypes'

const SECTION_ORDINALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']

export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function hashContent(html: string): string {
  let hash = 2166136261
  for (let i = 0; i < html.length; i += 1) {
    hash ^= html.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `paper-${(hash >>> 0).toString(16)}`
}

function typeLabel(code: string): string {
  return TMLXDM_LABEL[code] || code
}

function sectionTitle(index: number, code: string): string {
  const ordinal = SECTION_ORDINALS[index] || String(index + 1)
  return `${ordinal}、${typeLabel(code)}`
}

function studentAnswerText(item: TmItem): string {
  const objective = (item.kgtda || '').trim()
  const subjective = (item.zgtda || '').trim()
  if (objective && objective !== '未作答') return objective
  if (subjective && subjective !== '未作答') return subjective
  if (objective) return objective
  if (subjective) return subjective
  return '未作答'
}

function isCorrectFlag(flag: string | undefined): boolean {
  return flag === '1' || flag === 'true'
}

function renderChoiceOptions(item: TmItem): string {
  const options = item.xztxx || []
  if (!options.length) return ''
  const student = studentAnswerText(item)
  const lis = options
    .map((opt) => {
      const correct = isCorrectFlag(opt.sfzq)
      const picked =
        student !== '未作答' &&
        (student === opt.xxdm ||
          student.includes(opt.xxdm) ||
          student === `${opt.xxdm}.${opt.xxnr}`)
      const marks: string[] = []
      if (correct) marks.push('正确')
      if (picked) marks.push('考生选')
      const markHtml = marks.length
        ? `<span class="opt-mark">${escapeHtml(marks.join(' · '))}</span>`
        : ''
      return `<li class="opt${correct ? ' is-correct' : ''}${picked ? ' is-picked' : ''}">
        <span class="opt-code">${escapeHtml(opt.xxdm)}.</span>
        <span class="opt-text">${escapeHtml(opt.xxnr)}</span>
        ${markHtml}
      </li>`
    })
    .join('')
  return `<ul class="options">${lis}</ul>`
}

function renderJudge(item: TmItem): string {
  const correct = item.pdtxx?.[0]
  const correctLabel = correct ? (isCorrectFlag(correct.sfzq) ? '正确' : '错误') : '—'
  return `<p class="meta-line">正确答案：${escapeHtml(correctLabel)}</p>`
}

function renderFillBlanks(item: TmItem): string {
  const blanks = item.tktxx || []
  if (!blanks.length) return ''
  const rows = blanks
    .map(
      (blank) =>
        `<li>空${blank.sx}：标准答案 <strong>${escapeHtml(blank.zqda || '')}</strong></li>`,
    )
    .join('')
  return `<ul class="blanks">${rows}</ul>`
}

function renderShortAnswer(item: TmItem): string {
  const refs = item.jdtxx || []
  if (!refs.length) return ''
  const body = refs.map((ref) => escapeHtml(ref.ckda || '')).join('<br/>')
  return `<div class="ref-answer"><p class="meta-line">参考答案：</p><p>${body}</p></div>`
}

function renderTmItem(item: TmItem, indexLabel: string, depth = 0): string {
  const cls = depth > 0 ? 'tm-item is-sub' : 'tm-item'
  const type = typeLabel(item.tmlxdm)
  const parts: string[] = [
    `<div class="${cls}" data-tmid="${item.tmid}" data-tmlxdm="${escapeHtml(String(item.tmlxdm))}">`,
    `<h4>${escapeHtml(indexLabel)}（${escapeHtml(type)}，得分 ${item.df ?? 0}）</h4>`,
    `<p class="stem">${escapeHtml(item.tm || '')}</p>`,
  ]

  if (item.xztxx?.length) parts.push(renderChoiceOptions(item))
  if (item.tmlxdm === 'pdt' || item.pdtxx?.length) parts.push(renderJudge(item))
  if (item.tktxx?.length) parts.push(renderFillBlanks(item))
  if (item.jdtxx?.length) parts.push(renderShortAnswer(item))

  parts.push(
    `<p class="student-answer">学生作答：${escapeHtml(studentAnswerText(item))}</p>`,
  )

  if (item.ztmList?.length) {
    parts.push('<div class="sub-list">')
    item.ztmList.forEach((sub, i) => {
      parts.push(renderTmItem(sub, `${indexLabel}.${i + 1}`, depth + 1))
    })
    parts.push('</div>')
  }

  parts.push('</div>')
  return parts.join('')
}

function renderGroup(group: YjtGroup, groupIndex: number): string {
  const title = sectionTitle(groupIndex, String(group.tmlxdm))
  const items = (group.tmxx || [])
    .map((tm, i) => renderTmItem(tm, String(i + 1)))
    .join('')
  return `<section class="tm-group" data-tmlxdm="${escapeHtml(String(group.tmlxdm))}">
    <h3>${escapeHtml(title)}（共 ${group.tmsl ?? group.tmxx?.length ?? 0} 题，每题 ${group.fs ?? 0} 分）</h3>
    ${items}
  </section>`
}

export function renderPaperToHtml(paper: PaperDetail): string {
  const groups = (paper.yjtxxx || []).map((g, i) => renderGroup(g, i)).join('')
  return `<article class="paper-answer" data-sjid="${paper.sjid}">
  <header class="paper-header">
    <h2>${escapeHtml(paper.ksmc || '在线作业答卷')}</h2>
    <p>单位：${escapeHtml(paper.bmmc || '—')}　姓名：${escapeHtml(paper.ryxm || '—')}　警号：${escapeHtml(paper.ryjh || '—')}</p>
    <p>试卷总分：${paper.sjzf ?? 0}　时长：${paper.sc ?? 0} 分钟　试卷 ID：${paper.sjid ?? '—'}</p>
  </header>
  ${groups}
</article>`
}

export function resolveContentHtml(input: AnswerContentInput): string {
  if (typeof input === 'string') return input
  return renderPaperToHtml(input)
}
