# 低代码编辑器 — 渐进式代码阅读指南

> 目标：从零掌握**低代码表单编辑器子系统**，足以应对面试中的架构、实现细节、技术决策等问题。
>
> **范围声明**：本指南只覆盖编辑器（`src/core`、`src/stores`、`src/materials`、`src/components`、`src/views/EditorPage.vue`）。同仓库还有作业批阅 Demo（`src/features/homework-review`，见 `VUE_PAPER_ANNOTATION_HANDOFF.md`）与 design-to-code 页，不在此展开。

---

## 阅读前置：5 分钟了解项目全貌

这是一个 **Schema 驱动的低代码表单编辑器**，核心理念是"一切围绕 PageSchema（JSON 数据）运转"。

**一句话概括**：用户从左侧物料库拖拽组件到画布，右侧属性面板编辑配置，最终可导出 Schema JSON、Vue 3 SFC、JS/TS 表单配置、校验规则或表单模块等产物。

**路由入口**：`src/main.ts` → `App.vue`（仅 `<router-view />`）→ `/` 加载 `EditorPage.vue`（真正的编辑器壳）。

**核心数据流**：

```
物料面板 ──vuedraggable clone──▶ 画布 (v-model="pageSchema.components")
                                         │
                    ┌──────────┬─────────┼─────────┬──────────┐
                    ▼          ▼         ▼         ▼          ▼
               Schema JSON  Vue SFC   JS/TS配置  校验规则   表单模块
```

技术栈：Vue 3 (Composition API) + TypeScript + Pinia + Element Plus + vuedraggable + Vite。编辑器相关代码主要在 `core` / `stores` / `materials` / `components` / `EditorPage`。

---

## 第一阶段：理解数据模型（1 小时）

> **面试考点：Schema 驱动架构、数据模型设计**

### 阅读顺序

#### 1.1 先看类型定义（入口，最重要）

**文件**：`src/core/schema/types.ts`

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
- `FormConfig` 是配置导出通道，与 CodeGenerator（Vue SFC 导出）平级
- `MaterialMeta.isContainer` 决定组件是否可以接收子组件

#### 1.2 再看 Store（数据中枢）

**文件**：`src/stores/editorStore.ts`

这是整个编辑器的"大脑"。**设计精简**：只保留数据状态，拖拽相关状态全部由 vuedraggable 管理。

**State（状态）**：

- `pageSchema` — 唯一的真相来源（对应 PageSchema 类型）
- `selectedId` — 当前选中的组件 ID
- `clipboard` — 复制粘贴缓冲区
- `history` — **双栈**撤销/重做：
  - `past: PageSchema[]` — 已提交快照（含初始基线）
  - `future: PageSchema[]` — 被撤销后可重做的快照
  - `maxSize: 50` — past 上限

> **注意**：旧版本中的 `isDragging`、`dragType`、`insertionIndex`、`dragPlaceholderStyle` 已移除——因为 vuedraggable 的 group+clone 机制完全接管了拖拽流程，不再需要这些手动维护的状态。

**画布增删改序谁负责？**  
物料拖入与画布内排序由 **vuedraggable 直接改写** `pageSchema.components`（splice/push），Store **没有** `addComponent` / `insertComponentAt` / `moveComponent`。Store 负责选中、删除、属性更新、剪贴板、历史与导入导出。

**关键 Actions（与代码一致）**：

```
initializeStore()              → past 写入初始基线快照
deleteComponent(id)            → 递归查找删除 + saveHistory()
updateComponent(id, updates)   → Object.assign 合并更新 + saveHistory()
copyComponent(component)       → 深拷贝进 clipboard（换新 id）
pasteComponent()               → 从 clipboard 推入 components + saveHistory()
selectComponent(id)            → 设置 selectedId
saveHistory()                  → 深拷贝当前 schema 推入 past，并清空 future
undo() / redo()                → past ↔ future 双栈迁移后 Object.assign 恢复
importSchema(schema) / exportSchema()
```

**面试重点**：

- `saveHistory()`：新操作会 `future = []`，丢弃旧的"重做分支"（标准撤销栈行为）
- `canUndo` 要求 `past.length > 1`（past[0] 是初始基线，不能再往回弹）
- `updateComponent` 使用 `Object.assign` 而非替换整个对象，保证 Vue 响应式正常工作
- 拖入/排序不走 Store action，但 `CanvasRenderer` 的 `@change` 会调用 `saveHistory()`

#### 1.3 最后看物料注册中心

**文件**：`src/materials/index.ts`（体量大，多为物料元数据重复结构；注册 API 很短）

**阅读策略**：不要逐行读全部物料定义！重点看：

1. 一种简单物料（如 `input`），理解 `propsSchema` / `defaultProps` / `defaultStyles` 的结构
2. 一种容器物料（如 `block`），注意 `isContainer: true` 和 `childrenTypes`
3. 一种有高级属性的物料（如 `select`），注意 `pidField`/`optionsType`/`optionsApi`
4. 导出的 API：`getMaterials()` / `getMaterialByType()` / `getComponentByType()` / `registerMaterial()` / `unregisterMaterial()`
5. `materials/index.ts` 里的 `materialComponents`：目前挂了 **button / input / block / cascader** 四个 Vue 实现（`materials/base/`*）

**两套「materialComponents」不要混**：

| 位置 | 含义 |
|------|------|
| `materials/index.ts` | 可选的 Vue 物料组件注册表（给扩展用） |
| `ComponentRenderer.vue` 内局部映射 | 多数是 **Element Plus 标签名字符串**（如 `el-input`），用于动态 `<component :is>` |

设计态画布当前仍以 ComponentRenderer 内联模板 / Element Plus 映射为主，并未全面改用 `materials/base` 下的 Vue 文件。

**面试要点**：物料系统采用"元数据 + 默认值"分离设计，拖入画布时 clone 函数从 defaultProps 创建实例。

---

## 第二阶段：理解渲染引擎（1.5 小时）

> **面试考点：设计态/预览态共享渲染器、vuedraggable 集成**

### 阅读顺序

#### 2.1 核心：ComponentRenderer（必须精读）

**文件**：`src/core/renderer/ComponentRenderer.vue`

这个文件是整个渲染系统的核心。**设计态和预览态都用同一个渲染器**，差异仅由 `selectedId` prop 控制。

**模块 A：组件渲染（template 部分）**

弄清楚每个组件类型如何映射到 Element Plus 组件：

- 多种表单控件有独立 `v-else-if` 模板分支（textarea/radio/checkbox/select/subform/static-text/upload/block/button 等）
- 其余类型可走动态 `<component :is="...">`，这里的映射表是渲染器内部的 Element Plus 标签名，不是 `materials/index.ts` 的 Vue 注册表
- subform：递归 `<ComponentRenderer>` 渲染子组件
- block：委托 `BlockRenderer`（`materials/base/Block/index.vue`）

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
| 物料→画布 | 原生 HTML5 Drag & Drop + 旧 useDraggable 拖拽逻辑 | vuedraggable group clone |
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
3. **消除中间层**：不再需要旧拖拽引擎里的 handleDragStart/handleDragOver/handleDrop/calculateInsertionIndex，数据直接通过 clone 函数传递
4. **Store 瘦身**：移除了 isDragging/dragType/insertionIndex/dragPlaceholderStyle 等手动维护的拖拽状态
5. **代码量对比**：拖拽相关逻辑从独立 composable 收敛到两个 `<draggable>` 标签的配置中

### 3.4 键盘快捷键

**以谁为准**：`src/views/EditorPage.vue`（内联 `isInputFocused` + `handleKeyDown`）。

`src/composables/useDraggable.ts` 现已精简为仅导出 `useKeyboard()`，逻辑与 EditorPage 类似，但**当前编辑器页并未调用它**——阅读时不要把它当成拖拽引擎，也不要当成唯一快捷键入口。

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

> **面试考点：代码生成器的设计、JS/TS 序列化**

编辑器工具栏暴露多条导出通道（见 `EditorPage.vue`），核心包括：

| 通道 | 主要入口 |
|------|---------|
| Schema JSON | Store `exportSchema` / 导入导出按钮 |
| Vue SFC 源码 | `CodeGenerator.vue` |
| JS 表单配置 | `generateFormConfigJS`（`FormConfigGenerator.ts`） |
| TS 表单配置 | `generateFormConfigTS` |
| 校验规则 / 表单模块 | 同文件内其它生成函数，由 EditorPage 按钮触发 |

### 4.1 Vue SFC 代码生成

**文件**：`src/components/CodeGenerator.vue`

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

### 4.2 JS/TS 表单配置导出（精读）

**文件**：`src/core/generator/FormConfigGenerator.ts`  
**入口**：`EditorPage.vue` 的「导出 JS 配置 / 导出 TS 配置」→ `ensureFieldNames()` → `generateFormConfigJS` / `generateFormConfigTS` → Blob 下载。

**与 CodeGenerator 的区别**：输出不是完整 Vue SFC，而是声明式 `FormConfig`（及可 `import` 的 JS/TS 模块），供业务工程 / 动态表单渲染器消费。  
**与 Schema JSON「导出」的区别**：Schema 是设计态整页真源（可回显画布）；FormConfig 是运行时瘦协议（扁平 fields，丢掉 id/styles/events 等编辑态私货）。

#### 总流程

```
EditorPage 点导出 JS/TS
  → ensureFieldNames / validateFormFieldKeys（fieldName 必填）
  → generateFormConfigJS | generateFormConfigTS
       → generateFormConfig（造数据对象，JS/TS 共用）
            → collectFields（树 → 扁平 fields）
                 → generateField（单字段映射）
       → toJS(config)（对象 → 源码字符串）
  → JS：const + export default
  → TS：内联 interface + 类型注解 + export default
```

**一句话**：先做与 JSON 同源的协议对象，再用 `toJS` 做成可 import 的模块；TS 只多内联类型，不是另一套字段映射。

#### 步骤 1：导出前校验 `validateFormFieldKeys`

递归走组件树：

| 节点 | 行为 |
|------|------|
| `subform` / `block` | 进入 `children` 继续 |
| `FORM_COMPONENT_TYPES`（input/select/…） | `props.fieldName` trim 后必须非空 |
| button / divider 等 | 忽略 |

失败则列出缺「字段名称」的项并中止下载，避免导出 `key` 落到 `label`/`type` 兜底的不稳定路径（`getFieldKey` 仍有 fallback，但 UI 已拦住空 fieldName）。

#### 步骤 2：`generateFormConfig` 造数据对象（JS/TS 共用）

**顶层**：

- `formTitle` ← `pageSettings.formTitle || 'form'`
- `formKey`：标题转近似驼峰（去空格/`_`/`-`，首字母小写），作为外层对象键
- `layout` ← `pageSettings.layout || 'grid'`

结果形状：

```ts
{
  [formKey]: {
    title: formTitle,
    layout: 'grid' | 'inline' | 'vertical',
    fields: FieldConfig[]
  }
}
```

**`collectFields`：树 → 扁平字段列表**

```javascript
const collectFields = (components) => {
  const fields = []
  components.forEach(component => {
    if (CONTAINER_TYPES.includes(component.type) && component.children) {
      fields.push(...collectFields(component.children))  // 容器本身不进 fields
    } else if (FORM_COMPONENT_TYPES.includes(component.type)) {
      fields.push(generateField(component))
    }
    // button/divider/static-text 等忽略
  })
  return fields
}
```

运行时配置是扁平 `fields[]`；设计态容器层级被摊平。

**`generateField`：`ComponentSchema` → `FieldConfig`（有值才写，保持瘦）**

1. **`key`**：`props.fieldName || label || type`（`getFieldKey`）
2. **`label`**：显示名
3. **`type`**：组件类型字符串
4. **`span`**：仅当 `props.span` 存在且 **≠ 24**（默认整行不写）
5. **`pidField`**：级联/依赖父字段
6. **`visible`**：来自 `props.visibleCondition`（函数体字符串）
7. **`options`**：仅 select/radio/checkbox/cascader  
   - `optionsType === 'async'` → `optionsApi` 字符串（后续 `toJS` 可能当代码吐出）  
   - 否则静态 `options` 数组
8. **`rules`**：`generateRules(validation)` → Element Plus / async-validator 风格数组
9. **`props`**：`filterOutputProps`  
   - 去掉 `META_PROPS`：`fieldName`、`span`、`pidField`、`visibleCondition`、`optionsType`、`optionsApi`、`options`、`defaultValue`（已提升到 FieldConfig 顶层或另处理）  
   - 去掉 `undefined` / 空字符串  
   - 留下 placeholder、disabled、size、multiple 等给消费方绑组件
10. **`defaultValue`**：有则导出；upload 未配置也固定 `[]`

**`generateRules` 要点**：

- `required`：upload 用 `trigger: 'change'`；其它 `blur`
- `type === 'string'`：`minLength`/`maxLength` → rule 的 `min`/`max`；可有 `pattern`
- `type === 'number'`：写 `min`/`max`（**当前未带 `type: 'number'`**，挂到字符串 input 上时 async-validator 可能按**长度**解释——已知坑）
- `email` → `{ type: 'email', ... }`；`phone` → 国内手机号 `pattern` 字符串

#### 步骤 3：`toJS`——对象变成可粘贴源码（关键创新点）

`JSON.stringify` 只能出 JSON；业务要可 `import` 的模块，且 `visible` / 异步 `options` 常是函数，故用手工序列化。

| 值类型 | 输出 |
|--------|------|
| null / undefined | `null` |
| boolean / number | 字面量 |
| 字符串且像代码（以 `(`、`async`、`function` 开头） | **不当字符串**，原样嵌入成真函数表达式 |
| 普通字符串 | 单引号优先；含 `'` 则双引号，并转义 |
| 数组 | 全是简单短值且行宽 &lt; 80 → 一行；否则多行缩进 |
| 对象 | 过滤 `undefined`；合法标识符 key 不加引号，否则 `'中文key'`；递归 `toJS` |

```javascript
// JSON.stringify：{ "key": "value", "visible": "(form) => ..." }
// toJS：         { key: 'value', visible: (form) => ... }

if (isCodeExpression(value)) return value          // 函数体不套引号
const key = isValidIdentifier(k) ? k : `'${k}'`    // 合法标识符不加引号
```

`isValidIdentifier`：`/^[a-zA-Z_$][a-zA-Z0-9_$]*$/`。

**面试重点**：为什么不用 `JSON.stringify()`？JSON 里函数只能当字符串，运行时常要 `eval`；JS/TS 模块里函数应是真实代码，需自研序列化器区分「代码字符串」和「数据字符串」。

#### 步骤 4：JS vs TS 只差外壳

两者都是：`const config = generateFormConfig(...)` → `const body = toJS(config, 1)`。

**JS**（`generateFormConfigJS`）：

```js
const formConfig = { ... }

export default formConfig
```

**TS**（`generateFormConfigTS`）：

- 文件头**内联** `ValidationRule` / `FieldConfig` / `FormConfig`（自包含，业务仓不必依赖本仓库类型）
- `const formConfig: FormConfig = { ... }`
- `export default formConfig`

注意：内联类型里仍有 `columns: number`，而 `generateFormConfig` 当前未输出 `columns`（注释预留），类型与实值略不一致。

同文件 `generateFormConfigJSON` 是同一 `config` 走 `JSON.stringify`，**没有** `toJS` 的函数还原能力。  
后半的 `generateAsyncValidatorRules` / `generateFormLogicModule` 走 `collectFieldMeta`，**不是**导出 JS/TS 配置主路径。

#### 消费侧提醒（面试可提）

- Element Plus：按字段取 `field.rules` 挂到 `el-form-item`，或收成 `{ [key]: rules }`；不能把整份 `formConfig` 直接当 `el-form` 的 `rules`。
- number 的 `min`/`max` 建议带 `type: 'number'`，且绑定值是 number / `el-input-number`。

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

### 5.2 EditorPage.vue（编辑器胶水层）

**文件**：`src/views/EditorPage.vue`

`App.vue` 只负责挂载路由；**真正的三栏编辑器 + 工具栏 + 快捷键**在 EditorPage：

- 工具栏 → 预览 / Schema 导入导出 / 撤销重做 / JS·TS 配置 / 校验规则 / 表单模块 / 生成 Vue 代码
- 左侧 → MaterialPanel（vuedraggable clone 源）
- 中间 → CanvasRenderer（vuedraggable 接收端 + 排序）
- 右侧 → PropertyPanel（属性编辑）
- 内联 → 全局键盘快捷键（Ctrl+Z/Y/C/V, Delete）

路由：`src/router/index.ts` 中 `/` → `EditorPage`。

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

通过 PageSchema（JSON 数据）作为中间接口。设计器负责"写"Schema（拖拽直接改数组 + Store actions），渲染引擎负责"读"Schema（通过 props），两者互不感知对方的存在。CodeGenerator / FormConfigGenerator 是额外的"读者"，证明了架构的可扩展性。

### 6.3 撤销/重做的实现原理？

基于快照 + **双栈**（Snapshot + past/future）：

- 每次修改后 `JSON.parse(JSON.stringify(pageSchema))` 深拷贝推入 `history.past`，并清空 `history.future`
- undo：把 past 栈顶弹入 future，再用 past 新栈顶恢复 `pageSchema`
- redo：把 future 栈顶弹回 past，并恢复
- past 保留初始基线，故 `past.length > 1` 才能 undo
- `maxSize: 50` 防止 past 无限增长
- vuedraggable 的 `@change` 中调用 `saveHistory()`，覆盖拖入/排序

### 6.4 如何添加一种新组件？

建议步骤：

1. `materials/index.ts` 中新增物料元数据；若有独立 Vue 实现则 `registerMaterial` / 写入 `materialComponents`
2. `ComponentRenderer.vue` 中新增模板分支，或挂到渲染器内部的 Element Plus 映射
3. `CodeGenerator.vue` 与 `FormConfigGenerator.ts` 中补导出分支（若该类型需要出现在产物里）
4. `MaterialPanel.vue` 的 `iconMap` 添加图标映射

### 6.5 拖拽方案的演进路径（面试展示架构思维）

```
第一版：原生 HTML5 DnD 全搞定（简单但动画差、移动端不支持）
   ↓
第二版：HTML5 DnD（物料拖入）+ SortableJS（画布排序）双引擎
       优势：动画丝滑、触摸支持
       问题：两套事件系统、dropEffect 匹配坑、拖拽 composable 臃肿
   ↓
第三版（当前）：vuedraggable group+clone 统一方案
       优势：一套 API、Store 零拖拽状态、代码集中在两个 <draggable> 标签
       代价：物料面板预览从交互组件简化为图标
```

**面试要点**：能讲出这个演进路径，说明你理解了"每次重构解决了什么问题、代价是什么"——这是高级工程师的思维模式。

### 6.6 架构的当前局限（面试中展示深度思考）

1. **ComponentRenderer 违反开闭原则** — 多种组件的渲染逻辑集中在一个文件中
2. **模板重复** — MaterialPanel + ComponentRenderer + CodeGenerator 三处各有一套按类型的分支逻辑（iconMap / 模板分支 / switch-case）
3. **容器递归未统一** — subform 在 ComponentRenderer 中用递归，block 用了独立 BlockRenderer 组件
4. **物料 Vue 组件未充分利用** — `materials/base/` 下已有 button/input/block/cascader 的 .vue，但画布仍主要内联 Element Plus / 局部映射，未统一走注册表
5. **vuedraggable 破坏画布布局** — `<draggable>` 组件渲染为单个 DOM 元素包裹所有子组件，外层 CSS 需要配合处理
6. **HTML5 DnD 残余** — ComponentRenderer 的 subform（及 Block）分支仍使用原生 `@dragover`/`@drop` 处理子组件拖入，未完全迁移到 vuedraggable
7. **快捷键重复** — EditorPage 内联一套，`useKeyboard()` 另有一套且可能未被使用

---

## 实用的文件阅读顺序速查

```
第 1 步: src/core/schema/types.ts                 ← 数据模型
第 2 步: src/stores/editorStore.ts                ← 状态中枢（双栈历史，无拖拽状态）
第 3 步: src/materials/index.ts                   ← 物料定义（精读 input/block/select）
第 4 步: src/core/renderer/ComponentRenderer.vue  ← 渲染核心（分段读）
第 5 步: src/core/renderer/CanvasRenderer.vue     ← 画布 + vuedraggable
第 6 步: src/components/MaterialPanel.vue         ← 物料面板 + clone
第 7 步: src/core/renderer/PreviewRenderer.vue    ← 预览容器（对比理解）
第 8 步: src/views/EditorPage.vue                 ← 编辑器壳 + 快捷键 + 导出入口
第 9 步: src/components/PropertyPanel.vue         ← 属性编辑
第 10 步: src/components/CodeGenerator.vue        ← Vue SFC 代码生成
第 11 步: src/core/generator/FormConfigGenerator.ts ← JS/TS 配置等导出
第 12 步: src/router/index.ts + src/App.vue       ← 路由与根壳
第 13 步: src/main.ts                             ← 应用入口
（可选）src/composables/useDraggable.ts          ← 仅 useKeyboard，勿当拖拽引擎
```

---

## 可能被问到的面试问题

1. **"低代码编辑器的核心数据结构是什么？"** → PageSchema / ComponentSchema（参考 types.ts）
2. **"设计态和预览态如何共用渲染器？"** → selectedId prop 控制模式切换（参考 ComponentRenderer.vue）
3. **"拖拽系统如何工作？最终方案是什么？"** → vuedraggable group+clone：物料面板 `pull: 'clone'` + 画布 `v-model` 同一 group（MaterialPanel + CanvasRenderer）
4. **"拖拽方案经历了哪些迭代？为什么？"** → 原生 DnD → 双引擎 → vuedraggable 统一（参考 6.5）
5. **"clone 函数为什么要在面板端生成 ID？"** → 每次拖入生成唯一实例，避免 ID 冲突
6. **"撤销重做怎么实现的？"** → 深拷贝快照 + past/future 双栈；拖拽 `@change` 触发 `saveHistory()`（参考 editorStore.ts）
7. **"如何保证输入框中 Backspace 不删除组件？"** → `isInputFocused()` 前置检查（参考 EditorPage.vue）
8. **"栅格布局怎么做的？"** → 24 栅格 + `calc()`（参考 ComponentRenderer 的 componentLayoutStyle）
9. **"JS/TS 导出和 JSON 导出的区别？"** → 函数体输出为真实代码（参考 FormConfigGenerator.ts 的 toJS）
10. **"为什么不用 JSON.stringify？"** → 需要区分代码字符串和普通字符串
11. **"容器组件如何处理子组件？"** → 递归 ComponentRenderer / BlockRenderer / 递归 collectFields
12. **"Store 为什么没有拖拽状态？也没有 addComponent？"** → vuedraggable 的 v-model 直接改数组；Store 只管选中/删除/历史/剪贴板等

---

## 阅读建议

1. **先理解数据流，再看组件细节** — 画"物料 clone→vuedraggable v-model→Store 响应式→CanvasRenderer 重渲染"的完整链路
2. **重点关注架构演进** — 理解每版方案解决了什么、代价是什么（参考第 6.5 节）
3. **关注 vuedraggable 的配置组合** — `group` / `pull` / `put` / `clone` / `handle` / `:sort` 决定拖拽行为
4. **调试运行** — 打开 `http://127.0.0.1:5173/jat-LowCodeForm/`（注意 Vite `base`），拖拽组件观察 Vue DevTools 中 store 的变化
5. **手写核心逻辑** — 不看代码手写 `componentLayoutStyle`、`cloneMaterial`、`handleChange`、以及 past/future 的 undo/redo
