# 批注试卷 PDF 导出 · 分页策略

举证实现：[`exportAnnotatedPdf.ts`](./exportAnnotatedPdf.ts)  
面试对照：[ANNOTATION_INTERVIEW_QUESTIONS.md](../../ANNOTATION_INTERVIEW_QUESTIONS.md) Q21–Q23

## 产品规则

- **题可以跨页**：一道题允许拆到两页（在行与行 / 选项间隙切开）
- **文字行不可中断**：同一行汉字不得被页缝拦腰切成上下两半

## 链路

`prepareExport` → bake → expand → capture wrap → **冻结页步长** → spacer（小块）→ `packPageEnds` → **`snapCutsOutsideProtectedSpans`**（行 + `.option` 等盒）→ **整卷 `domToCanvas`** → **按切缝像素裁切** → jsPDF（底部 **第 n / N 页**）→ restore

## 保护粒度

| 类型 | 选择器 / 方式 | 可否跨页 |
|------|----------------|----------|
| 带边框小块 | `.option, .topic-type, .ks-box, .zq-box, .answer-table, .exam-scope` | 尽量整块同页 |
| 媒体 | `img, figure, table` | 尽量整块同页 |
| 题干 / 答案行 | `.stem` / `.answer-row` **不是**原子块，走行级 span | 题可跨页，行不可断 |
| 整题 | `.tm-card` / `.topic-block` **不保护** | 可跨页 |

盒子与文本行禁止再 `mergeSpans` 糊成大段，否则行顶切点丢失。

## 关键实现点

1. **冻结 `maxPageCssPx`**：spacer 与 pack 共用，避免缝漂移  
2. **`snapCutsOutsideProtectedSpans`**：切缝落在文字行或选项盒内部时，回退到该 span 的 `top`（避免半行 / 半框）  
3. **整卷截图 + 像素裁切**：切缝 Y 与位图像素一一对应  
4. **页码**：每页底部 canvas 绘制 `第 n / N 页`（避开 jsPDF 缺中文字体）

## 诚实边界

- 超高选项框仍可能整块缩放进一页（`fitPageBandToA4`）  
- 超长卷整图占内存较大（Demo 可接受）  
- 截图 PDF 不可选中文字
