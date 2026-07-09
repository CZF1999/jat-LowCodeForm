# 会话工作总结 (2026-07-09)

> 本文件记录本次会话中完成的所有功能开发，用于新会话快速恢复上下文。

---

## 一、表单配置 JS 导出（新增功能）

### 目标
新增声明式表单配置导出通道，输出 `.js` 文件（非 JSON），供运行时动态表单渲染器消费。

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/core/generator/FormConfigGenerator.js` | JS 代码生成器：组件树 → JS 表单配置 |

### 修改文件
| 文件 | 改动 |
|------|------|
| `src/core/schema/types.ts` | 新增 `FormConfig`、`FieldConfig`、`ValidationRule` 接口 |
| `src/materials/index.js` | 12 种表单物料新增 `fieldName`、`span`、`visibleCondition`；select/radio/checkbox 额外增加 `pidField`、`optionsType`、`optionsApi` |
| `src/stores/editorStore.js` | `pageSchema.settings` 增加 `formTitle`、`layout`、`columns` |
| `src/components/PropertyPanel.vue` | 新增「表单级配置」「布局配置」「高级配置」3 个编辑区；用 `SKIP_PROPS` 过滤重复属性 |
| `src/App.vue` | 工具栏新增「导出表单配置」按钮，调用 `FormConfigGenerator` |

### 输出格式示例
```javascript
const formConfig = {
  address: {
    title: '地址选择申请',
    layout: 'grid',
    columns: 2,
    fields: [
      {
        key: 'province',
        label: '省份',
        type: 'select',
        span: 12,
        options: async (_, formData) => { ... },  // 真实函数，非字符串
        rules: [{required: true, message: '请选择省份', trigger: 'blur'}]
      },
      {
        key: 'city',
        label: '城市',
        type: 'select',
        span: 12,
        pidField: 'province',
        visible: (formData) => !!formData.province,
        options: async (_, formData) => { ... }
      }
    ]
  }
}
export default formConfig
```

---

## 二、组件排序（新增功能）

### 目标
画布中已放置的组件支持拖拽重排位置。

### 修改文件
| 文件 | 改动 |
|------|------|
| `src/stores/editorStore.js` | 新增 `insertComponentAt(component, index)`、`moveComponent(id, toIndex)`；新增 `dragType`、`insertionIndex` 状态 |
| `src/composables/useDraggable.js` | 重写：支持两种拖拽模式（material 新增 / component 排序）；`calculateInsertionIndex()` 根据鼠标 Y 坐标计算插入位置；修正 `dropEffect` 匹配 `effectAllowed` |
| `src/core/renderer/CanvasRenderer.vue` | 组件间渲染插入指示线 `drop-indicator`；直接从 store 读取拖拽状态 |
| `src/core/renderer/ComponentRenderer.vue` | 左侧新增拖拽手柄（Rank 图标，hover 显示）；`@dragstart` 设置组件移动数据 |

### 踩坑：HTML5 Drag & Drop 规范
组件排序 `effectAllowed = 'move'`，但 `handleDragOver` 统一设 `dropEffect = 'copy'`。浏览器规范要求 `dropEffect` 必须在 `effectAllowed` 允许范围内，`'copy'` 不在 `'move'` 允许范围 → 浏览器静默拒绝 drop。修复：根据 `dragType` 动态设置。

---

## 三、键盘快捷键修复

### 问题
属性面板输入框中按 Backspace 会删除整个组件，而非删除文字。

### 原因
`useDraggable.js` 中 `document.addEventListener('keydown', ...)` 全局监听，Backspace 绑定 `deleteComponent`，输入框中的键盘事件冒泡到 document。

### 修复
在 `handleKeyDown` 开头增加 `isInputFocused()` 判断：检测 `document.activeElement` 是否为 INPUT/TEXTAREA/SELECT 或 contentEditable，是则直接 return 让浏览器原生处理。同时为所有快捷键增加 `event.preventDefault()` 防止浏览器回退页面等副作用。

---

## 四、栅格布局（grid/inline/vertical）

### 目标
画布支持三种布局模式，组件按 `span`（1-24 栅格）控制宽度。

### 修改文件
| 文件 | 改动 |
|------|------|
| `src/core/renderer/CanvasRenderer.vue` | 新增 `canvas-layout-grid/inline/vertical` CSS class；传递 `pageSettings` 给子组件 |
| `src/core/renderer/ComponentRenderer.vue` | 新增 `componentLayoutStyle` 计算属性：grid 模式 `calc((span/24*100)% - 8px)`，inline 模式 `auto`，vertical 模式 100% |
| `src/core/renderer/PreviewRenderer.vue` | 同步添加布局 class + 传递 pageSettings（之前预览不响应布局） |
| `src/components/CodeGenerator.vue` | 生成代码时 el-form 带 `form-layout-*` class + el-form-item 带 span 宽度 style（之前生成的代码无布局） |

---

## 五、属性面板整理

### 问题
`span`、`fieldName`、`pidField` 等属性在通用「属性」区和专用配置区同时出现。

### 修复
新增 `SKIP_PROPS` 集合 + `visibleProps` 计算属性，过滤掉 7 个已有专用 UI 的属性（span/fieldName/pidField/visibleCondition/optionsType/optionsApi/options）。

---

## 六、Block 组件（新增物料）

### 新增文件
| 文件 | 说明 |
|------|------|
| `src/materials/base/Block/index.vue` | 区块容器组件：标题栏 + 子组件递归渲染 + 拖入子组件 + 空状态提示 |

### 修改文件
| 文件 | 改动 |
|------|------|
| `src/materials/index.js` | block 物料补全（propsSchema/defaultProps/defaultStyles/isContainer/childrenTypes）；import + 注册 Block 到 materialComponents |
| `src/core/renderer/ComponentRenderer.vue` | 新增 `block` 渲染分支（使用 BlockRenderer）；新增 `button` 渲染分支（`<el-button>`） |
| `src/components/CodeGenerator.vue` | 重写：新增 block 容器生成 + button 按钮生成；`collectFromTree` 递归收集容器内表单字段和验证规则；`containerTypes = ['subform', 'block']` |
| `src/core/generator/FormConfigGenerator.js` | `collectFields` 改为递归方式，`CONTAINER_TYPES = ['subform', 'block']` |

---

## 七、导出的 JS 格式优化

将导出格式从 JSON 改为 JS，关键改进：
- 字段 key 无引号（`key:` 而非 `"key":`）
- 函数体（visible/options/render）为真实 JS 代码，非字符串
- `toJS()` 自定义序列化器：自动识别函数体、合法标识符不加引号、数组/对象合理缩进
- 顶层 `const formConfig = ...` + `export default formConfig`

---

## 当前项目结构（新增/修改的模块标注 ★）

```
src/
├── core/generator/
│   └── FormConfigGenerator.js      ★ 新增：JS 表单配置导出
├── core/schema/types.ts            ★ 修改：新增 FormConfig/FieldConfig 类型
├── core/renderer/
│   ├── CanvasRenderer.vue          ★ 修改：布局系统 + 排序指示器
│   ├── ComponentRenderer.vue       ★ 修改：span 宽度 + 拖拽手柄 + block/button 渲染
│   └── PreviewRenderer.vue         ★ 修改：布局系统
├── composables/useDraggable.js     ★ 重写：双模式拖拽 + 输入防冲突
├── stores/editorStore.js           ★ 修改：移动/插入组件 + 拖拽状态
├── materials/
│   ├── index.js                    ★ 修改：物料高级属性 + block 注册
│   └── base/
│       ├── Block/index.vue         ★ 新增：区块容器
│       ├── Button/index.vue
│       └── Input/index.vue
├── components/
│   ├── PropertyPanel.vue           ★ 修改：7 个配置区 + 重复过滤
│   ├── CodeGenerator.vue           ★ 重写：递归容器 + block/button 生成 + 布局
│   └── MaterialPanel.vue
└── App.vue                         ★ 修改：导出按钮 + 布局集成
```

---

## 关键数据流

```
物料面板 ──drag──▶ 画布 ──▶ Store (pageSchema.components)
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
         Schema导出  JS配置导出  Vue SFC代码
         (JSON)     (.js 可运行)  (完整组件)
```

## 布局系统

```
pageSettings.layout ──▶ grid / inline / vertical
component.props.span ──▶ 宽度 = (span/24) × 100%
                        │
         ┌──────────────┼──────────────┐
         ▼              ▼              ▼
   CanvasRenderer  PreviewRenderer  CodeGenerator
   (实时编辑)       (预览)           (代码生成)
```

## 容器递归

```
subform / block 容器
  └─ children[] 递归展开
       ├─ CodeGenerator: collectFromTree() 收集字段+规则
       └─ FormConfigGenerator: collectFields() 递归展开
```

---

---

## 八、引入 SortableJS 替代原生组件排序拖拽（2026-07-09）

### 目标
用 SortableJS（`sortablejs` npm 包）替代原先基于原生 HTML5 Drag & Drop API 的画布内组件排序，保留物料拖入使用原生 API。

### 架构：双引擎拖拽

```
物料面板 ──HTML5 DnD──▶ 画布（useDraggable.js）
画布内排序     ──SortableJS──▶ 画布（CanvasRenderer.vue 中集成）
键盘快捷键     ──useDraggable.js
```

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/composables/useDraggable.js` | 移除 `handleComponentDragStart`、组件排序逻辑；`handleDragOver` 统一 `dropEffect='copy'`；`handleDrop` 仅处理物料创建；不再导出 `handleComponentDragStart` |
| `src/core/renderer/CanvasRenderer.vue` | 新增 `Sortable.create()` 集成：`draggable: '.lc-component'`、`handle: '.drag-handle'`、`animation: 150`；`onEnd` 回调调用 `editorStore.moveComponent()`；新增 ghost/chosen/drag CSS class |
| `src/core/renderer/ComponentRenderer.vue` | 拖拽手柄移除 `draggable="true"` 和 `@dragstart`/`@dragend`（SortableJS 自动接管）；移除 3 个 dead 函数（`handleComponentDragStart`/`handleDragStart`/`handleDragEndEmit`）；移除未使用的 `useEditorStore` 引用 |
| `package.json` | 移除未使用的 `vuedraggable`（Vue 2 版本），保留 `sortablejs` |
| `ARCHITECTURE.md` | 更新交互层描述 |
| `CODE_READING_GUIDE.md` | 重写第三阶段：双引擎拖拽章节 + 新增 SortableJS 面试题 |

### SortableJS 关键优势 vs 原生方案

| 维度 | 原生 HTML5 DnD（旧） | SortableJS（新） |
|------|---------------------|-----------------|
| 动画 | 无 | 150ms 平滑过渡 |
| 移动端 | 不支持 | 原生触摸支持 |
| 边界处理 | 手写 | 库已处理 |
| 代码量 | ~60 行分散在 3 个文件 | ~25 行集中在 initSortable |
| dropEffect 坑 | 有（move vs copy 匹配问题） | 无（不使用 HTML5 DnD） |

### 为什么 SortableJS 和 HTML5 DnD 不冲突
SortableJS 使用鼠标/触摸事件（mousedown/mousemove/mouseup），HTML5 DnD 使用拖拽事件（dragstart/dragover/drop），两套独立的事件系统在同一画布上共存。

### 已知注意事项

1. `useDraggable` 在 `App.vue` 和 `MaterialPanel.vue` 中各实例化一次，键盘监听器双份（功能正确但可优化为单例）
2. 物料 `materialComponents` 中只有 button/input/block 有专用组件，其余类型由 ComponentRenderer 内联渲染
3. JS 导出的函数体字符串由 `isCodeExpression()` 检测（以 `(`/`async`/`function` 开头即为代码）
4. `IMPLEMENTATION_PLAN.md` 保留作为原始设计方案参考
