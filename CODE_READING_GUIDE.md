# 低代码编辑器 — 渐进式代码阅读指南

> 目标：从零掌握整个项目，足以应对面试中的架构、实现细节、技术决策等问题。

---

## 阅读前置：5 分钟了解项目全貌

这是一个 **Schema 驱动的低代码表单编辑器**，核心理念是"一切围绕 PageSchema（JSON 数据）运转"。

**一句话概括**：用户从左侧物料库拖拽组件到画布，右侧属性面板编辑配置，最终导出为 Vue 3 SFC 代码 或 JS 表单配置文件。

**核心数据流**：
```
物料面板 ──drag──▶ 画布 ──▶ Store (pageSchema.components)
                         │
               ┌─────────┼─────────┐
               ▼         ▼         ▼
          Schema导出  JS配置导出  Vue SFC代码
```

技术栈：Vue 3 (Composition API) + Pinia + Element Plus + Vite，共 ~2000 行核心代码。

---

## 第一阶段：理解数据模型（1 小时）

> **面试考点：Schema 驱动架构、数据模型设计**

### 阅读顺序

#### 1.1 先看类型定义（入口，最重要）

**文件**：`src/core/schema/types.ts`（106 行）

这个文件定义了整个系统所有模块都能理解的"协议"。你需要弄清楚：

| 接口 | 用途 | 面试要点 |
|------|------|---------|
| `ComponentSchema` | 单个组件的完整描述 | id/type/label/props/styles/children 字段的意义 |
| `PageSchema` | 整个页面的描述 | version/info/settings/components 三层结构 |
| `FieldConfig` | 表单字段导出配置 | key/label/type/span/visible/options/rules |
| `FormConfig` | 表单配置导出顶层结构 | 以 formKey 为 key 的对象 |
| `MaterialMeta` | 物料元数据 | propsSchema/defaultProps/isContainer/childrenTypes |

**关键理解点**：
- `ComponentSchema.children` 支持容器组件递归嵌套（subform/block）
- `FormConfig` 是新导出通道（JS 配置导出），与 CodeGenerator（Vue SFC 导出）平级
- `MaterialMeta.isContainer` 决定组件是否可以接收子组件

#### 1.2 再看 Store（数据中枢）

**文件**：`src/stores/editorStore.js`（283 行）

这是整个编辑器的"大脑"。你需要掌握：

**State（状态）**：
- `pageSchema` — 唯一的真相来源（对应 PageSchema 类型）
- `selectedId` — 当前选中的组件 ID
- `dragType` / `insertionIndex` — 拖拽排序的状态
- `history.stack` + `currentIndex` — 撤销/重做的实现（深拷贝快照，上限 50 条）
- `clipboard` — 复制粘贴缓冲区

**关键 Actions**：
```
addComponent(component) → push 到 components[] + saveHistory() + 选中
insertComponentAt(component, index) → splice 到指定位置（支持排序拖入）
moveComponent(id, toIndex) → 从原位置取出，插入新位置
deleteComponent(id) → 递归查找删除（包括容器内子组件）
updateComponent(id, updates) → Object.assign 合并更新
undo() → currentIndex-- 后 Object.assign 恢复快照（注意是 Object.assign 而非赋值，保持响应式）
```

**面试重点**：
- `saveHistory()` 的截断逻辑：`currentIndex < stack.length - 1` 时丢弃后面的分支（标准撤销栈行为）
- `updateComponent` 使用 `Object.assign` 而非替换整个对象，保证 Vue 响应式正常工作
- 为什么使用 JSON 深拷贝而非 structuredClone？（历史原因 + 兼容性）

#### 1.3 最后看物料注册中心

**文件**：`src/materials/index.js`（936 行，但大量是重复的数据定义，核心逻辑只有 ~50 行）

**阅读策略**：不要逐行读 16 种物料定义！重点看：
1. 一种简单物料（如 `input`，约第 101-157 行），理解 `propsSchema` / `defaultProps` / `defaultStyles` 的结构
2. 一种容器物料（如 `block`，约第 8-53 行），注意 `isContainer: true` 和 `childrenTypes`
3. 一种有高级属性的物料（如 `select`，约第 407-481 行），注意 `pidField`/`optionsType`/`optionsApi`
4. 导出的 API 函数（约第 901-935 行）：`getMaterials()`/`getMaterialByType()`/`registerMaterial()`/`unregisterMaterial()`
5. `materialComponents` 映射表（约第 901-905 行）：只有 button/input/block 有 .vue 文件实现

**面试要点**：物料系统采用"元数据 + 默认值"分离设计，拖入画布时使用 defaultProps 创建实例。

---

## 第二阶段：理解渲染引擎（1.5 小时）

> **面试考点：设计态/预览态共享渲染器、Props 控制模式切换**

### 阅读顺序

#### 2.1 核心：ComponentRenderer（必须精读）

**文件**：`src/core/renderer/ComponentRenderer.vue`（697 行）

这个文件是整个渲染系统的核心。**设计态和预览态都用同一个渲染器**，差异仅由 `selectedId` prop 控制。

**阅读策略**：按功能模块分段阅读：

**模块 A：组件渲染（template 部分，第 44-221 行）**

弄清楚每个组件类型如何映射到 Element Plus 组件：
- 大部分走 `v-else` 分支 → 使用 Vue 动态组件 `<component :is="materialComponents[type]">`
- 特殊组件（textarea/radio/checkbox/select/subform/static-text/upload/block/button）有独立模板分支
- 注意 subform 的递归渲染（第 100-154 行）：通过递归调用 `<ComponentRenderer>` 实现子组件渲染

**模块 B：布局计算（第 268-288 行）**

```javascript
const componentLayoutStyle = computed(() => {
  const layout = props.pageSettings?.layout || 'vertical'
  if (layout === 'vertical') return {}
  const span = props.component?.props?.span || 24
  const pct = (span / 24) * 100
  if (layout === 'grid') return { width: `calc(${pct}% - 8px)` }
  if (layout === 'inline') return { width: 'auto' }
})
```

理解：24 栅格系统 → 组件宽度 = `(span/24) × 100%`，`-8px` 是 gap 间距。

**面试重点**：为什么 grid 模式用 `calc()` 而非纯百分比？（因为 flex gap 的关系）

**模块 C：拖拽手柄（第 17-25 行 + CSS 第 537-566 行）**

```
.drag-handle {
  position: absolute;
  left: -28px;
  opacity: 0;            ← 默认隐藏
}
.lc-component:hover .drag-handle { opacity: 1; }  ← hover 时显示
```

拖拽手柄在组件左侧外部定位，hover 时淡入显示（Rank 图标）。

**模块 D：模式切换逻辑**

| prop 条件 | 渲染效果 |
|-----------|---------|
| `selectedId === component.id` | 蓝色选中边框 + 操作按钮（删除/复制）+ 编辑状态显示 |
| `selectedId !== component.id` | 普通渲染，hover 淡蓝色边框提示 |
| `selectedId === null`（预览态） | 纯净渲染，无编辑外框，无 hover 效果（因为 `:hover` CSS 仍在，只是 `selectedId` 为 null 不触发 mask） |

**面试重点**：设计态和预览态通过同一个组件渲染，相比两套独立渲染的优势是什么？（减少重复代码、保证设计态所见即所得）

#### 2.2 设计态容器：CanvasRenderer

**文件**：`src/core/renderer/CanvasRenderer.vue`

**关键代码**：
- 画布区域绑定 `@dragover="handleDragOver"` 和 `@drop="handleDrop"`
- 渲染插入指示线：`<div class="drop-indicator" v-if="insertionIndex >= 0" :style="dragPlaceholderStyle"></div>`
- 根据 `pageSettings.layout` 设置 class：`canvas-layout-grid` / `canvas-layout-inline` / `canvas-layout-vertical`

#### 2.3 预览态容器：PreviewRenderer

**文件**：`src/core/renderer/PreviewRenderer.vue`

**与 CanvasRenderer 的唯一区别**：传入 `selectedId = null`，使 ComponentRenderer 进入纯净模式。

**面试重点**：这两个渲染器的存在证明了什么设计原则？（单一职责 vs 开放封闭 — 渲染器本身不关心设计态还是预览态，模式切换由 prop 控制）

---

## 第三阶段：理解交互系统（1 小时）

> **面试考点：HTML5 Drag & Drop API vs SortableJS、防止输入冲突、技术选型决策**

### 架构概览：双引擎拖拽

项目的拖拽系统采用**双引擎**架构，按场景分工：

```
物料面板 ──HTML5 DnD──▶ 画布（useDraggable.js 处理）
画布内排序     ──SortableJS──▶ 画布（CanvasRenderer.vue 处理）
键盘快捷键     ──useDraggable.js 处理
```

| 维度 | 物料 → 画布 | 画布内排序 |
|------|------------|-----------|
| 库 | 原生 HTML5 Drag & Drop | SortableJS |
| 文件 | `useDraggable.js` | `CanvasRenderer.vue` |
| 特点 | 轻量、12 行核心代码 | 动画丝滑、触摸支持、边界处理完善 |
| 数据传递 | `event.dataTransfer` | SortableJS `onEnd` 回调 |

**面试重点**：为什么不用一个库统一处理？（两种场景需求不同 — 物料拖入是"创建"操作，组件排序是"移动"操作；HTML5 DnD 擅长跨容器数据传输，SortableJS 擅长列表内排序 + 动画；用原生 API 处理物料拖入足够简单，引入库反而过重）

### 3.1 物料拖入：useDraggable.js

**文件**：`src/composables/useDraggable.js`（~170 行）

职责精简为：物料拖入 + 键盘快捷键。

### 模块 A：物料拖入流程

```
handleDragStart(event, material)  → effectAllowed='copy'，序列化物料元数据
handleDragOver(event)             → 计算插入位置 + 渲染蓝色指示线
handleDrop(event)                 → 反序列化 → insertComponentAt / addComponent
```

### 模块 B：插入位置计算

```javascript
const calculateInsertionIndex = (event, canvas) => {
  const rect = canvas.getBoundingClientRect()
  const y = event.clientY - rect.top
  const componentElements = canvas.querySelectorAll('.lc-component')
  for (let i = 0; i < componentElements.length; i++) {
    const elMiddle = elRect.top + elRect.height / 2 - rect.top
    if (y < elMiddle) return i  // 鼠标在组件上半部 → 插入到它前面
  }
  return componentElements.length  // 追加到末尾
}
```

### 模块 C：输入防冲突

```javascript
const isInputFocused = () => {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return document.activeElement?.isContentEditable || false
}

const handleKeyDown = (event) => {
  if (isInputFocused()) return  // ← 关键：输入框中不拦截
  // ... 快捷键处理
}
```

**面试重点**：为什么不在事件处理中加 `event.target !== event.currentTarget` 判断而是在顶层 return？（可靠性和可读性 — 直接检查 activeElement 更明确）

### 模块 D：键盘快捷键系统

| 快捷键 | 操作 |
|--------|------|
| Ctrl+Z | 撤销 → `editorStore.undo()` |
| Ctrl+Y | 重做 → `editorStore.redo()` |
| Delete/Backspace | 删除选中组件 → `editorStore.deleteComponent()` |
| Ctrl+C | 复制选中组件到剪贴板 |
| Ctrl+V | 粘贴剪贴板组件 |

### 3.2 画布内排序：SortableJS 集成

**文件**：`src/core/renderer/CanvasRenderer.vue`（`initSortable()` 函数）

这是本次重构的核心改动。用 SortableJS 替代了原来的原生 HTML5 DnD 组件排序。

**SortableJS 配置**：
```javascript
Sortable.create(canvasRef.value, {
  draggable: '.lc-component',   // 只拖拽组件元素
  handle: '.drag-handle',       // 通过拖拽手柄触发
  animation: 150,               // 150ms 平滑过渡动画
  ghostClass: 'sortable-ghost', // 占位符样式（半透明）
  onEnd(evt) {
    editorStore.moveComponent(evt.item.id, evt.newIndex)
  }
})
```

**SortableJS vs 原生 HTML5 DnD 对比**：

| 维度 | 原生 HTML5 DnD（旧方案） | SortableJS（新方案） |
|------|------------------------|---------------------|
| 底层事件 | dragstart/dragover/drop | mousedown/mousemove/mouseup + touch |
| 动画 | 无（元素瞬间位移） | 150ms 平滑过渡 |
| 移动端 | 不支持 | 原生支持触摸拖拽 |
| 插入指示 | 手动计算 + 渲染 div | 自动 ghost 占位符 |
| 代码量 | ~60 行分散在 3 个文件 | ~25 行集中在 initSortable |
| 边界处理 | 需手写（拖到外部等） | 库已完善处理 |

**面试重点**：
- 为什么 SortableJS 和 HTML5 DnD 在同一画布上不冲突？（SortableJS 用鼠标/触摸事件、HTML5 DnD 用原生拖拽事件，两套独立的事件系统）
- `handle: '.drag-handle'` 的作用？（限制拖拽只能通过手柄触发，点击组件其他区域不会误拖，提升 UX）
- 为什么不在 `handleDrop` 中处理组件排序了？（职责分离 — SortableJS 的 `onEnd` 专门处理排序，`handleDrop` 只处理物料创建）
- 为什么选择 SortableJS 而非 vuedraggable？（SortableJS 已作为依赖安装；直接使用底层库比 wrapper 更灵活；vuedraggable v2.x 只支持 Vue 2，而 SortableJS 框架无关）

---

## 第四阶段：理解导出系统（1 小时）

> **面试考点：代码生成器的设计、JS 序列化**

这个项目有 **3 种导出通道**：Schema JSON、Vue SFC 代码、JS 表单配置。

### 4.1 Vue SFC 代码生成

**文件**：`src/components/CodeGenerator.vue`（386 行）

核心思路：遍历组件树 → 字符串拼接 → 输出完整的 Vue 3 SFC。

**三段式生成**：
```
generateCode()
  ├── Template 部分：<el-form> + 各组件通过 generateComponentTemplate() 生成
  ├── Script 部分：form ref + rules ref + submitForm/cancelForm 方法
  └── Style 部分：.form-layout-grid/inline/vertical 三种布局 CSS
```

**关键函数**：
- `generateComponentTemplate(component)` — 按 type 做 switch-case，拼接 HTML 字符串
- `collectFromTree(components, callback)` — 递归收集容器内表单字段和验证规则
- `getItemWidthStyle(component)` — 根据 span 和 layout 生成 `calc()` 宽度样式

**面试重点**：为什么代码生成器不做 SSR（服务端渲染）而用字符串拼接？（目标不同：SSR 为了渲染到 DOM，代码生成为了输出可读源码；而且字符串拼接更灵活、不耦合框架）

### 4.2 JS 表单配置导出

**文件**：`src/core/generator/FormConfigGenerator.js`（316 行）

**与 CodeGenerator 的区别**：输出不是完整的 Vue 组件代码，而是声明式配置对象，供运行时动态表单渲染器消费。

**核心函数**：
- `generateFormConfig(components, pageSettings)` — 生成配置数据对象
- `generateFormConfigJS(components, pageSettings)` — 生成 JS 源码字符串
- `toJS(value, indent)` — **自定义 JS 序列化器**（这是关键创新点）

**toJS 的巧妙设计**：
```javascript
// 普通 JSON.stringify 输出：{ "key": "value" }
// toJS 输出：{ key: 'value' }

// 函数体字符串直接输出代码（不套引号）
if (isCodeExpression(value)) return value  // → async (_, form) => { ... }

// 合法标识符不加引号
if (isValidIdentifier(k)) key = k  // → key: 而非 "key":
```

**面试重点**：为什么不用 `JSON.stringify()` 而要自己写序列化器？（因为 JSON 中函数体只能存为字符串，运行时需要 `eval()` 还原；而 JS 文件中函数体可以是真实代码，所以需要区分"代码字符串"和"普通字符串"）

**递归容器处理**：
```javascript
const collectFields = (components) => {
  const fields = []
  components.forEach(component => {
    if (CONTAINER_TYPES.includes(component.type) && component.children) {
      fields.push(...collectFields(component.children))  // 递归展开
    } else if (FORM_COMPONENT_TYPES.includes(component.type)) {
      fields.push(generateField(component))
    }
    // button/divider/static-text 等忽略
  })
  return fields
}
```

---

## 第五阶段：理解属性面板和集成代码（1 小时）

### 5.1 属性面板

**文件**：`src/components/PropertyPanel.vue`

**7 个配置区**：
1. 基本信息 — 组件类型/显示名称/标题位置
2. 布局配置 — 栅格跨度 (span: 1-24)
3. 通用属性 — 按 type 动态渲染（string→input, boolean→switch, number→number input）
4. 验证规则 — 必填/数据类型/长度/范围/正则
5. 高级配置 — 字段 Key/级联依赖/可见条件/选项来源
6. 选项配置 — 静态选项的 label/value 动态增删
7. 样式配置 — 宽高/边距/颜色/字体

**关键设计**：`SKIP_PROPS` 集合防止属性在「通用属性」区和专用配置区重复出现。

### 5.2 App.vue（胶水层）

**文件**：`src/App.vue`

三栏布局，不包含业务逻辑，只做事件路由：
- 工具栏 → 导出/导入按钮
- 左侧 → MaterialPanel
- 中间 → CanvasRenderer
- 右侧 → PropertyPanel

---

## 第六阶段：理解架构设计（应对面试深度问题）

### 6.1 为什么选择 Schema 驱动？

面试答案：Schema 驱动（也叫数据驱动）的核心好处是 **UI = render(Schema)**。Schema 是纯 JSON，可以持久化存储、版本控制、跨团队传输。前端不直接操作 DOM，而是修改数据，由框架响应式更新视图。

### 6.2 设计器和渲染引擎如何解耦？

它们通过 PageSchema（JSON 数据）作为中间接口。设计器负责"写"Schema（通过 Store 的 actions），渲染引擎负责"读"Schema（通过 props），两者互不感知对方的存在。代码生成器是第三个"读者"，证明了架构的可扩展性。

### 6.3 撤销/重做的实现原理？

基于快照模式（Snapshot Pattern）：
- 每次修改后 `JSON.parse(JSON.stringify(pageSchema))` 深拷贝存入 stack
- undo：`currentIndex--` 后用 `Object.assign(pageSchema, snapshot)` 恢复
- redo：`currentIndex++` 同样恢复
- 如果在历史中间修改，丢弃后面的分支（标准撤销栈行为）
- 上限 50 条防止内存溢出

### 6.4 如何添加一种新组件？

4 步操作：
1. `materials/index.js` 中新增物料元数据
2. `ComponentRenderer.vue` 中新增 `<template v-else-if="component.type === '新类型'">`
3. `CodeGenerator.vue` 中新增 `case '新类型':`
4. `MaterialPanel.vue` 中新增预览模板

（如果不需要特殊渲染逻辑，步骤 2-4 可以用 v-else 兜底）

### 6.5 架构的当前局限（面试中展示深度思考）

1. **ComponentRenderer 违反开闭原则** — 16 种组件的渲染逻辑全在一个文件中，新增类型需修改此文件
2. **模板重复** — MaterialPanel + ComponentRenderer + CodeGenerator 三处各有一套按类型的分支逻辑
3. **容器递归未统一** — subform 在 ComponentRenderer 中用递归 ComponentRenderer，block 却用了独立的 BlockRenderer
4. **物料 Vue 组件未充分利用** — `materials/base/` 下的组件只在映射表中注册，实际渲染用的是内联渲染
5. **useDraggable 双实例** — App.vue 和 MaterialPanel.vue 各自创建实例，键盘监听器注册两次（可优化为单例或 provide/inject）

---

## 实用的文件阅读顺序速查

```
第 1 步: src/core/schema/types.ts           ← 数据模型（106 行）
第 2 步: src/stores/editorStore.js          ← 状态中枢（283 行）
第 3 步: src/materials/index.js             ← 物料定义（精读前 50 行 + block/input/select 三个物料 + 导出 API）
第 4 步: src/core/renderer/ComponentRenderer.vue  ← 渲染核心（697 行，分段读）
第 5 步: src/core/renderer/CanvasRenderer.vue     ← 画布容器
第 6 步: src/core/renderer/PreviewRenderer.vue    ← 预览容器（与 CanvasRenderer 对比理解）
第 7 步: src/composables/useDraggable.js   ← 交互系统（207 行）
第 8 步: src/components/PropertyPanel.vue  ← 属性编辑
第 9 步: src/components/CodeGenerator.vue  ← Vue SFC 代码生成
第 10 步: src/core/generator/FormConfigGenerator.js ← JS 配置导出
第 11 步: src/components/MaterialPanel.vue ← 物料展示面板
第 12 步: src/App.vue                       ← 胶水层集成
第 13 步: src/main.js                       ← 入口文件（11 行）
```

---

## 可能被问到的面试问题

1. **"低代码编辑器的核心数据结构是什么？"** → PageSchema / ComponentSchema（参考 types.ts）
2. **"设计态和预览态如何共用渲染器？"** → selectedId prop 控制模式切换（参考 ComponentRenderer.vue）
3. **"为什么选择 SortableJS 而不是原生 HTML5 DnD 做组件排序？"** → 动画、触摸支持、边界处理、代码量；但物料拖入保留原生 API（参考 useDraggable.js + CanvasRenderer.vue）
4. **"SortableJS 和 HTML5 DnD 如何在同一画布上共存？"** → 两套独立事件系统不冲突；物料拖入用 DnD 跨容器传数据，画布排序用 SortableJS 鼠标事件 + 动画（参考第三阶段 3.2）
5. **"撤销重做怎么实现的？"** → 快照栈模式（参考 editorStore.js 的 saveHistory/undo）
6. **"如何保证输入框中 Backspace 不删除组件？"** → isInputFocused() 前置检查（参考 useDraggable.js）
7. **"栅格布局怎么做的？"** → 24 栅格 + calc() 宽度计算（参考 ComponentRenderer.vue 的 componentLayoutStyle）
8. **"JS 导出和 JSON 导出的区别？"** → 函数体输出为真实代码而非字符串（参考 FormConfigGenerator.js 的 toJS）
9. **"如何扩展新的表单组件类型？"** → 物料注册 + 渲染分支 + 代码生成分支（参考 ARCHITECTURE.md）
10. **"为什么不用 JSON.stringify？"** → 需要区分代码字符串和普通字符串
11. **"容器组件如何处理子组件？"** → 递归 ComponentRenderer / 递归 collectFields（参考 ComponentRenderer.vue subform 分支 + FormConfigGenerator.js）

---

## 阅读建议

1. **不要跳读** — 每个阶段的文件阅读都需要实际打开文件看代码，而非只看文档
2. **画数据流图** — 在纸上画出"物料拖入→Store更新→画布渲染→属性编辑→导出"的完整链路
3. **重点关注数据流动** — 理解谁写数据（Store actions）、谁读数据（renderer/composables）比理解组件样式更重要
4. **调试运行** — 如果能 `npm run dev` 启动项目，在浏览器中拖拽几个组件，观察 Vue DevTools 中的 Store 变化
5. **手写核心逻辑** — 尝试不看代码手写 componentLayoutStyle 的计算逻辑、calculateInsertionIndex 的算法逻辑
