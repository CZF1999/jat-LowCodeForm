# 整体架构分析：设计器与渲染引擎的解耦

---

## 一、总体架构

这是一个 **Schema 驱动的、以 Store 为中心的** 低代码表单编辑器。核心思想：一切围绕 `PageSchema`（JSON 数据）运转，各个模块通过读写 Schema 协作，而不是直接互相调用。

```
                        ┌─────────────────────┐
                        │     PageSchema       │
                        │    (JSON 数据)       │
                        │  唯一的真相来源       │
                        └─────────┬───────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
   ┌──────────────┐      ┌──────────────┐       ┌──────────────┐
   │   设计态       │      │   预览态      │       │   代码生成     │
   │  (Designer)   │      │  (Preview)   │       │  (Code Gen)  │
   │              │      │              │       │              │
   │ CanvasRenderer│     │PreviewRenderer│      │CodeGenerator │
   │ + 编辑外框    │      │ + 纯净渲染     │      │ → Vue3 SFC  │
   └──────────────┘      └──────────────┘       └──────────────┘
          │                       │                       │
          └───────────────────────┘                       │
                  │                                       │
                  ▼                                       │
          ┌──────────────────┐                            │
          │ComponentRenderer │◄────────────────────────────┘
          │  (共享渲染器)     │     读取同一份 component[]
          └──────────────────┘
```

---

## 二、分层架构

```
┌──────────────────────────────────────────────────────────┐
│  UI 面板层 (components/)                                   │
│  MaterialPanel  │  PropertyPanel  │  CodeGenerator       │
├──────────────────────────────────────────────────────────┤
│  交互层 (composables/)                                    │
│  useDraggable (物料拖入 + 键盘快捷键)                       │
│  + SortableJS (画布内组件排序，在 CanvasRenderer 中集成)      │
├──────────────────────────────────────────────────────────┤
│  渲染引擎 (core/renderer/)                                │
│  CanvasRenderer → ComponentRenderer → Element Plus 组件   │
│  PreviewRenderer → ComponentRenderer → Element Plus 组件   │
├──────────────────────────────────────────────────────────┤
│  Schema 层 (core/schema/)                                 │
│  types.ts (接口定义) │ validator.ts (校验) │ version.ts   │
├──────────────────────────────────────────────────────────┤
│  状态管理 (stores/)                                       │
│  editorStore.js (pageSchema, 选中, 撤销, 剪贴板)          │
├──────────────────────────────────────────────────────────┤
│  物料系统 (materials/)                                    │
│  index.js (元数据注册中心) + base/ (具体 Vue 组件)         │
└──────────────────────────────────────────────────────────┘
```

### 各层职责

| 层 | 路径 | 职责 | 依赖方向 |
|----|------|------|----------|
| UI 面板 | `components/` | 用户交互界面 | → 读取 Store，触发 Action |
| 交互层 | `composables/` | 拖拽、快捷键 | → 操作 DOM / 调用 Store |
| 渲染引擎 | `core/renderer/` | 将 Schema 渲染为 Vue 组件 | → 读取 Schema，emit 事件 |
| Schema 层 | `core/schema/` | 数据模型定义与校验 | 零依赖（纯数据） |
| 状态管理 | `stores/` | 数据中枢 | → 读写 pageSchema |
| 物料系统 | `materials/` | 组件定义 | 被 UI 和渲染引擎读取 |

依赖方向是 **单向向下**：上层读写 Store → Store 修改 Schema → 渲染引擎响应式更新。

---

## 三、设计器与渲染引擎的分离/解耦

### 3.1 核心机制：共享渲染器 + Props 控制模式

整个项目**只有一个组件渲染器** — `ComponentRenderer.vue`。设计态和预览态通过同一个组件渲染，差异仅由 `selectedId` prop 控制：

```js
// CanvasRenderer.vue（设计态）
<ComponentRenderer
  :component="component"
  :selected-id="selectedId"    // ← 传入真实 ID，启用编辑 UI
  @select="..."
  @delete="..."
/>

// PreviewRenderer.vue（预览态）
<ComponentRenderer
  :component="component"
  :selected-id="null"          // ← 传入 null，隐藏所有编辑 UI
/>
```

`ComponentRenderer` 内部的模式切换逻辑：

| prop 条件 | 行为 |
|-----------|------|
| `selectedId === component.id` | 显示蓝色选中边框 + 操作按钮（删除/复制） |
| `selectedId !== component.id` | 普通渲染，hover 有浅色边框提示 |
| `selectedId === null` | 纯净渲染，无任何编辑外框，无 hover 效果 |

这使得**设计态只是预览态的"叠加层"**，而不是两套独立的渲染逻辑。

### 3.2 Schema 作为中间接口

设计器和渲染引擎之间不直接通信。它们通过 `PageSchema` 这个 JSON 数据格式解耦：

```
设计器 (CanvasRenderer)              渲染引擎 (PreviewRenderer)
        │                                    │
        │ emit('select')                     │
        │ emit('delete')                     │ 只读 props.components
        │ emit('update:component')           │
        ▼                                    ▼
    editorStore                        editorStore.components
        │                                    │
        └────────────┬───────────────────────┘
                     ▼
              PageSchema (JSON)
                     │
                     ▼
           可导出为 .json 文件
           可导入恢复编辑状态
           作为代码生成的输入
```

**设计器负责"写"Schema**（通过 Store 的 actions），**渲染引擎负责"读"Schema**（通过 props 传入的 components 数组）。两者互不感知对方的存在。

### 3.3 代码生成是完全独立的输出通道

`CodeGenerator.vue` 与设计器/预览器完全正交：

```
                      PageSchema.components[]
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
    CanvasRenderer      PreviewRenderer      CodeGenerator
    (响应式渲染，          (响应式渲染，          (字符串拼接，
     可编辑)               只读)                 生成 Vue SFC)
```

| 对比维度 | 设计态 | 预览态 | 代码生成 |
|----------|--------|--------|----------|
| 渲染目标 | DOM（可编辑） | DOM（只读） | 文本字符串 |
| 交互 | 选中/拖拽/删除/编辑 | 表单输入（值不持久） | 无 |
| 组件来源 | ComponentRenderer + 编辑外框 | ComponentRenderer 纯净模式 | 自定义模板字符串拼接 |
| 输出格式 | DOM 树 | DOM 树 | Vue 3 SFC 代码文本 |
| 是否依赖 Element Plus | 是 | 是 | 生成引用 Element Plus 的代码 |

值得注意的是，**代码生成器没有复用 ComponentRenderer 做 SSR/字符串化**，而是用了自己的一套 `switch-case` 模板拼接，这是因为"渲染为 DOM"和"渲染为字符串"的目标不同，强行复用反而增加耦合。

### 3.4 事件驱动的松散通信

组件之间不直接调用方法，而是通过 **props down, events up** 模式：

```
App.vue (唯一知道全局结构的地方)
  │
  ├─ props.components ──────────▶ CanvasRenderer
  │                                  │
  │                                  ├─ props.component ──▶ ComponentRenderer
  │                                  │                          │
  │                                  │  emit('select', id) ────┤
  │                                  │◄─────────────────────────┘
  │                                  │
  │  emit('select', id) ────────────▶ editorStore.selectComponent(id)
  │
  └─ props.component ─────────────▶ PropertyPanel
                                      │
                                      emit('update:component') ──▶ editorStore.updateComponent()
```

`App.vue` 作为"胶水层"连接所有模块，但 `App.vue` 自身不包含业务逻辑，只做事件路由。

### 3.5 Schema 的类型定义层

`src/core/schema/types.ts` 定义了完整的 TypeScript 接口，是设计器和渲染引擎都能理解的"协议"：

```ts
interface ComponentSchema {
  id: string
  type: string            // 组件类型 → 映射到 Element Plus 组件名
  label: string           // 显示标签
  children?: ComponentSchema[]  // 递归子组件
  props: Record<string, any>    // 透传给 Element Plus 的 props
  styles: Record<string, string> // 内联样式
  events: Record<string, Function>  // 事件绑定（已定义，未使用）
  conditions?: Condition[]    // 条件渲染（已定义，未实现）
  loops?: LoopConfig          // 循环渲染（已定义，未实现）
}

interface PageSchema {
  version: string
  info: { name, description, created, updated }
  settings: { title, backgroundColor, width, height, meta }
  components: ComponentSchema[]
}
```

---

## 四、架构优势

1. **Schema 可持久化** — `PageSchema` 是纯 JSON，可以直接导出为 `.json` 文件，也可以重新导入恢复编辑状态。设计稿可以版本控制、可以跨团队传输。

2. **渲染器可替换** — 只要理解 `ComponentSchema` 结构，就可以实现新的渲染目标（如渲染为 React 组件、渲染为移动端原生控件、生成 Angular 模板等）。`CodeGenerator` 证明了这一点的可行性——它就是一个"渲染为字符串"的渲染器。

3. **设计态和运行态互不干扰** — 编辑外框（选中边框、删除/复制按钮、内联编辑）完全通过 CSS + 条件渲染叠加，不影响 `ComponentRenderer` 的核心渲染逻辑。

4. **物料系统可扩展** — `registerMaterial()` 提供了动态注册物料的能力，新增组件类型只需：声明元数据 + 在 `ComponentRenderer` 中加一个 `<template>` 分支 + 在 `MaterialPanel` 中加一个预览 `v-if` 分支 + 在 `CodeGenerator` 中加一个 `case` 分支。（当前这四处需要手动同步，是后续可以优化的点。）

---

## 五、当前架构的局限

1. **ComponentRenderer 过于庞大** — 所有 16 种组件的渲染逻辑集中在一个文件中（580 行），新增类型需要修改这个文件，违反了开闭原则。

2. **物料 Vue 组件未被充分使用** — `materials/base/` 下的 `Button/index.vue` 和 `Input/index.vue` 实际上并未在 `ComponentRenderer` 中被引用。`ComponentRenderer` 使用自己的 `materialComponents` 映射表直接渲染 Element Plus 组件，而非调用物料目录下的 `.vue` 文件。存在两条并行的类型→组件映射路径。

3. **代码生成器与渲染器模板重复** — `CodeGenerator` 和 `ComponentRenderer` 中各有一套针对每种类型的 `switch-case` 模板。新增组件类型需要同时修改两处。

4. **条件/循环渲染未实现** — Schema 中已定义 `conditions` 和 `loops` 接口，但渲染器和属性面板均未支持。

5. **物料区预览同样重复** — `MaterialPanel.vue` 中还有第三套针对每种类型的 `v-if/v-else-if` 预览模板。三处（MaterialPanel + ComponentRenderer + CodeGenerator）需要同步维护。
