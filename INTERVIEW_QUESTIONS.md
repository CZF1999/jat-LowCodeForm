# 低代码项目面试题库（5 年前端 · 项目深挖）

> 举证仓库：`editorStore` / `schema/types` / `renderer` / `FormConfigGenerator` + `homework-review`  
> 用法：对着题干口述 1–2 分钟 → 对照「期望关键词」查漏 → 避开「危险信号」  
> **自测建议：先遮住「参考口述」自己说一遍，再对照；把话术改成你自己的措辞，勿整段背诵。**

---

## 面试官推进节奏

1. 30 秒项目定位（业务价值 + 你的职责边界）
2. 架构主线（Schema / Store / 渲染 / 导出）
3. 3–4 个硬核实现深挖（拖拽、撤销、生成器、嵌套容器）
4. 工程权衡与演进（性能、协作、扩展）
5. 简历写了批阅 Demo 再问：空间索引 / Canvas / PDF

| 通过线 | 挂科线 |
|--------|--------|
| 能讲清为什么这样设计、放弃了什么、线上会出什么问题 | 只会复述「三栏 + 拖拽」，说不清 Schema 协议、历史栈边界、导出与渲染关系 |

---

## A. 开场与架构（必问）

### Q1. 用 1 分钟介绍这个低代码平台：解决什么问题？和 Formily / 内部表单配置平台比，你的边界在哪？

**追问：** 你们交付物是「可维护源码」还是「运行时配置」？谁消费导出结果？

**期望关键词：**
- 表单设计器 / Schema 驱动 / 三栏（物料·画布·属性）
- 导出通道：Schema JSON、Vue SFC、JS/TS FormConfig、校验规则
- 边界诚实：设计态编辑器 + 配置/代码导出；不是完整 Formily 运行时协议生态

**危险信号：**
- 吹成「企业级低代码平台 / 对标钉钉宜搭」却说不出运行时渲染器、权限、发布流水线
- 分不清「设计器」和「表单引擎」

**参考口述：**  
这是一个 Schema 驱动的表单低代码设计器，技术栈 Vue3 + TS + Pinia + Element Plus + vuedraggable。核心解决的是：业务同学或前端用可视化方式拼表单，再导出给工程消费。界面是经典三栏——左侧物料、中间画布、右侧属性。交付物不是单一形态：可以导出 Schema JSON 持久化，也可以导出 Vue SFC 源码，或 JS/TS 的 FormConfig、校验规则，给运行时动态表单用。和 Formily 比，我这边重心在「设计器 + 多通道导出」，没有做成完整的表单协议生态和运行时引擎；边界就是设计态编辑与配置/代码产出，真正的权限、发布流水线、通用渲染器还没做成平台级能力。

---

### Q2. 为什么坚持 Schema 驱动？`PageSchema` / `ComponentSchema` 里哪些是「协议」，哪些是「编辑器私货」？

**追问：** `selectedId`、`clipboard` 为什么不进 Schema？`events` 存 Function 对序列化意味着什么？

**期望关键词：**
- 协议：`version` / `info` / `settings` / `components[]`；节点 `id/type/label/props/styles/children/validation`
- 编辑器私货：`selectedId`、`clipboard`、拖拽态、历史栈
- UI = render(Schema)；多读者（画布 / 预览 / 生成器）共用一份真相源
- 深拷贝用 JSON → Function / 循环引用需注意（`events` 实际多为空对象）

**危险信号：**
- 把 Pinia 全量 state 都说成 Schema
- 说「Schema 就是 Vue 组件」

**参考口述：**  
坚持 Schema 驱动是因为 UI 可以看成 `render(Schema)`：画布、预览、代码生成、FormConfig 导出都是同一份 JSON 的不同读者，方便持久化和传输。协议层是 `PageSchema` 的 `version/info/settings/components`，以及节点上的 `id/type/label/props/styles/children/validation` 等。编辑器私货比如 `selectedId`、`clipboard`、历史栈，只服务交互，不进可导出协议。类型里 `events` 写成了 Function，但我们历史快照用 JSON 深拷贝，函数会被丢掉，所以实践里 events 基本是空对象，真正要持久化行为会改成字符串表达式或导出时再生成——这也是协议和实现要诚实对齐的点。

---

### Q3. 设计态、预览态、代码生成、表单配置导出，如何共享同一份数据？若两套渲染器你会怎么取舍？

**追问：** `ComponentRenderer` 如何用 `selectedId` 区分设计/预览？

**期望关键词：**
- 同一 `pageSchema`；设计态 `CanvasRenderer`+draggable；预览 `selectedId=null`
- CodeGenerator / FormConfigGenerator 是额外「读者」，只读 Schema
- 单渲染器：所见即所得、少分叉；双渲染器：预览可更轻，但易漂移

**危险信号：**
- 说设计态和预览「两套互不相关的 DOM」
- 说导出「重新手写一份模板，不看 Schema」

**参考口述：**  
真相源只有 Store 里的 `pageSchema`。设计态用 `CanvasRenderer` 包一层 vuedraggable，里面还是 `ComponentRenderer`；预览把 `selectedId` 置空，同一渲染器去掉选中框和操作按钮。CodeGenerator、FormConfigGenerator 不渲染 DOM，只遍历 Schema 产出字符串或配置对象。我们选单渲染器是为了所见即所得、减少两套模板漂移；如果预览要极致轻量或运行在无编辑依赖的环境，可以再拆预览渲染器，但必须用同一套 Schema fixture 做契约测试，否则设计态和预览会慢慢不一致。

---

### Q4. Pinia 里为什么几乎没有 `addComponent` / `moveComponent`，却把增删排序交给 vuedraggable？

**追问：** 那 Store 还负责什么？拖入后历史谁记？

**期望关键词：**
- vuedraggable 直接 `v-model` 改 `pageSchema.components`（splice/push）
- Store：选中、删除、属性更新、剪贴板、历史、导入导出
- `@change` → `saveHistory()`；职责切在「库擅长的交互」vs「业务状态」

**危险信号：**
- 「全部操作都必须走 Store action」教条，却说不清为何拖拽例外
- 不知道画布绑定的是 Store 里的数组引用

**参考口述：**  
画布 `<draggable v-model="editorStore.pageSchema.components">`，拖入和排序由库直接 splice/push 响应式数组，我不在 Store 再包一层 `add/move`，避免和 Sortable 内部操作抢控制权。Store 负责选中、删除、属性更新、剪贴板、导入导出和历史。拖拽结束后 `@change` 里调用 `saveHistory()`，这样交互交给库、业务状态留在 Store，边界清楚。教条说「一切必须走 action」在拖拽场景会把简单问题复杂化。

---

## B. 拖拽与交互（必问 · 项目招牌）

### Q5. 物料 → 画布为何用 `group + pull:'clone' + :clone`，而不是 HTML5 DnD 自算插入位？

**追问：** `put:false` / `:sort="false"` 各自防什么？

**期望关键词：**
- 同名 group 打通两端；物料端 clone、画布端接收并排序
- 插入位、ghost、动画交给 Sortable（vuedraggable 底层）
- 旧方案：dataTransfer 序列化 + 手算 insertionIndex + 双引擎状态多

**危险信号：**
- 只会说「用了 vuedraggable」说不出 group/clone 语义
- 把 clone 理解成「深拷贝整个物料注册表」

**参考口述：**  
物料和画布共用 `group: 'components'`。物料端 `pull: 'clone'`、`put: false`、`:sort="false"`：拖出去是克隆、不接受回拖、列表本身不排序；画布端接收并排序。自定义 `:clone` 返回带新 id 的组件实例，插入位置、ghost、动画交给底层 Sortable。以前 HTML5 DnD + 手算 insertionIndex、还要维护 isDragging 等状态，数据和指示线都容易抖。现在数据直接是对象 clone，不再走 dataTransfer 序列化。

---

### Q6. `cloneMaterial` 里为何必须 `generateId()`？`props`/`styles` 为何浅拷贝而不是引用 `defaultProps`？

**追问：** 若 `defaultProps.options` 是数组，浅拷贝够不够？

**期望关键词：**
- 每次拖入新实例，id 冲突会搞乱 `item-key` / 选中 / 删除
- 浅拷贝让每实例有独立 props/styles 根对象
- 嵌套引用（options 数组）仍可能共享 → 应用层需注意或深拷贝关键字段

**危险信号：**
- 「id 用 type 就行」
- 「直接引用 defaultProps 反正一样」

**参考口述：**  
每次从物料拖入都要新实例，`item-key="id"`、选中、删除都靠 id；若复用 type 当 id，多个 Input 会互相打架。`props`/`styles` 用浅拷贝是为了每个实例有自己的根对象，改一个不会改到物料默认值或其他实例。但浅拷贝对嵌套数组不够：`options` 这类引用仍可能共享，改选项会串数据，关键嵌套字段应该深拷贝或结构化 clone——这是我知道的现有简化点。

---

### Q7. 为何排序用 `.drag-handle`，而不是整卡可拖？和选中/编辑如何共存？

**期望关键词：**
- 点击内容区 = 选中；手柄 = 排序意图
- `handle=".drag-handle"` 限制触发区，避免和输入/点击冲突
- hover 显示手柄（UX）

**危险信号：**
- 说「整卡拖更方便」却不谈误拖与表单控件冲突

**参考口述：**  
设计态里点击组件是选中、点控件是交互，如果整卡可拖，很容易和点击、输入抢手势。所以 vuedraggable 配 `handle=".drag-handle"`，只有左侧手柄才能排序；手柄默认隐藏、hover 显示。意图分离之后，选中和排序可以共存，误拖会少很多。

---

### Q8. 从「双引擎」收敛到 vuedraggable 统一，触发原因？物料面板为何从真实控件改成图标？

**期望关键词：**
- 物料区真实 Element Plus（slider/rate/switch）的 mousedown 与 Sortable 抢事件
- 图标化后可用统一 group clone；Store 去掉 isDragging/insertionIndex 等
- 问题驱动重构，不是为了换库而换库

**危险信号：**
- 「vuedraggable 更新潮」而无冲突故事
- 否认曾有双引擎/手算插入

**参考口述：**  
早期物料→画布用 HTML5 DnD，画布内排序用 Sortable，等于双引擎，还要手算插入位、在 Store 里堆拖拽状态。直接冲突是：物料区渲染真实 slider/rate/switch，它们的 mousedown 和拖拽库抢事件。后来物料改成图标预览，消除冲突源，两端统一 vuedraggable group clone，Store 也瘦身掉 isDragging、insertionIndex 等。这是问题驱动的收敛，不是为了追新库。

---

### Q9. 嵌套容器（block/subform）若要支持跨层拖入，当前架构哪里先炸？你怎么改？

**期望关键词：**
- 根画布一组 draggable；容器内需各自 draggable + 明确 put/group 规则
- `childrenTypes` 校验；跨层移动要改父 `children` 而非只改根数组
- 历史栈仍要在结构变更时 `saveHistory`
- 递归删除/更新已有，但「跨容器 move」是缺口

**危险信号：**
- 「加个 group 名就行」不谈数据结构与校验
- 完全没意识到容器是递归 `children`

**参考口述：**  
现在主要是根级 `components` 一条 draggable；容器虽有 `children`，跨层拖入并不完整。要支持的话，每个容器内部也要 draggable，group/put 规则要配好，并用 `childrenTypes` 做白名单。数据上移动的是「从旧父 children 删除、插入新父 children」，不能只改根数组。删除/更新已经递归了，缺的是结构化 move + 每次结构变更 `saveHistory`。只改 group 名不改数据模型一定会炸。

---

## C. 状态、撤销与响应式（必问）

### Q10. 用 past/future 双栈讲 undo/redo；为何 `canUndo` 要求 `past.length > 1`？

我们用两个栈实现：past 栈（过去状态）和 future 栈（未来状态）。
记录操作：每次用户完成操作（新增、修改属性等），将当前页面配置深拷贝后推入 past 栈，同时清空 future 栈。
撤销：若 past 栈不为空，先将当前状态推入 future 栈，然后弹出 past 栈顶并赋值给当前页面。
重做：若 future 栈不为空，先将当前状态推入 past 栈，然后弹出 future 栈顶并赋值给当前页面。
按钮禁用状态分别由 past 栈和 future 栈是否为空来控制。

---

### Q11. `saveHistory` 为何每次清空 `future`？Undo 两次再改属性，重做分支怎么处理？

**期望关键词：**
- 新分支产生，旧 future 失效（标准编辑器语义，类似撤销树剪枝）
- 操作顺序：Undo×2 → updateComponent → future=[] → 无法 redo 回被剪掉的分支

**危险信号：**
- 「future 应永远保留所有历史」
- 说不清分支丢弃

**参考口述：**  
Undo 之后如果用户做了新编辑，时间线分叉了；标准编辑器会丢掉旧的重做分支，所以 `saveHistory` 里 `future = []`。例如 Undo 两次再改属性：那两次被撤销的状态进过 future，但新操作一来 future 清空，就不能 Redo 回旧分支了。这是有意的剪枝，不是丢数据 bug。

---

### Q12. 深拷贝：`JSON` vs `structuredClone` vs 不可变结构共享，大表单 200+ 字段瓶颈在哪？

**追问：** 你们现在 `cloneSchema` 用的是什么？

**期望关键词：**
- 现状：`JSON.parse(JSON.stringify)`；丢 Function/undefined/Date 特殊类型
- structuredClone：更完整，仍是全量拷贝成本
- 生产向：命令式 undo / JSON Patch / 结构共享 immer；瓶颈在每次编辑全量拷贝 + maxSize 份内存
- `maxSize=50` 是粗限流

**危险信号：**
- 「深拷贝没有性能问题」
- 一上来就 CRDT 却讲不清单机瓶颈

**参考口述：**  
我们现在 `cloneSchema` 是 `JSON.parse(JSON.stringify)`，实现简单，但函数、undefined、特殊类型会丢，大 Schema 每次编辑都全量拷一份。`structuredClone` 更完整，成本仍是 O(整树)。200+ 字段时瓶颈是：频繁全量快照 × `maxSize=50` 的内存和主线程卡顿。生产上我会倾向命令式 undo 或 JSON Patch，让成本跟操作走；结构共享也可以，但要先解决单机快照成本，不必一上来上 CRDT。

---

### Q13. `updateComponent` 用 `Object.assign` 而非替换整节点，对 Vue 响应式意味着什么？

**追问：** undo 时 `Object.assign(this.pageSchema, previousState)` 要注意什么？

**期望关键词：**
- 原地合并，保持同一对象引用，依赖该引用的视图继续响应
- 整节点替换可能让持有旧引用的逻辑「看着没更新」
- undo 赋整页时：嵌套数组/对象引用替换要理解 Vue 对对象属性的响应式边界
- 选中用 `selectedId`（id）而非对象引用，规避悬空引用 —— 这是加分说法

**危险信号：**
- 「Object.assign 和替换完全没区别」
- 把选中状态建成对 component 对象的直接引用且不自知风险

**参考口述：**  
更新时在树里找到节点后 `Object.assign(component, updates)`，改的是同一响应式对象上的字段，依赖它的界面会更新；如果整节点换成新对象，外面若还握着旧引用就会「改了没反应」。Undo 是对 `pageSchema` 根做 `Object.assign`，嵌套的 `components` 数组会换成快照里的新引用，依赖根上该属性的视图没问题。我们选中用 `selectedId` 字符串，不持有组件对象引用，避免撤销后悬空——这点是有意的。

---

### Q14. 快捷键为何先 `isInputFocused()`？属性面板输入时如何防误触撤销？

**期望关键词：**
- 焦点在 INPUT/TEXTAREA/SELECT/contentEditable 则直接 return
- 快速失败，避免 Ctrl+Z 变成「撤销整个画布」而非输入框本地撤销
- 与 EditorPage 全局 keydown 绑定相关

**危险信号：**
- 「用 preventDefault 就行」不判断焦点
- 不知道属性面板输入场景

**参考口述：**  
EditorPage 挂了全局 keydown 做 Ctrl+Z/Y、删除、复制粘贴。属性面板里改文案时，浏览器本地撤销和画布撤销会冲突，所以先判断焦点是否在 INPUT/TEXTAREA/SELECT 或 contentEditable，是就直接 return。这是快速失败：输入场景不进任何编辑器快捷键分支，比每个 case 里散落判断更清晰。

---

## D. 物料、属性面板与协议设计

### Q15. `MaterialMeta` 的 `propsSchema` / `defaultProps` / `isContainer` / `childrenTypes` 各解决什么？新增「远程搜索 Select」要改几处？

**期望关键词：**
- propsSchema：属性面板可描述；defaultProps：clone 初值；isContainer：是否 children；childrenTypes：白名单
- 改动面：materials 注册、ComponentRenderer 映射、PropertyPanel 专用项、FormConfigGenerator/CodeGenerator 导出分支、类型定义

**危险信号：**
- 「只加一个 Vue 文件」
- 忘掉导出通道会导致设计态有、导出无

**参考口述：**  
`propsSchema` 描述可配属性，`defaultProps` 是拖入初值，`isContainer` 决定有没有 children，`childrenTypes` 限制能塞什么。加远程搜索 Select，至少要动：物料注册、画布/渲染映射、属性面板远程配置 UI、FormConfigGenerator 和 CodeGenerator 的导出分支，以及类型。只加一个 Vue 文件会出现设计态能拖、导出没有或运行时不认的断裂。

---

### Q16. 属性面板如何避免同一 prop 在通用区与高级区重复编辑？

**期望关键词：**
- `SKIP_PROPS`：span/fieldName/pidField/visibleCondition/options* 等走专用 UI
- `visibleProps` 过滤后再按类型渲染通用控件

**危险信号：**
- 「靠约定不传重复字段」无机制

**参考口述：**  
属性面板有布局区、高级区、选项区等专用块。通用区用 `visibleProps` 遍历 props，但先用 `SKIP_PROPS` 滤掉 span、fieldName、pidField、visibleCondition、options 相关字段，避免同一配置出现两处、改一处丢一处。这是显式机制，不是靠开发约定。

---

### Q17. `FieldConfig` 的 `visible` / `options` 存函数体字符串，运行时如何安全执行？XSS / eval 怎么谈？

**期望关键词：**
- 设计时存字符串；导出 `toJS` 写成真实源码函数，避免 JSON 里再 eval
- 若运行时动态执行：新 Function 白名单、沙箱、禁止访问全局；更稳是服务端校验 + 受限表达式 DSL
- 不可信租户配置 ≠ 内部运营配置，威胁模型不同

**危险信号：**
- 「直接 eval 最方便」
- 完全否认风险

**参考口述：**  
设计器里可见性、异步 options 常存成函数体字符串；导出走 `toJS` 时识别代码表达式，写成真正的 JS 函数源码，业务打包后是正常代码，不必对 JSON eval。若配置要在线动态执行，威胁模型就变了：内部运营配置和租户自定义不是一回事。更稳是受限 DSL 或服务端校验；万不得已用 `new Function` 也要白名单参数、禁全局，而不是裸 eval。

---

### Q18. Schema 有 `conditions` / `loops`，画布是否真正实现？如何表达设计能力 vs 完成度？

**期望关键词：**
- 诚实：类型预留，画布/生成器未必全链路跑通
- 表达：协议先演进、MVP 先表单字段；下一步条件可见与列表字段
- 与 `visible` 函数字符串等已有能力区分

**危险信号：**
- 简历写「支持条件渲染/循环」细节一问就崩
- 或贬低自己「都是抄的」而无协议设计叙述

**参考口述：**  
类型里预留了 `conditions`/`loops`，但画布和生成器并没有全链路产品化，我会在面试里明确说这是协议预留。MVP 先做字段级表单和导出；可见性已有函数字符串这条路径，和完整条件树、循环列表不是一回事。简历我会写成「Schema 预留条件/循环扩展点」，而不是「已支持条件渲染」，把设计能力和完成度分开讲。

---

## E. 代码生成与导出（拉开差距）

### Q19. Vue SFC 字符串拼接 vs AST/模板引擎？为何选拼接？

**期望关键词：**
- 目标是可读源码字符串，不是 SSR DOM
- 拼接：快、控输出、依赖少；AST（babel）：结构变换强、成本高
- 阶段匹配：组件类型有限时 switch 拼接足够

**危险信号：**
- 「字符串拼接不专业所以错」教条
- 说不清产出是 SFC 文本

**参考口述：**  
CodeGenerator 的目标是输出可读的 Vue SFC 文本，不是 SSR。组件类型有限，用 switch 拼 template/script/style 足够快、好控、依赖少。上 AST 适合大规模变换和格式化保证，但现阶段成本高于收益。拼接不「低级」，要看产物是源码字符串这个目标是否匹配。

---

### Q20. `toJS` 为何不能 `JSON.stringify`？如何区分代码表达式与普通字符串？

**期望关键词：**
- JSON 不能表达函数；键会强制引号；无法直接得到可运行 JS 模块
- `isCodeExpression`：trim 后以 `(` / `async` / `function` 开头则原样输出
- 合法标识符作 key 不加引号

**危险信号：**
- 「JSON.stringify 再 replace 掉引号」
- 不知道函数字段的存在

**参考口述：**  
FormConfig 里有函数体字段，JSON 只能当字符串存，还带强制双引号键，不能直接当 JS 模块用。所以自研 `toJS`：普通字符串加引号；`isCodeExpression` 判断 trim 后是否以 `(`、`async`、`function` 开头，是则原样输出成代码；合法标识符 key 不加引号。这才能得到可运行的 JS/TS 配置源码。

---

### Q21. 容器导出如何 flatten 成 `fields[]`？button/divider 为何忽略？

**期望关键词：**
- `CONTAINER_TYPES`：subform/block 递归 `collectFields`
- 只收集表单字段类型；展示/操作类不进 FormConfig.fields
- 与运行时动态表单消费模型对齐

**危险信号：**
- 「所有组件平级导出成 field」
- 忽略递归

**参考口述：**  
导出 FormConfig 时，`subform`/`block` 在 `CONTAINER_TYPES` 里，递归展开 children 收集字段；input/select 等进 `fields`，button、divider、静态文本这类不进，因为运行时动态表单消费的是字段模型，不是画布上所有视觉节点。漏掉递归的话，容器里的字段会丢。

---

### Q22. 业务只要可渲染配置不要 SFC，如何避免设计器 Schema 与 FormConfig 漂移？

**期望关键词：**
- 单一生成器为契约；CI 快照测试；version + migration
- 设计器字段变更必须改 generator 与运行时消费方
- 契约测试：给定 Schema fixture → 期望 FormConfig

**危险信号：**
- 「两套手工同步文档」
- 认为导出一次就永远不用管兼容

**参考口述：**  
把 `FormConfigGenerator` 当成唯一契约：设计器改字段必须改生成器和运行时消费方。CI 用 Schema fixture 做快照测试，防止静默漂移；再用 `version` + migration 管旧数据。不靠两份文档手工同步，也不假设「导出一次就永远兼容」。

---

## F. 工程化、性能与系统设计（5 年档）

### Q23. 大页面下 `maxSize=50` 全量快照，如何改成 patch / 命令式 undo？

**期望关键词：**
- Command：Add/Remove/Update/Move，undo 执行逆命令
- 或 JSON Patch / 结构化 diff；内存从 O(n×快照) → O(操作)
- 复合手势（拖拽结束一次）要合并为一条命令
- 与现有 `saveHistory` 调用点对齐

**危险信号：**
- 只说「加大 maxSize」
- 说 immer 却讲不清与命令栈关系

**参考口述：**  
现在每次编辑全量深拷贝，50 份上限只是粗限流。我会改成命令式：Add/Remove/Update/Move，undo 执行逆操作，或存 JSON Patch；成本跟操作走。拖拽这类手势在 `@change` 结束时合并成一条命令，对齐现有 `saveHistory` 调用点。只加大 maxSize 治标不治本。

---

### Q26. 编辑器做成微前端/npm 包嵌入中台，拆哪些公共 API？

**期望关键词：**
- 输入：初始 Schema、物料注册表、只读/权限
- 输出：onChange(Schema)、exportFormConfig、validate
- 样式隔离；Element Plus 是否外置 peer；不暴露内部 Store 细节

**危险信号：**
- 「把整个 Vite 应用 iframe 嵌进去」当唯一答案且无 API 设计

**参考口述：**  
对外 API 我会收成：入参初始 Schema、可注册物料、只读/权限；出参 `onChange(schema)`、`exportFormConfig`、`validate`。内部 Pinia 不外溢。样式要隔离，Element Plus 作 peer 避免双份。iframe 嵌整站可以作过渡，但正式嵌入仍要稳定 API，否则宿主没法集成。

---

### Q28. 批注数据模型？多 surface（Vue 试卷 / HTML / 图片 PDF）如何统一坐标？

**期望关键词：**
- Annotation 分 kind（pin/stamp/stroke…）；按 surface/page 隔离
- 归一化坐标（相对内容盒 0–1）优于裸像素，便于缩放/导出
- HTML 还需 range/锚点（`htmlRange`）防重排漂移

**危险信号：**
- 全程 pageX/pageY 绝对像素且无视缩放
- 三种 surface 三套互不相通的数据结构却声称「统一」

**参考口述：**  
批注按 kind 区分 pin/stamp/stroke 等，并按 surface、页码隔离。坐标尽量相对内容盒归一化到 0–1，缩放和导出才稳；裸 pageX/pageY 一缩放就飘。HTML 表面还要文本锚点（`htmlRange`），否则重排后面针会对错字。统一的是数据模型与坐标约定，不是三套互不相干的结构硬说统一。

---

### Q32. 这个项目你独立负责哪一块？哪段代码最不满意，现在怎么改？

**期望关键词：** 清晰边界；具体文件；改进点（命令式 undo / 容器拖拽 / 生成器契约测试）

**危险信号：** 「都是我做的」细节全虚；或只会抱怨没有不满

**参考口述（框架 + 示例话术，请改成你的真实分工）：**  
答法：先划边界（例如「编辑器 Store/拖拽收敛/导出我主导，批阅是同仓库另一块」）→ 举一个具体文件 → 说不满与改法。示例：我最不满意 `editorStore` 全量 JSON 快照撤销，大表单会吃内存；下一步会改成命令式 undo，并给 `FormConfigGenerator` 加 Schema→FormConfig 快照测试。容器跨层拖拽也还没做完，那是明确缺口而不是「没有不满」。

---

### Q33. 若产品要「运行时低代码」而不只是「设计器导出」，你缺的最大一块是什么？

**期望关键词：**
- 运行时渲染器 + 表达式/联动引擎 + 数据源/权限 + 发布与版本
- 现有 FormConfig 是起点，缺完整 runtime 与生态

**危险信号：** 「已经是运行时低代码」与仓库能力不符

**参考口述：**  
现在强项是设计器与多通道导出，FormConfig 只是运行时的起点。要做成运行时低代码，最大缺口是：稳定的动态渲染器、表达式/联动引擎、数据源与权限，以及发布版本体系。没有这些，就还是「设计态工具」，不能宣称已经是运行时低代码平台。

---

### Q34. 讲一次被拖拽/历史/生成器坑到的具体 bug 与排查路径

**期望关键词：** 复现 → 假设 → 证据（日志/断点/缩小 case）→ 根因 → 回归

**危险信号：** 故事套模板无项目细节；或把「查文档换 API」当深度排查

**参考口述（框架 + 可替换案例，请换成你真实经历）：**  
答法按：场景 → 复现步骤 → 假设 → 怎么验证 → 根因 → 如何防回归。可替换案例 A（拖拽）：物料区真实 Switch 与 Sortable 抢 mousedown，表现为拖不动或滑块误触；缩小到只留 Switch 复现后改图标预览并统一 vuedraggable。案例 B（历史）：属性面板输入时 Ctrl+Z 撤了整页，因为全局快捷键没判断焦点；补上 `isInputFocused` 快速失败。不要编造加班情节，用你确实排过的问题讲证据链。

---
