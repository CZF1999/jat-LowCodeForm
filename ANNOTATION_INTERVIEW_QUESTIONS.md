# 作业批阅 · 批注模块面试题库（5 年前端 · 项目深挖）

> 举证：`src/features/homework-review`（`types` / `useAnnotationStore` / `useHtmlAnnotationStage` / surfaces / layers / `useSpatialIndex` / `htmlRange` / `exportAnnotatedPdf` / `annotationRepository`）  
> 用法：对着题干口述 1–2 分钟 → 对照「期望关键词」查漏 → 避开「危险信号」  
> **自测建议：先遮住「参考口述」自己说一遍，再对照；改成你自己的措辞，勿整段背诵。**  
> 精读对照：[INTERVIEW.md](./src/features/homework-review/INTERVIEW.md) · [VUE_PAPER_ANNOTATION_HANDOFF.md](./src/features/homework-review/VUE_PAPER_ANNOTATION_HANDOFF.md)

---

## 面试官推进节奏

1. 30 秒业务定位（老师在答卷/图片/PDF 上批改）
2. 架构主线（Shell → Surface → Store → 分层渲染 → 持久化）
3. 硬核深挖（归一化坐标、划词 HtmlAnchor、callout 两段式、空间索引）
4. 导出与工程（截图 PDF、bake 划词、测试策略）
5. 软性：诚实边界与排障故事

| 通过线 | 挂科线 |
|--------|--------|
| 能讲清 kind/工具/载体分层、坐标为何相对内容框、划词如何锚文本、为何不全塞 Canvas | 只会说「Canvas 画批注」；分不清 pin/stamp、surface 与试卷模式；说不出 overlap / contentHash |

---

## A. 开场与架构（必问）

### Q1. 用 1 分钟介绍作业批阅批注 Demo：解决什么问题？边界在哪？

**追问：** 和「完整在线阅卷平台」差在哪里？交付物是什么？

**期望关键词：**
- 老师在答卷上图章/短评/引注/划词/画笔；侧栏评论；本地草稿
- 多载体：image / pdf / html（含 Vue 组件化试卷）
- Demo 边界：localStorage、无账号权限评分流、PDF 侧重首页演示

**危险信号：**
- 吹成「已上线万人阅卷系统」却说不出持久化与权限
- 把批注和改分、流程引擎混成一件事

**参考口述：**  
这是作业批阅里的批注子系统：老师在答卷或扫描件上打对错图章、写短评、引注长意见、划词高亮/下划线、随手画笔，侧栏补评论，草稿落到本地。技术上按载体分 image、pdf、html；html 下还有富文本答卷和 Vue 组件化试卷两种渲染。边界要诚实：这是前端交互与坐标/导出 Demo，持久化是 localStorage 的 async 仓库接口，没有完整账号、权限、改分流水线和多人实时共编。

---

### Q2. 主链路怎么走？`ReviewShell`、Surface、Store、layers、Repository 各干什么？

**追问：** 指针事件在哪采集？谁写 Annotation？

**期望关键词：**
- Shell：工具栏、侧栏、载体切换、保存导出
- Surface：量测内容框、指针事件、叠层挂载
- `useAnnotationStore`：工具态 + `shallowRef(annotations)` 增删改
- layers：按形态渲染；Repository：`AnnotationDraft` 读写

**危险信号：**
- 说「全部画在一个 Canvas 里」
- Store 和 Surface 职责说不清

**参考口述：**  
入口是 ReviewShell：工具栏改工具，侧栏列批注、保存导出。具体载体 Surface（HtmlRich / VuePaper / ImagePdf）负责量测内容框、采指针事件，调用 Store 的 addStamp、划词、画笔等。Store 持有 annotations 和选中态。渲染按层拆：Canvas 画 stroke（及旧 pin 圆点），DOM Markers 放图章/短文本，SVG Callouts 画引线，划词用 mark-layer 矩形。Repository 把 `AnnotationDraft` 存 localStorage，接口做成 async 方便以后换 HTTP。

---

### Q3. 为什么分层渲染，而不是所有批注都画进 Canvas？

**期望关键词：**
- 笔画适合 Canvas；图章/文本框要可点、可输入 → DOM
- 引注要线+框 → SVG + DOM
- 划词跟随文本矩形 → mark-layer / getClientRects
- 按交互形态拆，降低命中与无障碍成本

**危险信号：**
- 「Canvas 性能一定更好所以全用 Canvas」
- 不知道 hit-test / 输入框在 Canvas 上的代价

**参考口述：**  
不全塞 Canvas 是因为交互形态不同。笔画是密集点列，Canvas 合适；图章和文本框要点击、拖拽、编辑文字，DOM 更自然；引注是 tip 到 box 的线加长文本，用 SVG 线 + DOM 框；划词要贴合多行文本的 clientRects，用独立 mark-layer。分层后命中、选中、无障碍都更简单，也避免在 Canvas 里自造一整套 UI 控件。

---

### Q4. `SurfaceMode` 和「Vue 试卷 / HTML 试卷」是什么关系？Vue 上标注为何 `surface: 'html'`？

**追问：** 工具栏选「HTML」是不是只能渲染字符串 HTML？

**期望关键词：**
- SurfaceMode：`image | pdf | html` 管载体与坐标策略
- html 载体下 paperMode：富文本 HTML vs Vue 组件试卷
- Vue 标注仍标 `surface:'html'`：表示答卷类载体，与图片/PDF 区分；划词类型锁死 html

**危险信号：**
- 把 SurfaceMode 和题型组件混为一谈
- 认为 Vue 模式应写成 `surface:'vue'`（与现实现不符）

**参考口述：**  
工具栏的 image/pdf/html 是 SurfaceMode，决定坐标空间和可用工具——划词只在 html。html 下面又分两种答卷渲染：字符串/富文本 HTML，以及 Vue 试卷（PaperMarkingView + topic 组件）。Vue 试卷上的标注 `surface` 字段仍是 `'html'`，表示「答卷类载体」，不是图片页；类型上 highlight/underline 也锁死 html。所以「HTML」不等于「只能用字符串模板」。

---

## B. 数据模型与 Store（必问）

### Q5. `Annotation` 如何建模？为何用 `kind` 判别联合？

**期望关键词：**
- `AnnotationBase` + 各 kind 特有字段
- stamp：`symbol+x,y`；callout：`tip/box`；stroke：`points[]`；划词：强制 `htmlAnchor`
- TS 收窄；序列化友好

**危险信号：**
- 一个大 optional 对象所有字段都可选
- 说不出 callout 与 textbox 的字段差异

**参考口述：**  
公共字段是 id、kind、surface、comment、color、createdAt 等；再用 kind 收窄：stamp 带 symbol 和归一化坐标，textbox 带 text，callout 带 tip/box 两套坐标和可选 tipHtmlAnchor，stroke 是点列，underline/highlight 强制 surface html 加 htmlAnchor。这样 TypeScript 能收窄，持久化也清晰，比一个「所有字段 optional」的大杂烩好维护。

---

### Q6. 为何 `ReviewTool` 和 `AnnotationKind` 不是一一对应？举 `pen` / `select` 为例。

**期望关键词：**
- 工具是交互模式；kind 是持久化形态
- `pen` → 写入 `stroke`；`select` 不落新标注，只选中/拖
- stamp 工具还配合 `stampSymbol` 状态

**危险信号：**
- 「工具名等于数据 kind」
- 不知道 select 不产生新 annotation

**参考口述：**  
工具是当前交互模式，kind 是存盘形态，不必同名。笔工具叫 `pen`，落库是 `stroke`；`select` 不创建标注，只负责点选和拖改位置。图章工具还会带 `stampSymbol`（对/错/半对等）。面试时要把「我现在拿着什么工具」和「库里多了一条什么 kind」分开讲。

---

### Q7. 为何 `annotations` 用 `shallowRef`？增删时怎么触发更新？

**期望关键词：**
- 大批注时避免深代理每个字段
- 更新用整体替换：`annotations.value = [...list, item]`
- 选中、工具等仍可用普通 `ref`

**危险信号：**
- `push` 进数组却期望视图更新（shallowRef 下常常不会）
- 说不清 shallow 与 deep 的取舍

**参考口述：**  
批注列表可能很长，用 `shallowRef` 只追踪 `.value` 替换，不对每个嵌套字段做深响应，减轻开销。因此增删改都是换新数组引用，比如 `[...annotations.value, pin]`，而不是原地 push。工具、选中 id 仍用普通 ref。这是性能取向的状态设计。

---

### Q8. callout 为何两段式 `beginCallout` / `finishCallout`？pin 和 stamp 现在分别什么角色？

**期望关键词：**
- 先点 tip 再点 box；草稿态 `calloutDraftTip` / preview
- 切工具或切 surface 会 cancel draft
- pin：兼容旧草稿/压测，工具栏主推 stamp 图章

**危险信号：**
- 把 callout 说成单击一次就完成
- 简历写「钉针工具」但讲不清已被 stamp 替代的产品事实

**参考口述：**  
引注要「尖端指问题 + 外侧长文本框」，所以第一次点击 `beginCallout` 记下 tip（可带 htmlAnchor），第二次 `finishCallout` 定 box 再 `addCallout`；中途切工具会 cancel。pin 还在类型和 Canvas/DOM 层，多用于兼容与压测；产品工具栏主路径是 stamp 图章。面试要主动说清这个演进，避免简历和 Demo 不一致。

---

## C. 坐标与多载体（必问）

### Q9. 什么是归一化坐标？分母为何是内容框而不是整页含 gutter？

**期望关键词：**
- `x,y ∈ [0,1]` 相对 content-shell / page-frame
- gutter/留白不进分母，换屏缩放更稳
- 渲染时再乘当前宽高 + scale

**危险信号：**
- 全程存 clientX/pageX 像素
- 分母含外边距导致一改布局批注全漂

**参考口述：**  
位置类标注存 0 到 1 的归一化坐标，相对内容框（HTML 的 content-shell 或图/PDF 的 page-frame），不是视口像素。留白 gutter 不进分母，否则一改边距历史批注会漂。显示时用当前内容宽高和 scale 还原成像素。这是多分辨率和导出对齐的基础。

---

### Q10. `toNorm` / 指针落点在阶段层怎么做？scale 如何参与？

**期望关键词：**
- `useHtmlAnnotationStage` 量测 contentBox，client → 相对偏移 / 宽高
- 与 store.scale 配合；拖拽改的是归一化值
- layout 时再映射到各层绝对定位

**危险信号：**
- 把缩放当成改数据坐标（应改视图变换或统一在映射层处理）
- 说不清量测时机（resize / 内容变化要重 layout）

**参考口述：**  
html/Vue 舞台在 `useHtmlAnnotationStage` 里量测 contentBox，把指针 client 坐标减框的 left/top 再除以宽高得到归一化点，写入 Store。scale 主要影响展示映射；拖拽仍然改归一化字段，然后 `layoutAll` 把 stamp/callout/划词矩形算成叠层样式。内容或窗口变化要重新量测，否则会对不齐。

---

### Q11. image / pdf 与 html 载体在交互上有何不同？

**期望关键词：**
- image/pdf：页框上落点；pdfjs 渲页（Demo 侧重第一页）
- html：可划词、文本锚点；切走 html 时 highlight/underline 工具会退回 select
- `pageIndex` 服务多页潜力

**危险信号：**
- 声称 pdf 多页批注已完整产品化（需按 Demo 诚实）
- 在 image 上讲 TreeWalker 划词

**参考口述：**  
image/pdf 是在页面图框上点选落章、画笔，坐标相对 page-frame；PDF 用 pdfjs 渲染，Demo 重点在首页流程。html 才能做基于文本的高亮/下划线；切到非 html 时 Store 会把划词工具打回 select。字段上留了 pageIndex，但面试要按实际完成度讲，不夸多页生产能力。

---

### Q12. 拖拽改位时，带 `htmlAnchor` 的标注和纯 `x,y` 标注策略有何不同？

**期望关键词：**
- 纯坐标：拖完写回归一化 x,y
- 可选 htmlAnchor：希望重排后贴文本；拖拽可能更新锚或退化为坐标
- callout：tip 可锚文本，box 常保持内容归一化

**危险信号：**
- 所有标注都「绑死字符偏移」却在图片页使用
- 忽略重排后 quote 校验

**参考口述：**  
图章、短文本可以只靠 x,y；在 html 上也可附 htmlAnchor，让位置随文本回流。callout 的 tip 可以锚文本，box 多留在内容坐标，避免长评论框跟着每个字跑。拖拽结束后写回归一化点，必要时刷新锚。重排剧烈时要靠 contentHash/quote 发现失效，不能假设偏移永远有效。

---

## D. 划词与 HtmlAnchor（拉开差距）

### Q13. `HtmlAnchor` 是什么？虚拟文本串如何得到？

**期望关键词：**
- `{ start, end, quote }` 字符偏移 + 短摘录
- TreeWalker `SHOW_TEXT` 拼虚拟串
- `rangeToOffsets` / `offsetToRange` 双向映射

**危险信号：**
- 用 DOM 路径 + 子节点 index 当唯一方案却说不出文本偏移
- 把 innerHTML 字符串下标当锚点

**参考口述：**  
划词存的是 HtmlAnchor：在内容根下所有 Text 节点拼成的虚拟串上的 start/end，外加 quote 摘要。`htmlRange` 用 TreeWalker 收集文本节点，`rangeToOffsets` 把选区变成偏移，`offsetToRange` 再还原成 Range 去 `getClientRects` 铺高亮矩形。这样不依赖某一版 HTML 字符串下标，但依赖文本节点序列稳定。

---

### Q14. `caretOffsetFromPoint` 解决什么？和划词选区有何关系？

**期望关键词：**
- 点击落点 → 最近 caret → 全局偏移
- `caretRangeFromPoint` / `caretPositionFromPoint` 兼容
- 用于 pin/落点贴字；划词更常用 Selection/Range

**危险信号：**
- 用元素中心点近似「点到了哪个字」
- 忽略跨浏览器 API 差异

**参考口述：**  
要把鼠标点映射到虚拟串偏移，会用浏览器的 caretRangeFromPoint 或 caretPositionFromPoint 找到 Text 节点和局部 offset，再累加前面文本节点长度得到全局偏移。这对「点在某字附近落锚」有用；完整划词则更多走 Selection 转 Range 再 `rangeToOffsets`。要注意 API 兼容和点在空白处时的空结果。

---

### Q15. 同 kind 划词重叠为何拒绝？`anchorsOverlap` 规则是什么？

**期望关键词：**
- `addHighlight`/`addUnderline` 先 `findOverlappingRangeMark`
- 区间交集（端点相触不算重叠）
- 冲突则选中已有条，`created: false`

**危险信号：**
- 允许任意重叠导致叠层难选、数据重复
- 说不清相触 vs 相交

**参考口述：**  
新增高亮或下划线前会查同 kind 是否与现有 htmlAnchor 相交；`anchorsOverlap` 是区间重叠，仅端点相触不算。若冲突就选中旧标注并返回 `created: false`，避免重复块难点击、侧栏重复。不同 kind（高亮 vs 下划线）可以共存，这是产品选择。

---

### Q16. Vue 组件化试卷对划词有何代价？`contentHash` 干什么？

**期望关键词：**
- 题型组件插入额外文案节点 → 虚拟串与肉眼句子不完全同构
- 答卷 DOM 大改 → 旧偏移失效
- `contentHash`（试卷 JSON 指纹）提示草稿与内容不匹配

**危险信号：**
- 「组件化没有任何副作用」
- 有 hash 字段但从不用来提示失效

**参考口述：**  
Vue 试卷按题型组件渲染，扩展性好，但 TreeWalker 扫到的文本顺序可能含组件内部提示文案，和老师眼中的句子不完全一致。DOM 结构一变，旧 HtmlAnchor 会对错位。所以用 contentHash 标记答卷版本，加载草稿时可发现内容变了。这是组件化换来的锚点脆弱性，面试要主动讲。

---

## E. 性能与命中

### Q17. `useSpatialIndex` + Worker 解决什么问题？

**期望关键词：**
- 网格索引 cellSize；主线程不重建大表
- `queryViewport` + limit；`visibleIds` 控渲染
- 选中 id 强制并入可见集；`hit` 半径命中

**危险信号：**
- 万级针点仍每次全量 filter
- 不知道索引在 Worker

**参考口述：**  
针点多时主线程全量遍历会卡，所以把点丢到 Worker 建网格索引，按视口矩形 query 并带 limit，结果进 `visibleIds` 控制渲染；当前选中强制可见，避免选中对象被裁掉。还支持半径 hitTest。watch pins 会 rebuild。这是「可视区 + 空间桶」而不是每次 O(n) DOM。

---

### Q18. 为何不能只靠暴力遍历做点选/框选？

**期望关键词：**
- O(n) 随批注数线性恶化
- 与滚动、缩放叠在一起掉帧
- 索引把候选限制在局部单元格

**危险信号：**
- 「几十个没问题所以架构不用考虑」却简历写高并发批注

**参考口述：**  
Demo 数据量小时暴力 filter 也能用，但架构上要按「老师可能密密麻麻打点」设计。点选、框选、可视裁剪若每次扫全表，和滚动缩放叠在一起就会掉帧。空间索引先收窄候选再精确距离判断，复杂度更跟视口走。简历如果写了性能优化，就要能讲到这一层。

---

### Q19. AnnotationCanvas 何时重绘？如何避免无脑全量狂绘？

**期望关键词：**
- watch annotations / 宽高 / selectedId / draftPoints
- 笔画与草稿分层或按需 clear+draw
- 与可见集、节流配合；避免空转 rAF

**危险信号：**
- 每个 mousemove 无节流全量重绘
- 用 rAF 空转清屏

**参考口述：**  
Canvas 层主要画 stroke 和部分圆点，应在注解列表、尺寸、选中、草稿点变化时重绘，而不是定时器空转。画笔过程可以用 draftPoints 局部更新，鼠标移动要节流。再往上可以脏矩形或与空间可见集结合少画。先保证「有变化才画」，再谈更细优化。

---

## F. 持久化与导出

### Q20. `AnnotationDraft` 里有哪些字段？为何 Repository 做成 async？

**期望关键词：**
- `homeworkId` / `contentHash` / `annotations` / `updatedAt`（可选 surface）
- localStorage 实现，但 async 便于换 HTTP
- 加载校验数组形态

**危险信号：**
- 「直接存整个 Pinia/模块状态」
- 同步 localStorage API 当唯一终态、无迁移意识

**参考口述：**  
草稿契约是 homeworkId、contentHash、annotations 数组和 updatedAt，可选 surface。现在 save/load/clear 走 localStorage，但函数是 async 的，以后换成接口不用改 Store 调用方式。加载时校验 annotations 是数组，解析失败当没有草稿。contentHash 用来发现答卷内容变了。

---

### Q21. 导出带批注 PDF 的主路径是什么？截图前为何要 expand overflow？

**期望关键词：**
- `modern-screenshot` / domToCanvas → jsPDF 分页
- `beginExportRootLayout`、`expandStageForOverflow` 避免裁切 callout
- prepare/restore 成对，防止污染交互态

**危险信号：**
- 「html2canvas 一下」不谈裁切与还原
- 导出后页面布局坏了不 restore

**参考口述：**  
导出大致是：Surface 提供 export root → prepare 展开 overflow/高度，避免引注框被裁切 → 截成画布 → jsPDF 按页写入 → restore 样式。阶段上还有 `AnnotatedSurfaceExportApi` 的 prepare/restore、relayout。关键是导出临时改布局必须成对恢复，不然用户继续批改时舞台是坏的。

---

### Q22. 为何要 `bakeRangeMarks`？和绝对定位 mark-layer 有何区别？

**期望关键词：**
- 导出时把高亮/下划线烘焙进文本节点 span
- 截图更贴字；可 restore 撤掉 `data-export-bake`
- 交互态仍用叠层矩形，避免改活 DOM

**危险信号：**
- 平时交互也直接改文本 DOM 导致锚点全乱
- 烘焙后不还原

**参考口述：**  
交互态划词用 mark-layer 绝对矩形，不改文本 DOM，锚点稳定。导出截图时绝对层可能和文字对不齐或透明叠加难看，所以 `bakeRangeMarks` 按偏移把 span 打进文本（高亮背景/下划线），截完再 restore。这是「导出态烘焙、编辑态叠层」的分离。

---

### Q23. 分页时「原子块」和 skip annotation chrome 是为了解决什么？

**期望关键词：**
- `ATOMIC_BLOCK_SELECTOR`：选项/表格等尽量不从中切开
- 收集文本行 spans 时跳过批注 UI 与 mark-layer
- 减少「半行在上页、边框劈开」和工具条进 PDF

**危险信号：**
- 按固定像素高度硬切，不管题干块
- 把侧栏、拖拽手柄截进成品

**参考口述：**  
分页不能只按固定像素切：选项区、答案表等原子块应尽量整块留在一页，所以会收集内容行的垂直 span，并避开批注 chrome。收集文本时 skip callout/stamp/mark-layer，避免把工具 UI 当正文。这样 PDF 更像试卷而不是「截了一张带手柄的编辑器」。

---

## G. 工程与软性

### Q24. 这个模块测试你会优先写哪些？为何？

**期望关键词：**
- `htmlRange` 偏移互转；`anchorsOverlap`；`bakeRangeMarks` restore
- `exportAnnotatedPdf` 纯函数（skip chrome、原子块）
- E2E 拖拽/划词冒烟即可；仓库已有 vitest 用例可举证

**危险信号：**
- 全靠手工点 Demo
- 只测 UI 快照不测偏移算法

**参考口述：**  
优先测纯函数：锚点重叠、range 与 offset 互转、烘焙与 restore、导出里收集行高/跳过选择器。这些决定批注对不对、PDF 脏不脏，且不依赖浏览器拖拽。指针和拖拽留少量冒烟。我们目录里已有 htmlRange、overlap、bake、export 的测试，面试可以点名。

---

### Q25. 若要把 Demo 推进生产，你最先补哪三块？

**期望关键词：**
- 后端草稿 API + 权限；contentHash 冲突合并策略
- 撤销栈；PDF 多页完备
- 表达式/性能：索引用于所有 hit，不只是 pin

**危险信号：**
- 一上来微前端重构无业务收益
- 否认 Demo 与生产差距

**参考口述：**  
我会先补：真正的保存接口和权限、草稿与 contentHash 冲突提示；编辑撤销；PDF/图片多页与导出稳定性。其次把空间索引从针点场景推广到更通用的命中。先不急着微前端化——交互正确和数据可靠比壳子重要。

---

### Q26. 简历上批注能力怎么写才诚实？

**期望关键词：**
- 「多载体批注舞台 + 归一化坐标 + 文本锚点划词 + 分层渲染 + 本地草稿/导出 PDF」
- 写清 Demo/练习项目边界
- 不写未做的实时共编、完整评分流

**危险信号：**
- 「自研在线阅卷平台」无后台证据
- 把 pin 当主功能或夸大多页 PDF

**参考口述：**  
我会写成：实现作业批阅批注 Demo，支持图片/PDF/HTML（含 Vue 试卷）多载体；归一化坐标与 HtmlAnchor 划词；图章/引注/画笔分层渲染；Worker 空间索引；localStorage 草稿与截图导出 PDF。明确是前端专题 Demo，避免「已上线阅卷平台」这种面试一挖就穿的表述。

---

### Q27. 这段代码你最不满意哪里？现在怎么改？

**期望关键词：**
- 举例：全量替换数组无命令式 undo；划词对 DOM 结构敏感；PDF 多页不完整
- 改进路径具体到文件

**危险信号：**
- 「都很完美」或空洞「重构一下」

**参考口述（示例，请换成你的真实想法）：**  
我不太满意两点：一是 Store 没有命令式撤销，误删只能靠草稿；二是划词强依赖文本节点序列，Vue 题型一改文案节点就可能漂，需要更强的 quote 校验或语义锚点。改进会先做操作栈，再给锚点加 quote 校验与失效提示，而不是先大拆目录。

---

### Q28. 讲一次批注相关排障：复现 → 证据 → 根因 → 回归

**期望关键词：**
- 具体现象（错位/重叠/导出裁切/烘焙残留）
- 缩小 case；对照 contentBox 与锚点
- 单测或导出 restore 防回归

**危险信号：**
- 模板化「我百度了」无项目细节

**参考口述（框架 + 可替换案例）：**  
答法：现象 → 复现步骤 → 假设 → 日志/量测证据 → 根因 → 单测。案例 A：导出后引注框被裁，发现 stage overflow hidden，补 expandStageForOverflow 且 restore。案例 B：划词点两次生成重叠块，补 anchorsOverlap 与 created:false。案例 C：烘焙后文字节点变了导致再次划词偏移错，强调 restore 与测试。用你真实修过的那条讲证据链。

---

## 自测清单（面试前 15 分钟）

- [ ] 能画出：Shell → Surface → Store → Canvas/Markers/Callouts/mark-layer → Repository
- [ ] 能说清：工具 vs kind、SurfaceMode vs Vue/HTML 试卷
- [ ] 能手写：归一化坐标为何不含 gutter；HtmlAnchor 三字段
- [ ] 能讲：callout 两步；划词 overlap；spatial Worker 在干什么
- [ ] 能讲：导出 expand + bake + skip chrome + restore
- [ ] Q26–Q28 已改成自己的表述与真实 bug

---

## 推荐口述优先级（45 分钟项目深挖）

| 时段 | 题目 |
|------|------|
| 0–5 min | Q1、Q2 |
| 5–15 min | Q3、Q5、Q6、Q9 |
| 15–30 min | Q8、Q13、Q15、Q16 |
| 30–40 min | Q17、Q21、Q22 |
| 40–45 min | Q24、Q26、Q27 |

---

## 对照阅读

- 总览精读：[src/features/homework-review/INTERVIEW.md](./src/features/homework-review/INTERVIEW.md)
- Vue 试卷专项：[src/features/homework-review/VUE_PAPER_ANNOTATION_HANDOFF.md](./src/features/homework-review/VUE_PAPER_ANNOTATION_HANDOFF.md)
- 低代码编辑器题库：[INTERVIEW_QUESTIONS.md](./INTERVIEW_QUESTIONS.md)
