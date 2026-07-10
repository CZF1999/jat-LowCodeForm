# 低代码编辑器 — 渐进式代码阅读指南

> 目标：从零掌握整个项目，足以应对面试中的架构、实现细节、技术决策等问题。

---

## 阅读前置：5 分钟了解项目全貌

这是一个 **Schema 驱动的低代码表单编辑器**，核心理念是"一切围绕 PageSchema（JSON 数据）运转"。

**一句话概括**：用户从左侧物料库拖拽组件到画布，右侧属性面板编辑配置，最终导出为 Vue 3 SFC 代码 或 JS 表单配置文件。

**核心数据流**：
```
物料面板 ──vuedraggable clone──▶ 画布 (v-model="pageSchema.components")
                                         │
                               ┌─────────┼─────────┐
                               ▼         ▼         ▼
                          Schema导出  JS配置导出  Vue SFC代码
```

技术栈：Vue 3 (Composition API) + Pinia + Element Plus + vuedraggable + Vite，共 ~2000 行核心代码。

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
- `FormConfig` 是 JS 配置导出通道，与 CodeGenerator（Vue SFC 导出）平级
- `MaterialMeta.isContainer` 决定组件是否可以接收子组件

#### 1.2 再看 Store（数据中枢）

**文件**：`src/stores/editorStore.js`（254 行）

这是整个编辑器的"大脑"。**设计精简**：只保留数据状态，拖拽相关状态全部由 vuedraggable 管理。

**State（状态）**：
- `pageSchema` — 唯一的真相来源（对应 PageSchema 类型）
- `selectedId` — 当前选中的组件 ID
- `history.stack` + `currentIndex` — 撤销/重做的实现（深拷贝快照，上限 50 条）
- `clipboard` — 复制粘贴缓冲区

> **注意**：旧版本中的 `isDragging`、`dragType`、`insertionIndex`、`dragPlaceholderStyle` 已移除——因为 vuedraggable 的 group+clone 机制完全接管了拖拽流程，不再需要这些手动维护的状态。

**关键 Actions**：
```
addComponent(component)       → push 到 components[] + saveHistory() + 选中
insertComponentAt(comp, idx)  → splice 到指定位置
moveComponent(id, toIndex)    → 从原位置取出，插入新位置
deleteComponent(id)           → 递归查找删除（包括容器内子组件）
updateComponent(id, updates)  → Object.assign 合并更新
undo()                        → currentIndex-- 后 Object.assign 恢复快照
```

**面试重点**：
- `saveHistory()` 的截断逻辑：`currentIndex < stack.length - 1` 时丢弃后面的分支（标准撤销栈行为）
- `updateComponent` 使用 `Object.assign` 而非替换整个对象，保证 Vue 响应式正常工作
- `moveComponent` 的索引调整逻辑：`fromIndex < targetIndex` 时需 `-1`（因为 splice 改变了数组长度）

#### 1.3 最后看物料注册中心

**文件**：`src/materials/index.js`（936 行，但大量是重复的数据定义，核心逻辑只有 ~50 行）

**阅读策略**：不要逐行读 16 种物料定义！重点看：
1. 一种简单物料（如 `input`），理解 `propsSchema` / `defaultProps` / `defaultStyles` 的结构
2. 一种容器物料（如 `block`），注意 `isContainer: true` 和 `childrenTypes`
3. 一种有高级属性的物料（如 `select`），注意 `pidField`/`optionsType`/`optionsApi`
4. 导出的 API 函数：`getMaterials()`/`getMaterialByType()`/`registerMaterial()`/`unregisterMaterial()`
5. `materialComponents` 映射表：只有 button/input/block 有 .vue 文件实现

**面试要点**：物料系统采用"元数据 + 默认值"分离设计，拖入画布时 clone 函数从 defaultProps 创建实例。

---

## 第二阶段：理解渲染引擎（1.5 小时）

> **面试考点：设计态/预览态共享渲染器、vuedraggable 集成**

### 阅读顺序

#### 2.1 核心：ComponentRenderer（必须精读）

**文件**：`src/core/renderer/ComponentRenderer.vue`（648 行）

这个文件是整个渲染系统的核心。**设计态和预览态都用同一个渲染器**，差异仅由 `selectedId` prop 控制。

**模块 A：组件渲染（template 部分）**

弄清楚每个组件类型如何映射到 Element Plus 组件：
- 大部分走 `v-else` 分支 → 使用 Vue 动态组件 `<component :is="materialComponents[type]">`
- 特殊组件（textarea/radio/checkbox/select/subform/static-text/upload/block/button）有独立模板分支
- 注意 subform 的递归渲染：通过递归调用 `<ComponentRenderer>` 实现子组件渲染

**模块 B：布局计算**

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

理解：24 栅格系统 → 组件宽度 = `(span/24) × 100%`，`-8px` 是 grid 布局 gap 间距。

**面试重点**：为什么 grid 模式用 `calc()` 而非纯百分比？（因为 CSS flex gap 占用了 8px，不减去会导致实际宽度超出容器）

**模块 C：拖拽手柄**

```
.drag-handle {
  position: absolute;
  left: -28px;
  opacity: 0;            ← 默认隐藏
}
.lc-component:hover .drag-handle { opacity: 1; }  ← hover 时显示
```

拖拽手柄在组件左侧外部定位，hover 时淡入显示（Rank 图标）。vuedraggable 通过 `handle=".drag-handle"` 配置使用此手柄——用户必须抓握手柄才能发起拖拽，点击组件其他区域不会误触发排序。

**面试重点**：为什么用 handle 限制拖拽触发区域？（UX 考虑——用户点击组件内容区通常是选中/编辑，只有拖动手柄才是排序意图。误将点击当拖拽会导致操作歧义）

**模块 D：模式切换逻辑**

| prop 条件 | 渲染效果 |
|-----------|---------|
| `selectedId === component.id` | 蓝色选中边框 + 操作按钮（删除/复制） |
| `selectedId !== component.id` | 普通渲染，hover 淡蓝色边框提示 |
| `selectedId === null`（预览态） | 纯净渲染，无编辑外框 |

**面试重点**：设计态和预览态通过同一个组件渲染，相比两套独立渲染的优势是什么？（减少重复代码、保证设计态所见即所得）

#### 2.2 设计态容器：CanvasRenderer

**文件**：`src/core/renderer/CanvasRenderer.vue`

核心是 vuedraggable 的 `<draggable>` 组件：

```html
<draggable
  v-model="editorStore.pageSchema.components"
  group="components"
  handle=".drag-handle"
  item-key="id"
  :animation="150"
  ghost-class="sortable-ghost"
  @change="handleChange"
>
```

**关键设计点**：
- `v-model="editorStore.pageSchema.components"` — 直接双向绑定 Store 中的组件数组，vuedraggable 内部通过 splice 操作数组（触发 Vue 响应式）
- `group="components"` — 与物料面板共享同一个 group 名，物料面板设置 `pull: 'clone'` 允许克隆过来
- `handle=".drag-handle"` — 指定拖拽手柄选择器，只有拖动手柄才能触发排序
- `@change` 回调 — `added` 事件时自动选中新组件 + 保存历史

**handleChange 逻辑**：
```javascript
const handleChange = (evt) => {
  if (evt.added) {
    editorStore.selectedId = evt.added.element.id  // 拖入新组件后自动选中
  }
  editorStore.saveHistory()  // 任何排序/增删都记录到撤销栈
}
```

#### 2.3 预览态容器：PreviewRenderer

**文件**：`src/core/renderer/PreviewRenderer.vue`

**与 CanvasRenderer 的区别**：非 `<draggable>` 包裹，直接遍历 `components` 数组，传入 `selectedId = null` 使 ComponentRenderer 进入纯净模式（无编辑外框）。

---

## 第三阶段：理解拖拽系统（1 小时）

> **面试考点：vuedraggable group 机制、统一拖拽架构、clone 函数设计、技术选型迭代**

### 架构：统一 vuedraggable

项目经过两次架构迭代，最终使用 **vuedraggable 的 group 机制** 统一管理所有拖拽：

```
MaterialPanel                        CanvasRenderer
┌──────────────────────┐            ┌──────────────────────────┐
│ <draggable            │            │ <draggable                │
│   :list="formMaterials"│  clone    │   v-model="components"    │
│   group="components"  │──────────▶│   group="components"      │
│   :sort="false"       │            │   handle=".drag-handle"   │
│   pull="clone"        │            │   :animation="150"        │
│   put="false"         │            │ >                         │
│ >                     │            │                          │
└──────────────────────┘            └──────────────────────────┘
```

### 3.1 物料面板端：clone 函数

**文件**：`src/components/MaterialPanel.vue`

```javascript
const cloneMaterial = (material) => {
  return {
    type: material.type,
    label: material.name,
    props: { ...material.defaultProps },      // 浅拷贝默认属性
    styles: { ...material.defaultStyles },    // 浅拷贝默认样式
    events: {},
    children: material.isContainer ? [] : undefined,
    id: generateId(),           // ← 关键：每次 clone 生成唯一 ID
    titlePosition: 'left'
  }
}
```

**面试重点**：
- 为什么 clone 中要 `generateId()`？（vuedraggable 对同一物料的每次拖拽都调用此函数，如果不生成新 ID，多次拖入同一类型组件会 ID 冲突）
- 为什么 `props` 和 `styles` 用浅拷贝？（每个组件实例需要独立的 props/styles 对象，否则修改一个会影响其他同类型实例）

### 3.2 画布端：v-model + group 匹配

**文件**：`src/core/renderer/CanvasRenderer.vue`

```html
<draggable
  v-model="editorStore.pageSchema.components"
  group="components"
  handle=".drag-handle"
  item-key="id"
  :animation="150"
  ghost-class="sortable-ghost"
  chosen-class="sortable-chosen"
  drag-class="sortable-drag"
  @change="handleChange"
>
```

**面试重点**：
- `v-model` 直接绑定 Store 的数组，为什么能工作？（Pinia state 是 Vue reactive 对象，vuedraggable 内部的 splice/push 操作会触发 Vue 响应式系统，组件自动重渲染）
- `group="components"` 匹配了什么？（物料面板设置了 `pull: 'clone'` 和相同的 group 名，vuedraggable 自动识别为"允许从该 group clone 元素过来"）
- `item-key="id"` 的必要性？（Vue 列表渲染需要 key 来追踪元素身份；没有 item-key，vuedraggable 无法正确识别哪些元素是新增/删除/移动的）

### 3.3 vuedraggable 统一方案的优势

**旧架构（HTML5 DnD + SortableJS 双引擎）→ 新架构（vuedraggable 统一）的演进**：

| 维度 | 旧：双引擎方案 | 新：vuedraggable 统一 |
|------|--------------|---------------------|
| 物料→画布 | 原生 HTML5 Drag & Drop + useDraggable.js | vuedraggable group clone |
| 画布内排序 | SortableJS（裸库） | vuedraggable（同一实例） |
| 数据传递 | `event.dataTransfer` 序列化/反序列化 | clone 函数直接返回对象 |
| Store 状态 | 需手动维护 isDragging/dragType/insertionIndex | vuedraggable 内部管理，Store 零负担 |
| 插入位置 | `calculateInsertionIndex()` 手算 + 渲染指示线 | vuedraggable 自动处理 |
| 动画 | 150ms（SortableJS） | 150ms（vuedraggable 内置，底层也是 SortableJS） |
| 触摸支持 | SortableJS 提供 | vuedraggable 内置 |
| 物料面板预览 | Element Plus 交互组件（slider/rate/switch） | 简单图标（`<el-icon>`） |

**面试重点**——"为什么最终选择 vuedraggable 统一方案？"

回答结构：
1. **问题驱动**：物料面板原先渲染 Element Plus 交互组件（slider/rate/switch），这些组件内部使用 mousedown 事件，与 SortableJS 的鼠标事件冲突 → 换为纯图标预览，消除了冲突根源
2. **简化架构**：图标预览后，物料面板不再需要"防止误拖拽"，可以用 vuedraggable 的 `:sort="false"` + `pull: 'clone'` 统一处理
3. **消除中间层**：不再需要 useDraggable.js 的拖拽部分（handleDragStart/handleDragOver/handleDrop/calculateInsertionIndex），数据直接通过 clone 函数传递
4. **Store 瘦身**：移除了 isDragging/dragType/insertionIndex/dragPlaceholderStyle 等手动维护的拖拽状态
5. **代码量对比**：拖拽相关代码从 ~170 行（useDraggable）→ 集中在两个 `<draggable>` 标签的配置中

### 3.4 键盘快捷键

**文件**：`src/App.vue`（内联在 `<script setup>` 中）和 `src/composables/useDraggable.js`（已被精简为 `useKeyboard()`）

快捷键逻辑现在直接写在 App.vue 中：

```javascript
const isInputFocused = () => {
  const tag = document.activeElement?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return document.activeElement?.isContentEditable || false
}

const handleKeyDown = (event) => {
  if (isInputFocused()) return  // ← 输入框中不拦截
  // Ctrl+Z/Y, Delete/Backspace, Ctrl+C/V ...
}

onMounted(() => document.addEventListener('keydown', handleKeyDown))
onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))
```

| 快捷键 | 操作 |
|--------|------|
| Ctrl+Z | 撤销 → `editorStore.undo()` |
| Ctrl+Y | 重做 → `editorStore.redo()` |
| Delete/Backspace | 删除选中组件 |
| Ctrl+C | 复制选中组件 |
| Ctrl+V | 粘贴组件 |

**面试重点**：`isInputFocused()` 为什么放在最前面而不是在具体 case 中判断？（"快速失败"模式——如果焦点在输入框，整个快捷键函数直接退出，不会进入任何 `if` 判断。性能更好，逻辑更清晰）

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

**面试重点**：为什么代码生成器不做 SSR 而用字符串拼接？（目标不同——SSR 为了渲染到 DOM，代码生成为了输出可读源码；字符串拼接更灵活、不耦合框架）

### 4.2 JS 表单配置导出

**文件**：`src/core/generator/FormConfigGenerator.js`（316 行）

**与 CodeGenerator 的区别**：输出不是完整的 Vue 组件代码，而是声明式配置对象，供运行时动态表单渲染器消费。

**核心函数**：
- `generateFormConfig(components, pageSettings)` — 生成配置数据对象
- `generateFormConfigJS(components, pageSettings)` — 生成 JS 源码字符串
- `toJS(value, indent)` — **自定义 JS 序列化器**（关键创新点）

**toJS 的巧妙设计**：
```javascript
// 普通 JSON.stringify 输出：{ "key": "value" }
// toJS 输出：{ key: 'value' }

// 函数体字符串 → 直接输出代码（不套引号）
if (isCodeExpression(value)) return value  // → async (_, form) => { ... }

// 合法标识符 → 不加引号
if (isValidIdentifier(k)) key = k  // → key: 而非 "key":
```

**面试重点**：为什么不用 `JSON.stringify()`？（JSON 中函数体只能存为字符串，运行时需 `eval()` 还原；JS 文件中函数体是真实代码，需要自研序列化器来区分"代码字符串"和"数据字符串"）

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

三栏布局 + 键盘快捷键内联，不包含复杂业务逻辑：
- 工具栏 → 导出/导入/撤销按钮
- 左侧 → MaterialPanel（vuedraggable clone 源）
- 中间 → CanvasRenderer（vuedraggable 接收端 + 排序）
- 右侧 → PropertyPanel（属性编辑）
- 内联 → 全局键盘快捷键（Ctrl+Z/Y/C/V, Delete）

### 5.3 MaterialPanel（物料面板）

**文件**：`src/components/MaterialPanel.vue`

从组件丰富的预览改为简洁图标展示：

```html
<draggable
  :list="formMaterials"
  :group="{ name: 'components', pull: 'clone', put: false }"
  :sort="false"
  :clone="cloneMaterial"
  item-key="type"
>
  <template #item="{ element }">
    <div class="material-item">
      <el-icon :size="24"><component :is="getIcon(element.type)" /></el-icon>
      <div class="material-name">{{ element.name }}</div>
    </div>
  </template>
</draggable>
```

**关键配置解读**：
- `:sort="false"` — 物料面板内部不允许排序（固定列表）
- `pull: 'clone'` — 拖出时克隆而非移动（源列表不变）
- `put: false` — 不接受外部拖入（单向：物料面板 → 画布）
- `:clone="cloneMaterial"` — 自定义克隆函数，在此创建完整组件对象

---

## 第六阶段：理解架构设计（应对面试深度问题）

### 6.1 为什么选择 Schema 驱动？

Schema 驱动（数据驱动）的核心好处是 **UI = render(Schema)**。Schema 是纯 JSON，可以持久化存储、版本控制、跨团队传输。前端不直接操作 DOM，而是修改数据，由框架响应式更新视图。本案中设计器、预览器、代码生成器都是同一份 Schema 的不同"读者"。

### 6.2 设计器和渲染引擎如何解耦？

通过 PageSchema（JSON 数据）作为中间接口。设计器负责"写"Schema（通过 Store 的 actions），渲染引擎负责"读"Schema（通过 props），两者互不感知对方的存在。代码生成器（CodeGenerator/FormConfigGenerator）是第三和第四个"读者"，证明了架构的可扩展性。

### 6.3 撤销/重做的实现原理？

基于快照模式（Snapshot Pattern）：
- 每次修改后 `JSON.parse(JSON.stringify(pageSchema))` 深拷贝存入 stack
- undo：`currentIndex--` 后用 `Object.assign(pageSchema, snapshot)` 恢复
- redo：`currentIndex++` 同样恢复
- 如果在历史中间修改，丢弃后面的分支（标准撤销栈行为）
- 上限 50 条防止内存溢出
- vuedraggable 的 `@change` 事件中调用 `saveHistory()`，自动覆盖所有拖拽操作

### 6.4 如何添加一种新组件？

4 步操作：
1. `materials/index.js` 中新增物料元数据 + 图标
2. `ComponentRenderer.vue` 中新增 `<template v-else-if="component.type === '新类型'">`
3. `CodeGenerator.vue` 中新增 `case '新类型':`
4. `MaterialPanel.vue` 中在 `iconMap` 添加图标映射

### 6.5 拖拽方案的演进路径（面试展示架构思维）

```
第一版：原生 HTML5 DnD 全搞定（简单但动画差、移动端不支持）
   ↓
第二版：HTML5 DnD（物料拖入）+ SortableJS（画布排序）双引擎
       优势：动画丝滑、触摸支持
       问题：两套事件系统、dropEffect 匹配坑、useDraggable 170 行
   ↓
第三版（当前）：vuedraggable group+clone 统一方案
       优势：一套 API、Store 零拖拽状态、代码集中在两个 <draggable> 标签
       代价：物料面板预览从交互组件简化为图标
```

**面试要点**：能讲出这个演进路径，说明你理解了"每次重构解决了什么问题、代价是什么"——这是高级工程师的思维模式。

### 6.6 架构的当前局限（面试中展示深度思考）

1. **ComponentRenderer 违反开闭原则** — 16 种组件的渲染逻辑集中在一个文件中
2. **模板重复** — MaterialPanel + ComponentRenderer + CodeGenerator 三处各有一套按类型的分支逻辑（iconMap / switch-case / switch-case）
3. **容器递归未统一** — subform 在 ComponentRenderer 中用递归，block 用了独立 BlockRenderer 组件
4. **物料 Vue 组件未充分利用** — `materials/base/` 下的 button/input/block 有 .vue 文件，但 ComponentRenderer 未使用它们，而是内联渲染 Element Plus
5. **vuedraggable 破坏画布布局** — `<draggable>` 组件渲染为单个 DOM 元素包裹所有子组件，外层 CSS 需要配合处理
6. **HTML5 DnD 残余** — ComponentRenderer 的 subform 分支仍然使用原生 `@dragover`/`@drop` 处理子组件拖入，未迁移到 vuedraggable

---

## 实用的文件阅读顺序速查

```
第 1 步: src/core/schema/types.ts              ← 数据模型（106 行）
第 2 步: src/stores/editorStore.js             ← 状态中枢（254 行，无拖拽状态）
第 3 步: src/materials/index.js                ← 物料定义（精读 input/block/select 三个）
第 4 步: src/core/renderer/ComponentRenderer.vue ← 渲染核心（648 行，分段读）
第 5 步: src/core/renderer/CanvasRenderer.vue    ← 画布 + vuedraggable 集成
第 6 步: src/components/MaterialPanel.vue        ← 物料面板 + vuedraggable clone
第 7 步: src/core/renderer/PreviewRenderer.vue   ← 预览容器（对比理解）
第 8 步: src/composables/useDraggable.js         ← 键盘快捷键（已精简）
第 9 步: src/components/PropertyPanel.vue        ← 属性编辑
第 10 步: src/components/CodeGenerator.vue       ← Vue SFC 代码生成
第 11 步: src/core/generator/FormConfigGenerator.js ← JS 配置导出
第 12 步: src/App.vue                            ← 胶水层 + 键盘快捷键
第 13 步: src/main.js                            ← 入口文件
```

---

## 可能被问到的面试问题

1. **"低代码编辑器的核心数据结构是什么？"** → PageSchema / ComponentSchema（参考 types.ts）
2. **"设计态和预览态如何共用渲染器？"** → selectedId prop 控制模式切换（参考 ComponentRenderer.vue）
3. **"拖拽系统如何工作？最终方案是什么？"** → vuedraggable group+clone 统一方案：物料面板 `pull: 'clone'` + 画布 `v-model` 同一个 group（参考 MaterialPanel.vue + CanvasRenderer.vue）
4. **"拖拽方案经历了哪些迭代？为什么？"** → 原生 DnD → 双引擎（DnD+SortableJS）→ vuedraggable 统一（参考 6.5 节演进路径）
5. **"clone 函数为什么要在面板端生成 ID？"** → 每次拖入生成唯一实例，避免多次拖入同类型组件导致 ID 冲突
6. **"撤销重做怎么实现的？"** → 快照栈模式 + vuedraggable @change 触发保存（参考 editorStore.js）
7. **"如何保证输入框中 Backspace 不删除组件？"** → isInputFocused() 前置检查（参考 App.vue）
8. **"栅格布局怎么做的？"** → 24 栅格 + calc() 宽度计算（参考 ComponentRenderer.vue 的 componentLayoutStyle）
9. **"JS 导出和 JSON 导出的区别？"** → 函数体输出为真实代码（参考 FormConfigGenerator.js 的 toJS）
10. **"为什么不用 JSON.stringify？"** → 需要区分代码字符串和普通字符串
11. **"容器组件如何处理子组件？"** → 递归 ComponentRenderer / 递归 collectFields
12. **"Store 为什么没有拖拽状态？"** → vuedraggable 的 v-model 直接操作数组，不需要手动维护拖拽中间态

---

## 阅读建议

1. **先理解数据流，再看组件细节** — 画"物料 clone→vuedraggable v-model→Store 响应式→CanvasRenderer 重渲染"的完整链路
2. **重点关注架构演进** — 理解每版方案解决了什么、代价是什么（参考第 6.5 节）
3. **关注 vuedraggable 的配置组合** — `group`/`pull`/`put`/`clone`/`handle`/`:sort` 这 6 个配置项的组合决定了拖拽行为
4. **调试运行** — `npm run dev` 启动项目，拖拽组件观察 Vue DevTools 中 store 的变化
5. **手写核心逻辑** — 不看代码手写 componentLayoutStyle、cloneMaterial、handleChange 三个函数
