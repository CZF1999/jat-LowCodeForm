# Vue 试卷批注 · 接手与面试讲解

> 范围：**仅 Vue 试卷模式**（`paperMode === 'vue'`）：组件化答卷 + 其上批注全链路。  
> 目标：读完后能按「业务 → 架构 → 逐功能 → 坐标/拖拽 → 追问」与面试官详聊。  
> 以当前源码为准；不编造未实现能力。更广的多载体总览见同目录 [INTERVIEW.md](./INTERVIEW.md)。

---

## 目录

1. [30 秒开场](#1-30-秒开场)
2. [架构总览](#2-架构总览)
3. [组件化试卷壳](#3-组件化试卷壳)
   - [3.4 VuePaperSurface 如何挂上批注](#34-vuepapersurface-如何挂上批注)
   - [3.5 layers 组件职责与交互图解](#35-layers-组件职责与交互图解)
4. [批注能力逐项](#4-批注能力逐项)
   - [4.5 高亮 / 下划线](#45-高亮--下划线)
5. [坐标、固定纸宽与命中](#5-坐标固定纸宽与命中)
6. [与 HTML 试卷对比](#6-与-html-试卷对比)
7. [面试追问速查](#7-面试追问速查)
8. [诚实边界与简历短句](#8-诚实边界与简历短句)
9. [附录：文件索引](#9-附录文件索引)

---

## 1. 30 秒开场

**业务一句话**  
老师在「结构化答卷」上批改：打对错图章、写短评、引注长意见、划词高亮、随手画笔；批注可拖改位、侧栏补评论，并落到本地草稿。

**技术一句话**  
同一份试卷 JSON（`sample-paper.json`），用题型 Vue 组件渲染答卷（`PaperMarkingView` + `topic/*`），再在固定宽度的内容框上叠共用批注舞台（`useHtmlAnnotationStage`）：Canvas 画笔、DOM 图章/文本、SVG 引线、划词矩形层。

**入口怎么进 Demo**

```
/homework-review
  → views/HomeworkReviewPage.vue
  → components/ReviewShell.vue
  → 载体选「HTML」+ 试卷模式切「Vue 试卷」
  → components/surfaces/VuePaperSurface.vue
```

注意：工具栏里的「HTML」是 **SurfaceMode**（富文本/答卷类载体，相对图片/PDF），不是「只能用字符串 HTML」。Vue / HTML 试卷是这一载体下的 **两种答卷渲染**。

---

## 2. 架构总览

```mermaid
flowchart TB
  Shell[ReviewShell]
  Answer[useAnswerContent_paperMode_vue]
  Surface[VuePaperSurface]
  Paper[PaperMarkingView_plus_topic]
  Stage[useHtmlAnnotationStage]
  Store[useAnnotationStore]
  Layers[Canvas_Markers_Callouts_markLayer]
  Repo[annotationRepository]
  Shell --> Answer
  Shell --> Surface
  Surface --> Paper
  Surface --> Stage
  Stage --> Store
  Stage --> Layers
  Store --> Repo
```

### 2.1 分层职责

| 层 | 谁 | 干什么 |
|----|----|--------|
| 壳 | `ReviewShell` | 工具栏、侧栏列表、载体/试卷模式切换、保存导出 |
| 答卷数据 | `useAnswerContent` | 持有 `PaperDetail`、`paperMode`；Vue 模式下 `contentHash` = 试卷 JSON 指纹 |
| 试卷 UI | `PaperMarkingView` + `topic/*` | 只读阅卷壳：题型组件 + 题号导航 |
| 批注舞台 | `useHtmlAnnotationStage` | 量测 content-shell、`toNorm`、落点/划词/画笔、布局叠层数据 |
| 状态 | `useAnnotationStore` | `shallowRef(annotations)`、工具态、增删改、序列化 |
| 渲染层 | `AnnotationCanvas` / `Markers` / `Callouts` / Surface 内 `mark-layer` | 按交互形态拆开，不全塞进 Canvas |
| 持久化 | `annotationRepository` | `AnnotationDraft` → localStorage（async 接口便于换 HTTP） |

### 2.2 数据模型（面试必提）

- **判别联合**：`Annotation` 用 `kind` 收窄（`stamp` / `textbox` / `callout` / `stroke` / `underline` / `highlight`…）。
- **工具 ≠ kind**：例如工具 `pen` 写入 `stroke`；工具 `select` 不落新标注，只选中/拖拽。
- **Vue 答卷上标注的 `surface` 字段仍是 `'html'`**：表示「答卷类载体」，与图片/PDF 区分；划词类型在类型层就锁死 `surface: 'html'`。

### 2.3 主链路（口述版）

1. 老师点工具 → `store.setTool` / `setStampSymbol`。  
2. 在 `VuePaperSurface` 的 stage 上指针事件 → `useHtmlAnnotationStage` 的 `onPointerDown/Move/Up`。  
3. 写入 Store（如 `addStamp`、`beginCallout`/`finishCallout`、`addHighlight`）。  
4. watch 触发 `layoutAll` → 各层 props 更新。  
5. 侧栏 / Popover 改 `comment`/`text`；保存走 `serialize` → `saveDraft`。

---

## 3. 组件化试卷壳

### 3.1 为什么要组件化

| 诉求 | 做法 |
|------|------|
| 题型多、要扩展打分/折叠/附件 | 按 `tmlxdm` 注册表挂组件，而不是越写越长的字符串模板 |
| 贴近真实阅卷 | 右侧 sticky 题号导航、得分表、题干/选项/学生作答分区 |
| 批注仍能做 | 试卷挂在 `contentRef` 内，叠层相对 `contentBoxRef`（content-shell） |

**代价（面试要主动说）**  
划词依赖 TreeWalker 扫出的文本序列。组件插槽、条件渲染、额外文案节点会让 `HtmlAnchor` 的 offset 和「肉眼看到的句子」不完全同构；答卷 DOM 大改时要靠 `contentHash` 提示失效。

### 3.2 试卷 JSON → 题型组件

- 类型：[`paperTypes.ts`](./paperTypes.ts)（字段名保持后端拼音缩写：`tmlxdm`、`yjtxxx`、`tmxx`…）。
- Mock：[`mocks/sample-paper.json`](./mocks/sample-paper.json)。
- 注册表：[`quesTypeMap.ts`](./quesTypeMap.ts)

| `tmlxdm` | 题型名 | 组件 |
|----------|--------|------|
| `dxt` | 单选题 | `topic/singalRadio.vue` |
| `duoxt` / `bdxt` | 多选 / 不定项 | `topic/multipleChoice.vue` |
| `pdt` | 判断题 | `topic/determine.vue` |
| `tkt` | 填空题 | `topic/fillVacancy.vue` |
| `jdt` | 简答题 | `topic/shortAnswer.vue` |
| `alt` | 案例题 | `topic/CaseAnalysis.vue`（可含子题） |

未知题型码回退到 `shortAnswer`，避免整页崩掉。

### 3.3 `PaperMarkingView` 结构

文件：[`components/PaperMarkingView.vue`](./components/PaperMarkingView.vue)

1. 标题、考试时长/总分、考生信息。  
2. `el-descriptions` 展示各大题得分。  
3. `v-for` 大题组 → `<component :is="resolveQuesType(...).quesName" :topic-data="..." />`。  
4. 右侧 `exam-nav`：`position: sticky`，点击题号 `scrollIntoView` 到 `#box_${tmid}`。

题型组件当前是 **只读 Demo**（展示题干、选项、对错标记、学生答案等），不在此页改分；批注叠在整张答卷之上，不侵入题型内部状态。

### 3.4 `VuePaperSurface` 如何挂上批注

文件：[`components/surfaces/VuePaperSurface.vue`](./components/surfaces/VuePaperSurface.vue)

`VuePaperSurface` 是 Vue 试卷批注的装配壳：

1. 用 [`useAnswerContent`](./useAnswerContent.ts) 拿试卷 JSON，在 `contentRef` 里渲染 [`PaperMarkingView`](./components/PaperMarkingView.vue)。
2. 用 [`useHtmlAnnotationStage`](./useHtmlAnnotationStage.ts) 量测 `contentBoxRef`、处理 stage 指针事件、把 Store 标注 layout 成叠层 props。
3. 在与答卷同尺寸的 `overlay-root` 上按层挂渲染组件。

**DOM 树（文字版）**

```
html-surface（滚动，rootRef）
  └ stage（stageRef，接落点/划词/画笔）
       └ content-shell（contentBoxRef = overlay 尺寸基准，固定 980px）
            ├ content（contentRef）→ PaperMarkingView
            └ overlay-root（绝对定位，同宽高，默认 pointer-events:none）
                 ├ mark-layer（高亮/下划线矩形，Surface 内联）
                 ├ AnnotationCanvas
                 ├ AnnotationPins
                 ├ AnnotationMarkers
                 └ AnnotationCallouts
```

**叠层装配图**

```mermaid
flowchart TB
  Surface[VuePaperSurface]
  Stage[useHtmlAnnotationStage]
  Store[useAnnotationStore]
  Paper[PaperMarkingView]
  MarkLayer[mark-layer_inline]
  Canvas[AnnotationCanvas]
  Pins[AnnotationPins]
  Markers[AnnotationMarkers]
  Callouts[AnnotationCallouts]
  Popover[CommentPopover_in_ReviewShell]

  Surface --> Paper
  Surface --> Stage
  Stage --> Store
  Stage --> MarkLayer
  Stage --> Canvas
  Stage --> Pins
  Stage --> Markers
  Stage --> Callouts
  Store --> Popover
```

**z 序（自下而上，均在 overlay-root 内）**

```mermaid
flowchart TB
  L1[1_mark-layer_划词矩形]
  L2[2_AnnotationCanvas_画笔]
  L3[3_AnnotationPins_批注钉]
  L4[4_AnnotationMarkers_图章短文本]
  L5[5_AnnotationCallouts_引注]
  L1 --> L2 --> L3 --> L4 --> L5
```

舞台：`useHtmlAnnotationStage([() => paper.sjid, () => paperMode])`——换卷或切模式后 `nextTick` 再 layout。  
纸宽常量：[`paperLayout.ts`](./paperLayout.ts) 中 `PAPER_CONTENT_WIDTH_WIDE = 980`（Vue 宽版，含题号栏排版）。

坐标约定：点类标注存相对 `content-shell` 的归一化坐标 `0~1`；划词存 `htmlAnchor` 文本偏移，layout 时再转成像素矩形。

`overlay-root` 默认 `pointer-events: none`，通过 `:deep` 给 `.stamp / .textbox / .callout-box / .tip-handle / .pin` 开 `pointer-events: auto`——可点选拖拽，又不挡划词在 content 上采点。

### 3.5 layers 组件职责与交互图解

目录：[`components/layers/`](./components/layers/)

#### 组件一览

| 组件 | 职责 | Props 要点 | Emits / 交互 |
|------|------|------------|--------------|
| [`AnnotationCanvas.vue`](./components/layers/AnnotationCanvas.vue) | Canvas 2D 画 `stroke` 折线；代码可画 pin，但 Vue 路径只传 strokes | `width/height`、`annotations`、`selectedId` | 无；`pointer-events: none`，落笔由 stage 完成 |
| [`AnnotationPins.vue`](./components/layers/AnnotationPins.vue) | 可点蓝色圆钉；按 `visibleIds`（+ 当前选中）裁剪 | `pins`、`visibleIds`、`selectedId`、`width/height` | `select(id)` → `store.select` |
| [`AnnotationMarkers.vue`](./components/layers/AnnotationMarkers.vue) | 图章 + 短文本气泡；`select` 下可拖改位 | `stamps`、`textboxes`、`tool`、尺寸与选中 | `select`、`move-stamp`、`move-textbox`；新建落点在 stage |
| [`AnnotationCallouts.vue`](./components/layers/AnnotationCallouts.vue) | SVG 引线/箭头 + DOM tip/box；草稿虚线预览 | `callouts`、`tool`、`draft-tip`、`draft-preview` | `select`、`move-tip`、`move-box`；整张 SVG `pointer-events: none` |
| [`CommentPopover.vue`](./components/layers/CommentPopover.vue) | 侧栏编辑 comment / 短句 / 引注正文 / 高亮色；可删可关 | `annotation`、`focusToken` | 挂在 [`ReviewShell`](./components/ReviewShell.vue) aside，**不在** Surface 子树 |

**一句话对照**

- **Canvas**：只画笔迹，纯展示。
- **Pins**：可点的钉，带空间索引可见性（[`useSpatialIndex`](./useSpatialIndex.ts)）。
- **Markers**：图章 + 短文本展示与拖改位。
- **Callouts**：引线 SVG + tip/box 展示与拖改位 + 草稿预览。
- **CommentPopover**：侧栏改文案，不参与试卷叠层绘制。
- **VuePaperSurface**：对齐答卷 DOM 与叠层，并把「创建」舞台事件与「改位/选中」层事件接到同一 Store。

#### 图解 1：显示数据流

```mermaid
sequenceDiagram
  participant Store as useAnnotationStore
  participant Stage as useHtmlAnnotationStage
  participant Surface as VuePaperSurface
  participant Layers as LayerComponents

  Store-->>Stage: annotations_change
  Stage->>Stage: layoutAll
  Note over Stage: pins_resolve_anchor_stamps_copy_coords_ranges_to_px
  Stage-->>Surface: positioned_rects_canvasAnnotations_size
  Surface-->>Layers: pass_as_props
  Layers->>Layers: norm_coords_times_size_render
```

- 点标注（stamp / textbox / callout / stroke）：存好的 `x,y`（或 `points`）× `size`。
- 划词：`layoutRangeMarks` → `underlineRects` / `highlightRects` → Surface 内联 `mark-layer`。
- 划词预览：`previewRects` 同层半透明矩形。
- 尺寸：`measureContent(contentBoxRef)` → 各层共享 `size.width/height`。

#### 图解 2：事件拆分（创建 vs 拖改）

```mermaid
flowchart LR
  subgraph createPath [创建路径_stage]
    Tool[选工具]
    StagePtr[stage_pointerDown_Move_Up]
    Add[addStamp_addTextbox_callout_stroke_highlight]
    Tool --> StagePtr --> Add
  end

  subgraph editPath [改位选中路径_layers]
    Hit[点中_stamp_textbox_tip_box_pin]
    Select[store.select]
    Drag[window_pointerMove_阈值约3px]
    Update[updateStamp_Textbox_Callout]
    Hit --> Select
    Hit --> Drag --> Update
  end

  Add --> StoreNode[useAnnotationStore]
  Update --> StoreNode
  Select --> PopoverNode[CommentPopover_侧栏]
```

| 场景 | 谁处理 | 结果 |
|------|--------|------|
| 选工具后在空白处落点 / 划词 / 画笔 | `stage` 上 `onPointerDown/Move/Up` | `addStamp` / `addTextbox` / `beginCallout` / `finishCallout` / `addStroke` / `addHighlight` … |
| `select` 下拖图章 / 短文本 / 引注 tip·box | Markers / Callouts 本地拖拽 + `stopPropagation` | `updateStampPosition` / `updateTextboxPosition` / `updateCalloutTip` / `updateCalloutBox` |
| 点选已有标记 | Layers emit `select` | `store.select` → 侧栏 Popover |
| 引注二次落点过程中移动 | stage `onPointerMove` | `updateCalloutPreview` → Callouts 草稿虚线 |

#### 图解 3：命中与 pointer-events

```mermaid
flowchart TB
  Overlay[overlay-root_pointer-events_none]
  Content[content_可划词采点]
  SVG[callout-svg_pointer-events_none]
  Interactive[stamp_textbox_tip_box_pin_pointer-events_auto]

  Overlay -.->|"不挡下层"| Content
  Overlay --> SVG
  Overlay --> Interactive
  SVG -.->|"不挡 Markers"| Interactive
```

面试易错点：引注层有一张铺满 SVG；若 SVG 可命中会挡住下层图章。当前 SVG 整层不命中，只有 tip/box 可点。

---

## 4. 批注能力逐项

每项按：**场景 → 交互 → 数据 → 调用链 → 易错/追问**。

### 4.1 选中与拖拽（`tool === 'select'`）

**场景**  
改位置、点开侧栏编辑，而不是继续落新标记。

**交互**

- 点击图章 / 短文本 / 引注 tip 或长文本框 → `store.select(id)`。  
- 按住拖动（阈值约 3px）→ 写回归一化坐标。  
- 非 `select` 工具：仍可点选，但不进入拖拽。

**数据**  
只改已有标注的 `x,y` / `tipX,tipY` / `boxX,boxY`；拖拽会清掉历史上可能残留的 `htmlAnchor` / `tipHtmlAnchor`（兼容旧草稿）。

**调用链**

- [`AnnotationMarkers.vue`](./components/layers/AnnotationMarkers.vue)：`pointerdown` → window 级 `pointermove/up` → `updateStampPosition` / `updateTextboxPosition`。  
- [`AnnotationCallouts.vue`](./components/layers/AnnotationCallouts.vue)：同上 → `updateCalloutTip` / `updateCalloutBox`。

**易错 / 追问**

- 引注层有一张铺满的 SVG 画线；若 SVG 可命中，会挡住下层图章。当前 `.callout-svg { pointer-events: none }`，tip/box 单独 `auto`。  
- `overlay-root` 为 `pointer-events: none`，可交互子节点 `auto`，避免挡住划词采集。

---

### 4.2 图章 `stamp`

**场景**  
客观题对错、半对、存疑——标准化符号，比手画勾叉更快。

**交互**  
选 ✓/✗/◐/? → 单击答卷落点 → 侧栏可写错因。

**数据**（`StampAnnotation`）

- `symbol`、`x`、`y`（相对 content-shell，`0~1`）  
- `comment`、`color`  
- **落点不再写 `htmlAnchor`**（跟固定纸宽策略一致，钉在试卷坐标上）

**调用链**  
`placeStampOrText` → `store.addStamp({ surface: 'html', x, y, symbol, ... })` → Markers 居中渲染（约 32×32，负 margin）。

**追问**  
为什么不用笔手画？符号统一、一次点击、样式一致，吞吐更高。

---

### 4.3 短文本 `textbox`

**场景**  
概念性提醒（「单位未换算」），比图章多几个字，比引注短。

**交互**  
工具短文本 → 单击落框 → 侧栏/预设改文案。

**数据**  
`text`、`x`、`y`；同样只存试卷坐标，不绑文本锚点。

**调用链**  
同图章分支 → `addTextbox` → Markers 中 `.textbox`（向上平移居中）。

---

### 4.4 引注 `callout`

**场景**  
「问题在这里，意见写在页边」——尖点钉问题，长框写改进意见，线连接。

**交互**

1. 第一次点击：落下 tip（问题位置）。  
2. 第二次点击：落下 box（长文本位置）。  
3. 过程中可预览引线；`Esc` 或切工具 → `cancelCalloutDraft`。  
4. `select` 下可分别拖 tip / box。

**数据**（`CalloutAnnotation`）

- `tipX/tipY`、`boxX/boxY`、`text`、可选 `boxWidth`  
- tip **不再**写 `tipHtmlAnchor`

**调用链**  
`beginCallout(point)` → `updateCalloutPreview` → `finishCallout(box, …)` → Callouts：SVG 线+箭头 + DOM tip/box。

**追问**  
为什么两步？把「指错位置」和「写意见区域」拆开，避免长文本挡住题干。

---

### 4.5 高亮 / 下划线

**场景**  
圈出句子再写评语；必须跟文字走，不能只存一个点。

**结论先说**  
**不是**改答卷 DOM 给文字加 `<mark>` / CSS `text-decoration`。  
而是：拖选时把指针换成答卷全文的**字符偏移**，持久化 `htmlAnchor`；展示时用 `Range.getClientRects()` 算出若干像素矩形，叠在 [`VuePaperSurface.vue`](./components/surfaces/VuePaperSurface.vue) 的 `mark-layer` 里画半透明高亮条或 2px 下划线。

**核心文件**

| 文件 | 职责 |
|------|------|
| [`htmlRange.ts`](./htmlRange.ts) | 文本节点线性化 + 点 / Range / offset 互转 |
| [`useHtmlAnnotationStage.ts`](./useHtmlAnnotationStage.ts) | 拖选、预览、落库、`layoutRangeMarks` |
| [`useAnnotationStore.ts`](./useAnnotationStore.ts) | `addHighlight` / `addUnderline` |
| [`types.ts`](./types.ts) | `HtmlAnchor`、`HighlightAnnotation`、`UnderlineAnnotation` |
| Surface 内联 `mark-layer` | 渲染矩形（非独立 layer 组件） |

#### 数据模型

```ts
interface HtmlAnchor { start: number; end: number; quote: string }

interface HighlightAnnotation {
  kind: 'highlight'
  surface: 'html'          // 类型锁死 HTML 答卷；图片/PDF 禁用
  htmlAnchor: HtmlAnchor   // 必填，不存像素
  color?: string           // 默认 #facc15，侧栏可改
  comment?: string
}

interface UnderlineAnnotation {
  kind: 'underline'
  surface: 'html'
  htmlAnchor: HtmlAnchor
  color?: string           // 默认 #ef4444
}
```

`quote` 取选区前 40 字，给侧栏 [`CommentPopover`](./components/layers/CommentPopover.vue) 展示原文摘录。

#### 端到端流程

```mermaid
sequenceDiagram
  participant User
  participant Stage as useHtmlAnnotationStage
  participant RangeApi as htmlRange
  participant Store as useAnnotationStore
  participant Surface as VuePaperSurface_markLayer

  User->>Stage: pointerdown_highlight_or_underline
  Stage->>RangeApi: caretOffsetFromPoint
  RangeApi-->>Stage: draftStart_offset
  User->>Stage: pointermove
  Stage->>RangeApi: caretOffsetFromPoint
  Stage->>Stage: updatePreview_offsetToRange_getClientRects
  Stage-->>Surface: previewRects
  User->>Stage: pointerup
  Stage->>RangeApi: offsetToRange_then_rangeToOffsets
  Stage->>Store: addHighlight_or_addUnderline
  Store-->>Stage: annotations_watch
  Stage->>Stage: layoutRangeMarks
  Stage-->>Surface: highlightRects_or_underlineRects
```

##### 1. 拖选开始（pointerdown）

`tool === 'highlight' | 'underline'` 时：

1. `caretOffsetFromPoint(contentRef, clientX, clientY)` 得到全文 offset  
2. `drawingRange = true`，记下 `draftStart` / `draftEnd`  
3. `stageRef.setPointerCapture`，避免拖出区域丢事件  
4. `preventDefault`，避免原生选区干扰  

`caretOffsetFromPoint`：

- Chrome：`document.caretRangeFromPoint`  
- Firefox：`document.caretPositionFromPoint`  
- 校验节点在 `contentRef`（试卷根）内  
- 用 `TreeWalker(SHOW_TEXT)` 把该文本节点映射成**全文线性偏移**

##### 2. 拖动预览（pointermove）

持续采 `draftEnd`，调用 `updatePreview(start, end, color)`：

1. `offsetToRange` 还原 DOM `Range`  
2. `range.getClientRects()`（跨行会有多段矩形）  
3. `stageRelativeFromClientRect(contentBoxRef, rect)` → 相对 content-shell 的像素  
4. 写入 `previewRects`：  
   - **高亮**：整段 `left/top/width/height`，色来自 `store.highlightColor`  
   - **下划线**：`top = rel.top + rel.height - 2`，`height = 2`  

Surface 用半透明 `.is-preview` 画出这些矩形。

##### 3. 松手落库（pointerup → finishRangeMark）

1. `end - start < 1` 则丢弃  
2. `offsetToRange` → `rangeToOffsets` 得到 `{ start, end, quote }`  
3. `store.addHighlight` 或 `addUnderline`（强制 `surface: 'html'`）  
4. 选中该条并 `requestCommentFocus`，促使用户在侧栏写意见  
5. 清空 `previewRects`

##### 4. 持久展示（layoutRangeMarks）

Store 变化触发 `layoutAll()`：

```
htmlAnchor → offsetToRange(contentRef)
          → getClientRects()
          → stageRelativeFromClientRect(contentBoxRef)
          → highlightRects / underlineRects
```

一条标注可拆成多个 rect（`id` 形如 `${item.id}_${index}`）。  
滚动 / resize 会再跑 `layoutAll`，矩形跟文字重对齐。

##### 5. 渲染差异（Surface mark-layer）

| | 高亮 | 下划线 |
|--|------|--------|
| 几何 | 覆盖文字整段高度 | 贴底 2px 条 |
| 默认色 | `#facc15`，可改预设 | `#ef4444` |
| CSS | `opacity: 0.35` | `opacity: 0.95` |
| 交互 | `mark-layer` 整层 `pointer-events: none`，不挡后续划词 | 同左 |

#### 文本偏移为何是「全文线性」

```mermaid
flowchart LR
  DOM[PaperMarkingView_DOM]
  Walker[TreeWalker_SHOW_TEXT]
  Stream[linear_char_stream]
  Anchor[htmlAnchor_start_end]
  DOM --> Walker --> Stream --> Anchor
```

`textNodes(root)` 按文档序拼接所有 Text 节点。offset 是相对这整条字符流，不是相对某一段落的局部 index。  
因此：**题型组件插入/删除文本节点、条件渲染改文案，都会让旧 offset 漂移。** Demo 用 `contentHash`（试卷 JSON 指纹）提示内容版本；生产需更稳锚点（段落 id + 相对偏移等）。图片/PDF 无 OCR，工具栏禁用划词。

#### 与图章坐标策略对比（面试要点）

| | 高亮/下划线 | 图章/短文本/引注 tip |
|--|-------------|---------------------|
| 存什么 | `htmlAnchor` 字符偏移 | 相对 content-shell 的 `x,y ∈ [0,1]` |
| 为何 | 必须跟句子走，换行/滚动仍对准 | 固定纸宽，钉在试卷坐标即可 |
| 重算 | 每次 layout 用 Range→rects | 直接 × width/height |

**面试怎么说**

> HTML 划词不存像素。存文本偏移，展示时用 Range 重算 `getClientRects`。滚动、换行后仍能对准原句；组件 DOM 大改要靠 contentHash 或更稳锚点兜底。

---

### 4.6 画笔 `pen` → `stroke`

**场景**  
自由圈画、强调路径。

**交互**  
按下移动采点，抬起若点数 > 1 则提交。

**数据**  
`points: {x,y}[]`，均为相对 content-shell 的归一化坐标。

**调用链**  
stage 上 capture → `addStroke` → [`AnnotationCanvas.vue`](./components/layers/AnnotationCanvas.vue) 折线绘制（`pointer-events: none`）。

---

### 4.7 侧栏、评论与持久化

**侧栏**  
`ReviewShell` 列出当前 surface 标注（新在上）；点击选中；可删、可清。

**评论**  
`CommentPopover`：按 kind 编辑 `comment` / 短文本 / 引注正文 / 高亮颜色等；落点后 `requestCommentFocus` 促使用户写意见。

**草稿契约**（`AnnotationDraft`）

```ts
{ homeworkId, contentHash, surface?, annotations, updatedAt }
```

- Repository：[`annotationRepository.ts`](./annotationRepository.ts)（localStorage，`async` 便于换后端）。  
- Vue 模式：`contentHash = hash(JSON.stringify(paper))`（见 `useAnswerContent.refreshFromPaper`）。  
- 答卷内容变了 → hash 变 → 可提示旧锚点/批注可能失效（Demo 以回显为主，冲突策略未做全）。

---

## 5. 坐标、固定纸宽与命中

### 5.1 坐标系

- 原点与分母：`content-shell`（`contentBoxRef`），**不含** stage 左右 gutter。  
- 落点 / 拖拽 / 画笔：`toNorm` → `x,y ∈ [0,1]`。  
- 量测：`boxMetrics`（宽用 `clientWidth`，高用 `scrollHeight` 等），与 overlay 的 `width/height` 一致。

**面试一句话**  
归一化相对试卷内容区，不相对带 padding 的外壳，避免窗口变宽时「留白进分母」导致漂移。

### 5.2 固定纸宽策略（当前位置类标注的主方案）

- Vue：内容区锁 `980px`，高度随内容，外层滚动；窄屏横滚，**不挤压换行**。  
- 图章 / 短文本 / 引注 tip：**只存 `x,y`**，绘制直接用存盘坐标。  
- 划词：仍用 `HtmlAnchor` 跟字。

**为何正确**  
容器宽固定 → 同字体同内容下版式稳定 → 试卷相对坐标跨屏可对齐。  
**仍不保证的**：字体/缩放/DOM 结构变化后，纯 xy 不会「粘」在某个字上——那是锚点的职责。

### 5.3 叠层命中

| 规则 | 原因 |
|------|------|
| `.overlay-root { pointer-events: none; z-index: 2 }` | 空白处穿透，方便划词；叠在答卷之上 |
| `.stamp/.textbox/.callout-box/.tip-handle/.pin { pointer-events: auto }` | 可点可拖 |
| `.callout-svg { pointer-events: none }` | 全幅 SVG 默认会抢点击，挡住图章 |

---

## 6. 与 HTML 试卷对比

同一 JSON，工具栏可切换「Vue 试卷 / HTML 试卷」：

| 维度 | Vue 试卷（本模式） | HTML 试卷（对比用） |
|------|--------------------|---------------------|
| 渲染 | `PaperMarkingView` + 题型组件 | `renderPaperToHtml` + `v-html` |
| 产品形态 | 题号导航、分区清晰，易加业务能力 | 接入快，适合后端直出 HTML |
| 批注舞台 | **同一套** `useHtmlAnnotationStage` | 同左 |
| 纸宽 | `980` 宽版 | `794` 标准版 |
| 划词 | 受组件 DOM 文本序列影响更大 | DOM 更扁平时 offset 更直观 |
| `contentHash` | 试卷 JSON 指纹 | 渲染后 HTML 指纹 |

**Demo 结论**：协议与批注栈用 HTML 适配也能跑通；产品化阅卷 UI 更适合 Vue 组件化答卷。

---

## 7. 面试追问速查

| 问题 | 答要点 |
|------|--------|
| Vue 试卷和 HTML 载体是什么关系？ | 载体 `surface=html` 表示答卷类；其下再分 Vue/HTML 两种渲染 |
| 为什么不全用 Canvas？ | 笔画适合 Canvas；可点可拖、可编辑文本适合 DOM；引线 SVG 方便 |
| 坐标为什么用 0~1？ | 相对固定内容框；与像素解耦，纸宽锁定后跨屏稳定 |
| 为什么还要固定纸宽？ | 防止视口变窄换行导致版式变、xy 对不上 |
| 图章为什么不跟字？ | 产品选择钉在试卷坐标；跟字用划词锚点 |
| 划词如何抗滚动？ | 存文本 offset，展示时 Range 重算矩形 |
| 引注为什么两步？ | 尖点指问题，框写长文，空间分离 |
| 拖不动怎么排查？ | 是否在「选中」工具；SVG/叠层是否抢命中；overlay 子节点是否 auto |
| shallowRef 干什么？ | 大列表整体替换，避免深代理 |
| Worker 干什么？ | pin 空间索引/压测裁剪；主线程少算 |
| pin 还在吗？ | 类型与压测仍在；工具栏已由图章替代 |
| 和仓库里低代码编辑器关系？ | 同仓不同范式：编辑器是 schema 搭页面；本模块是文档标注交互 |
| 答卷改了批注怎么办？ | `contentHash` 可校验；生产要冲突策略（Demo 未做全） |
| 如何扩展新题型？ | `quesTypeMap` 注册 + 新 topic 组件，舞台不用改 |
| 持久化如何换后端？ | Repository 已是 async；Draft 契约带 homeworkId/hash/annotations |

---

## 8. 诚实边界与简历短句

### 未做 / Demo 边界

- 撤销/重做命令栈  
- 后端同步、权限、多人冲突合并  
- 划词改选区（非拖色块）、笔画整体平移  
- 题型内联打分写回、附件、折叠的完整产品流  
- 更稳的文本锚点（段落 id 等）  
- 移动端手势与无障碍专项  

### 简历可粘贴

**80 字**  
基于 Vue3 做组件化答卷批阅：题型注册表渲染试卷，固定内容宽 + 归一化坐标叠图章/引注/划词/画笔；Canvas/DOM/SVG 分层；划词用文本锚点，位置类标注相对试卷坐标；Draft 契约可对接后端。

**40 字**  
Vue 组件化答卷 + 分层批注：题型注册、固定纸宽坐标、文本锚点划词、本地 Draft 持久化。

---

## 9. 附录：文件索引

| 路径 | 职责 |
|------|------|
| [useAnswerContent.ts](./useAnswerContent.ts) | 试卷数据与 `paperMode` |
| [paperTypes.ts](./paperTypes.ts) | 试卷 JSON 类型 |
| [quesTypeMap.ts](./quesTypeMap.ts) | 题型码 → 组件 |
| [paperLayout.ts](./paperLayout.ts) | 固定内容宽/gutter |
| [useHtmlAnnotationStage.ts](./useHtmlAnnotationStage.ts) | Vue/HTML 共用批注舞台 |
| [useAnnotationStore.ts](./useAnnotationStore.ts) | 批注状态 |
| [types.ts](./types.ts) | Annotation 协议 |
| [htmlRange.ts](./htmlRange.ts) | 文本 offset / Range / boxMetrics |
| [annotationRepository.ts](./annotationRepository.ts) | Draft 持久化 |
| [components/PaperMarkingView.vue](./components/PaperMarkingView.vue) | Vue 阅卷壳 |
| [components/topic/*](./components/topic/) | 只读题型组件 |
| [components/surfaces/VuePaperSurface.vue](./components/surfaces/VuePaperSurface.vue) | Vue 试卷 + 叠层装配 |
| [useSpatialIndex.ts](./useSpatialIndex.ts) | Pins 可见性裁剪 |
| [components/layers/AnnotationCanvas.vue](./components/layers/AnnotationCanvas.vue) | 画笔 stroke |
| [components/layers/AnnotationPins.vue](./components/layers/AnnotationPins.vue) | 批注钉 DOM |
| [components/layers/AnnotationMarkers.vue](./components/layers/AnnotationMarkers.vue) | 图章/短文本拖拽 |
| [components/layers/AnnotationCallouts.vue](./components/layers/AnnotationCallouts.vue) | 引注线 + tip/box |
| [components/layers/CommentPopover.vue](./components/layers/CommentPopover.vue) | 侧栏评论编辑 |
| [components/ReviewShell.vue](./components/ReviewShell.vue) | 工具栏与侧栏 |
| [mocks/sample-paper.json](./mocks/sample-paper.json) | Demo 试卷 |

---

**口述收束建议**  
先画「JSON → 题型组件 → 固定宽 content-shell → 分层批注 → Store/Draft」一张图（可直接用 [§3.4–3.5](#34-vuepapersurface-如何挂上批注) 的装配 / 数据流 / 事件拆分三图），再任选 **引注两步态** 或 **划词锚点 vs 图章坐标**（详解见 [§4.5](#45-高亮--下划线)）深挖一个点，最后主动补一句边界（hash、组件 DOM 对划词的影响）。
