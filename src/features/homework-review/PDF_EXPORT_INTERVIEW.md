# 批注试卷 PDF 导出 · 面试口述稿

举证：[`exportAnnotatedPdf.ts`](./exportAnnotatedPdf.ts)、[`bakeRangeMarks.ts`](./bakeRangeMarks.ts)、[`ReviewShell.vue`](./components/ReviewShell.vue)  
分页细节：[PDF_PAGINATION.md](./PDF_PAGINATION.md)  
题库对照：[ANNOTATION_INTERVIEW_QUESTIONS.md](../../ANNOTATION_INTERVIEW_QUESTIONS.md) Q21–Q23

---

## 1. 口述稿（可直接背）

### 30 秒

导出走 prepare → bake 划词 → 冻结页步长 → spacer 推小块 → 按保护区间算切缝 → 整卷截图按像素裁进 A4 → finally 还原。产品规则是题可跨页、行不可断；技术栈是 `modern-screenshot`（`domToCanvas`）+ `jsPDF`。

### 1 分钟（逐步版）

> 纯前端截图分页。先 prepare 展开布局，把划词 bake 进文本；再包捕获白边，按 A4 **冻结页高**。跨缝小块用 spacer 推到下一页；收集选项盒和文本行做保护区间，pack + snap 算出切缝，保证题可跨页、行不断开。然后整卷 `domToCanvas` 一次，按切缝像素裁进 jsPDF，页码用 canvas 画中文。`finally` 撤掉 spacer、unbake、还原布局。低频导出所以不上后端；边界是栅格 PDF、文字不可选中、超高块可能缩小。

### 2 分钟

1. **定位**：批注试卷导出是前端截图分页方案，不是服务端排版引擎。入口在 `ReviewShell` 调 `exportAnnotatedPdf`，各 Surface 通过 `AnnotatedSurfaceExportApi` 提供 root / prepare / restore。低频当场导出，不上无头浏览器。
2. **链路 9 步**：`prepareExport` 展开 overflow → `bakeRangeMarks` 把高亮/下划线写进文本 → expand + capture wrap → **冻结** `maxPageCssPx` → `insertPageSpacersForBreaks` → `packPageEnds` → `snapCutsOutsideProtectedSpans` → 整卷 `domToCanvas` → `cropCanvasBand` 进 jsPDF，页码用 canvas 画中文「第 n / N 页」。
3. **保护粒度**：整题不保护（可跨页）；选项/表格/媒体/批注框尽量整块；题干走行级保护，行不可拦腰切断。
4. **bake / restore**：交互态用 mark-layer 绝对矩形不改 DOM；导出态临时烘焙，截完成对还原，避免污染继续批改。
5. **边界**：超高块靠 `fitPageBandToA4` 缩小；整卷截图内存大；成品是图片 PDF，文字不可选中。

---

## 2. 主链路 + 函数对照

```text
prepareExport
  → bakeRangeMarks
  → expandStageForOverflow + wrapStageForCapture
  → measurePageStepCssPx（冻结 maxPageCssPx）
  → insertPageSpacersForBreaks
  → packPageEnds
  → snapCutsOutsideProtectedSpans
  → domToCanvas（整卷）
  → cropCanvasBand → fitPageBandToA4 → jsPDF
  → renderPageLabelCanvas（页码）
  → finally：removePageSpacers / bake.restore / unwrap / restoreExport
```

| 步骤 | 函数 | 一句话职责 |
|------|------|------------|
| 展开布局 | `prepareExport` / `beginExportRootLayout` / `expandStageForOverflow` | 避免引注框、溢出 chrome 被裁切 |
| 烘焙划词 | `bakeRangeMarks` | 高亮/下划线临时写进文本节点，截图更贴字 |
| 捕获盒 | `wrapStageForCapture` / `measureCapturePad` | 白边包住绝对定位批注 |
| 冻结页高 | `measurePageStepCssPx` | spacer 与 pack 共用页步长，避免缝漂移 |
| 推页 | `insertPageSpacersForBreaks` | 跨缝小块前插 spacer，推到下一页 |
| 算切缝 | `packPageEnds` / `computeSliceEnds` | 理想页高下避开保护区间内部 |
| 二次对齐 | `snapCutsOutsideProtectedSpans` | 切缝落在行/盒内则回退到 span 顶 |
| 截图裁切 | `domToCanvas` + `cropCanvasBand` | 整卷一拍，按 CSS-Y 映射像素带 |
| 装页 | `fitPageBandToA4` + jsPDF | 超高带缩小装进 A4 可印区 |
| 页码 | `formatPageLabel` + `renderPageLabelCanvas` | 浏览器字体画图，避开 jsPDF 缺 CJK |
| 还原 | `finally` 内成对 restore | spacer / bake / wrap / Surface 布局全部撤掉 |

---

## 3. 逐步详解（按调用顺序）

入口：`ReviewShell.exportPdf` → `exportAnnotatedPdf()`。  
产品规则两句：**题可以跨页；文字行不能拦腰切断。**  
成品是**图片拼成的 PDF**，不是可检索文字层。

### 第 0 步：Surface 契约

各答卷 Surface（HTML / Vue / 图片 PDF）实现 `AnnotatedSurfaceExportApi`：

| 方法 | 作用 |
|------|------|
| `getExportRoot` | 要截的舞台根节点 |
| `prepareExport` / `restoreExport` | 导出前改布局、导出后还原 |
| `getContentRoot`（可选） | 正文根，用来 bake 划词 |
| `relayoutForExport`（可选） | 插 spacer 后重算绝对定位批注 |

分页/截图逻辑只认这套 API（适配器），不关心试卷是 Vue 组件还是裸 HTML。

### 第 1 步：`prepareExport` —— 拍得全

平时舞台常有 `overflow: hidden`、固定高度，侧边引注框、笔迹溢出会被裁掉。

导出前：

- 滚动容器改为 `overflow: visible`、`height: auto`
- `expandStageForOverflow`：量 callout / textbox / stamp / pin / underline 等，把 stage `min-height` 撑到能包住最底端批注

**口述**：先保证「看得见的批注都在布局盒子里」，再谈分页。

### 第 2 步：`bakeRangeMarks` —— 划词贴字

- **交互态**：高亮/下划线是 mark-layer **绝对定位矩形**，不改文本 DOM，`HtmlAnchor` 字符偏移稳定。
- **导出问题**：截图时绝对层可能与文字错位。
- **做法**：按 `start/end` 切开文本节点，临时包 `<span data-export-bake>`（高亮背景 / 下划线 `border-bottom`）；从后往前处理，避免偏移错乱；截完 `restore()`。
- **笔画**（红笔折线）一般在 canvas 叠层上，**不用 bake**，整卷截图直接拍到。

**口述**：编辑态叠层、导出态烘焙；必须成对 restore。

### 第 3 步：`wrapStageForCapture` —— 白边捕获盒

批注常画到试卷左右/上下外侧。量溢出后用白色 padding 的 `div` 包住 stage。  
`screenshotFilter` 跳过 `.hint` / `.is-preview`，避免工具 UI 进 PDF。

### 第 4 步：冻结 `maxPageCssPx`（关键）

按捕获宽度，把 A4 可印高度（扣边距与页码条）换成 CSS 像素页高：

```text
maxPageCssPx = 可印高度mm / (可印宽度mm / cssWidth)
```

**必须在插 spacer 之前算死，之后不再用宽度重算。**  
否则 spacer 把卷变高后重算页高，切缝会和推页对不齐。

### 第 5 步：`insertPageSpacersForBreaks` —— 物理推页（插哪、多高）

**角色分工**

| 机制 | 改不改 DOM | 作用 |
|------|------------|------|
| spacer（本步） | 改（插空白 div） | 小块物理推到下一页，避免页底半个选项框 |
| pack + snap（下一步） | 不改 DOM，只算 Y | 决定大图从哪几条水平线裁开 |

两套共用**同一个**冻结的 `maxPageCssPx`，否则推完高度变了、切缝还按旧步长会错位。

#### 5.1 理想页缝在哪

`cursor` = 当前页顶（从 0 起），每轮：

```text
pageEnd = cursor + maxPageCssPx
```

这就是「若按固定页高硬切，刀会落在哪」。

#### 5.2 何时判定要插空白（骑缝）

在 `pageEnd` 上找被拦腰切开的保护区间：

```text
blocking = protectedSpans 中满足
  pageEnd ∈ (span.top, span.bottom)  的第一个
```

`shouldInsertPushSpacer(cursor, pageEnd, span)` **两个条件同时成立**才插：

| 条件 | 代码含义 | 人话 |
|------|----------|------|
| 骑缝 | `pageEnd > span.top && pageEnd < span.bottom` | 缝穿过这个选项/行/框 |
| 能推 | `span.top > cursor + 1` | 块顶还在本页中部，前面有空可塞；块已贴页顶（超高块）则推不动 |

**不插 spacer**（`cursor` 直接跳到 `pageEnd`，留给 pack/snap）：

- 缝落在保护区间**间隙**（行与行之间）→ 本来就能切
- 整块从页顶开始且超高 → 推不动
- `findAnchorForProtectedSpan` 找不到 DOM 锚点 → 交给 pack 切行顶
- 锚点顶远高于骑缝那一行（`anchorTop < blocking.top - 8`）→ 推整块会把前面行拽走
- 该锚点前已有 spacer → 不推第二次

#### 5.3 空白 div 插在哪里

`findAnchorForProtectedSpan(contentRoot, origin, blocking)`：

1. **优先**不可拆盒子（`.option`、表格、callout…），选 top/bottom 与 `blocking` 最接近的节点
2. **否则**爬文本行的 block 祖先（`P` / `DIV` / flex…）

然后：

```text
anchor.parentElement.insertBefore(spacer, anchor)
```

即：**空白插在该选项/块的正上方**，把它整块往下顶。  
属性：`data-export-page-spacer`；插完 `relayoutForExport`。

#### 5.4 空白多高（公式就一行）

```text
spacer高度 = pageEnd - blocking.top
→ computePushSpacerHeight(pageEnd, blocking.top)
→ Math.ceil 后写入 style.height
```

几何：插完后块顶应对齐到 `pageEnd`（下一页顶）。

数值例：`cursor=0`，`maxPageCssPx=1000` → `pageEnd=1000`；选项 `top=920`、`bottom=1080`（缝穿过）→ spacer = `1000-920=80px`，插在选项前，选项顶被推到约 `1000`。

推完：`cursor = pageEnd`，扫下一页缝（最多约 200 轮）。

### 第 6 步：算切缝 —— `pack` + `snap`（最终裁在哪）

spacer 只负责把能推的小块挪开；**真正进 PDF 的切缝 Y** 在本步算出。

#### 6.1 `collectProtectedSpans`

相对捕获 wrap 的 Y 区间：

| 保护什么 | 例子 | 规则 |
|----------|------|------|
| 原子盒 | `.option`、得分表等 | 尽量不拦腰切 |
| 媒体 | `img` / `table` | 同上 |
| 批注框 | `.callout-box` / `.textbox` | 同上 |
| 文本行 | TreeWalker + `getClientRects` | 行不可断 |
| 整题 | `.tm-card` **不进保护** | 题可跨页 |

盒子与文本行**禁止再 `mergeSpans` 糊成大段**，否则行顶切点丢失。  
正文行收集时用 `SKIP_TEXT_CLOSEST` 跳过 callout / stamp / mark-layer。

#### 6.2 `packPageEnds` / `computeSliceEnds`

从 `cursor = 0` 起，理想切 `ideal = cursor + maxPageCssPx`：

- `ideal` **不在**任何保护区间内 → 切在 `ideal`
- 落在保护区间内：
  - `blocking.top > cursor` → **切到 `blocking.top`**（本页在块前结束）
  - 否则块贴页顶且超高 → **切到 `blocking.bottom`**（整块独占一带，之后 `fitPageBandToA4` 缩小）
- 绝不在区间正中硬切

#### 6.3 `snapCutsOutsideProtectedSpans`

二次保险：切缝仍在行/盒内 → **强制改成该 span 的 `top`**。  
得到 `pageEnds[]`（每页结束 Y，CSS px），供 `cropCanvasBand` 使用。

#### 6.4 串起来的小例子

`maxPageCssPx = 1000`：

```text
y=0
  题干若干行 …
y=920  选项A顶
y=1000 ← 理想缝（穿过选项A）
y=1080 选项A底
```

1. **spacer**：`[920,1080]` 被 1000 切开且能推 → 选项A前插 **80px** 空白  
2. 布局后选项A顶 ≈ 1000，卷变高  
3. **pack/snap**：第一页切缝落在空白或行间隙；若擦到行则 snap 到行顶  
4. **裁图**：按最终 `pageEnds` 的 CSS-Y × scale 从整卷 canvas 裁带

**面试一句话**：先按冻结页高扫理想缝；缝穿过保护块且块顶在本页中部 → 在块前插高为 `pageEnd - blockTop` 的空白；再用 pack/snap 在块顶/行顶定最终裁切 Y。

### 第 7 步：整卷 `domToCanvas` —— 只拍一次

对 wrap 整卷截一张大图（scale 约 1.5～2× DPR）。

**为何不逐页截**：切缝已在 CSS-Y 算好；一次截图用 `cssToCanvasScale` 映射像素带，墨迹与切缝对齐；逐页截易因滚动/缩放/原点漂移错位。

### 第 8 步：裁带 → 装 A4 → 页码 → 下载

对每个 `[yStart, yEnd)`：

1. `cropCanvasBand`：按 CSS-Y × scale 裁一页 canvas  
2. 换算 mm；过高则 `fitPageBandToA4` **等比缩小**（不裁内容）  
3. `jsPDF.addImage`（JPEG）贴到 A4  
4. `renderPageLabelCanvas` 画「第 n / N 页」再贴图（jsPDF 默认字体无 CJK）  
5. `blob` 下载

### 第 9 步：`finally` 成对还原

无论成败：

1. 删除 page spacer  
2. `bakeHandle.restore()`  
3. 去掉 `is-baking-marks`  
4. unwrap 捕获白边  
5. `surface.restoreExport()`

否则继续批改时划词变成真 span、空白条残留、布局损坏。

### 画面对照（批注如何进 PDF）

| 画面上的东西 | 导出时怎么进 PDF |
|--------------|------------------|
| 红笔笔画 | stroke 叠层 → 整卷截图直接拍到 |
| 题干红下划线 / 高亮 | 先 bake 进字 → 截图贴字 |
| 选项绿底 / 对错色 | DOM 样式 → 截图带走 |
| 侧边批注框 | expand + wrap 白边包住 |
| 多页 | 保护切缝 + 像素裁带 |

---

## 4. 保护粒度（速查）

| 类型 | 选择器 / 方式 | 可否跨页 |
|------|----------------|----------|
| 带边框小块 | `.option, .topic-type, .ks-box, .zq-box, .answer-table, .exam-scope` | 尽量整块同页 |
| 媒体 | `img, figure, table` | 尽量整块同页 |
| 批注框 | `.callout-box, .textbox` | 尽量整块同页 |
| 题干 / 答案行 | 行级 span（`.stem` / `.answer-row` **不是**原子块） | 题可跨页，行不可断 |
| 整题 | `.tm-card` / `.topic-block` **不保护** | 可跨页 |

保护集合：`collectProtectedSpans` = 原子盒 + 媒体 + 批注框 + **盒外文本行**。

---

## 5. 高频追问（短答）

### Q1. 为何整卷截图再裁切，而不是逐页截？

切缝先在 CSS 坐标算好；一次 `domToCanvas` 保证墨迹与 `pageEnds` 像素对齐，避免每页单独截导致缩放、滚动原点漂移。

### Q2. 为何要 `bakeRangeMarks`？和交互态 mark-layer 有何区别？

交互态用绝对矩形叠层，不改文本 DOM，锚点稳定。导出时绝对层可能和字对不齐，所以按偏移把 span 打进文本；截完 `restore`，是「导出态烘焙、编辑态叠层」分离。

### Q3. prepare / restore 为何必须成对？

导出临时改 overflow、min-height、插 spacer、包 wrap；`finally` 不成对还原，用户继续批改时舞台布局是坏的。

### Q4. spacer 与 snap / pack 各解决什么？插哪、多高？

- **spacer**：理想缝 `pageEnd = cursor + maxPageCssPx` 穿过保护块且 `block.top > cursor` 时，在块 DOM 前插空白；高度 = `pageEnd - block.top`（详见 §3 第 5 步）。
- **pack / snap**：不改 DOM；切缝落在保护区间内则切到块顶/行顶；超高块整段占一页，再靠 `fitPageBandToA4` 缩小。

### Q5. 页码为何不用 jsPDF 直接写字？

jsPDF 默认字体无中文；用 `renderPageLabelCanvas` 画「第 n / N 页」再 `addImage`。

### Q6. 为何不上后端？

产品是低频、老师当场导一份带批注的卷；纯前端所见即所得、零 Chromium 运维。批注已是 `AnnotationDraft`，真要批量再演进无头渲染即可。

### Q7. 诚实边界（主动说）

- 超高选项框可能整块缩放进一页（`fitPageBandToA4`）
- 超长卷整图内存较大（Demo 可接受）
- 截图 PDF **不可选中文字**
- 不是服务端排版；PDF 多页批注载体本身 Demo 侧重演示，勿夸产品化完备

---

## 6. 危险表述（面试别踩）

| 别说 | 应说 |
|------|------|
| 「就是 html2canvas 一下」 | modern-screenshot + 切缝保护 + 像素裁切 + restore |
| 「导出后页面偶尔乱一下无所谓」 | prepare/restore、bake/restore 必须成对 |
| 「按固定像素硬切就行」 | 保护行与原子块，题可跨页、行不可断 |
| 「多页 PDF 批注已完整上线」 | Demo；载体多页能力按实际完成度诚实讲 |
| 「PDF 里文字可选中可检索」 | 当前是栅格图页，不可选中 |
| 「前端导出不专业，一定要后端」 | 低频场景前端是合理工程取舍 |

可点名测试：`exportAnnotatedPdf.test.ts` 覆盖 `mergeSpans`、`computeSliceEnds`、`snapCutsOutsideProtectedSpans`、`insertPageSpacersForBreaks` 等纯函数。
