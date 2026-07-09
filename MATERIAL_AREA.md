# 物料区实现详解

https://gitee.com/shiroha301/low-code-edit

物料区的实现分为 **三层**：数据定义层、UI 展示层、交互层。

---

## 一、数据定义层 — `src/materials/index.js`

物料系统的核心，本质是一个**物料注册中心**，包含三个部分。

### 1.1 物料元数据数组 `materials[]`

声明式定义 16 种组件，每条物料元数据包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `type` | string | 组件类型标识（如 `input`、`button`） |
| `name` | string | 中文显示名称 |
| `icon` | string | 图标标识名 |
| `category` | string | 分类（`basic` / `form` / `layout`） |
| `propsSchema` | object | 属性 Schema，声明该组件有哪些可配置属性 |
| `defaultProps` | object | 拖入画布时的默认属性值 |
| `defaultStyles` | object | 默认内联样式 |
| `isContainer` | boolean | 是否容器组件（能否接收子组件） |
| `childrenTypes` | string[] | 容器组件允许的子组件类型白名单 |

`propsSchema` 中每个属性包含：
- `type` — 属性值类型（`string` / `boolean` / `number` / `array`）
- `enum` — 可选值列表（如 size: `['large', 'medium', 'small']`）
- `default` — 默认值

示例 — `input` 物料定义：
```js
{
  type: 'input',
  name: '输入框',
  icon: 'Edit',
  category: 'basic',
  propsSchema: {
    placeholder: { type: 'string', default: 'Please input' },
    disabled:   { type: 'boolean', default: false },
    size:       { type: 'string', enum: ['large', 'medium', 'small'], default: 'small' },
    maxlength:  { type: 'number', default: undefined },
    showWordLimit: { type: 'boolean', default: false }
  },
  defaultProps: {
    placeholder: 'Please input',
    disabled: false,
    size: 'small',
    maxlength: undefined,
    showWordLimit: false
  },
  defaultStyles: { width: '100%', margin: '8px' },
  isContainer: false
}
```

### 1.2 物料组件映射 `materialComponents{}`

将 `type` 映射到实际的 Vue 组件实现：

```js
const materialComponents = {
  button: Button,   // → src/materials/base/Button/index.vue
  input: Input      // → src/materials/base/Input/index.vue
}
```

目前只有 `button` 和 `input` 有对应的 `.vue` 文件实现，其余 14 种直接由 `ComponentRenderer.vue` 使用 Vue 动态组件 `<component :is="...">` 渲染 Element Plus 原生组件。

### 1.3 导出的 API

| API | 作用 |
|------|------|
| `getMaterials()` | 获取全部物料列表 |
| `getMaterialByType(type)` | 按类型查找物料 |
| `getComponentByType(type)` | 获取物料对应的 Vue 组件 |
| `registerMaterial(material, component)` | 动态注册新物料（预留） |
| `unregisterMaterial(type)` | 注销物料（预留） |

---

## 二、UI 展示层 — `src/components/MaterialPanel.vue`

左侧 200px 固定宽度面板，负责将物料列表**可视化展示**给用户。

### 2.1 整体结构

```
┌──────────────────┐
│    物料库         │  ← <h3> 标题
│  ┌─────────────┐ │
│  │  表单组件    │ │  ← el-tabs 分类切换（目前仅一个 Tab）
│  │             │ │
│  │  ┌────────┐ │ │
│  │  │ 预览区  │ │ │  ← .material-item 卡片（draggable="true"）
│  │  │ 组件名  │ │ │
│  │  └────────┘ │ │
│  │  ┌────────┐ │ │
│  │  │ 预览区  │ │ │
│  │  │ 组件名  │ │ │
│  │  └────────┘ │ │
│  │    ...      │ │
│  └─────────────┘ │
└──────────────────┘
```

### 2.2 分类过滤

通过 `computed` 按分类过滤物料：

```js
const materials = getMaterials()                    // 全部 16 种
const formMaterials = computed(() =>
  materials.filter(m => m.category === 'form')      // 当前仅展示 form 类
)
```

### 2.3 组件预览

每个物料卡片根据 `material.type` 使用 **v-if/v-else-if 链**，为 14 种有特殊结构的组件渲染**接近真实 Element Plus 组件的迷你预览**：

| 物料 type | 预览方式 | 实际渲染 |
|-----------|----------|----------|
| `textarea` | 真实组件 | `<el-input type="textarea" size="small">` |
| `number` | 真实组件 | `<el-input-number size="small">` |
| `radio` | 真实组件 | `<el-radio>` × 2 |
| `checkbox` | 真实组件 | `<el-checkbox>` × 2 |
| `select` | 真实组件 | `<el-select>` 含 2 个 option |
| `date` | 真实组件 | `<el-date-picker>` |
| `time` | 真实组件 | `<el-time-picker>` |
| `switch` | 真实组件 | `<el-switch>` |
| `slider` | 真实组件 | `<el-slider>` |
| `rate` | 真实组件 | `<el-rate>` |
| `upload` | 真实组件 | `<el-upload>` + el-button |
| `divider` | 真实组件 | `<el-divider>` |
| `static-text` | 自定义 | `<div>` 带 fontSize/color 样式 |
| `subform` | 自定义 | `<div>` 模拟容器边框 |

其余类型（如 `button`、`input`、`container` 等）走 `v-else` 分支，仅显示 Element Plus 图标。

### 2.4 拖拽绑定

每个卡片绑定 HTML5 拖拽事件：

```html
<div
  class="material-item"
  draggable="true"
  @dragstart="handleDragStart($event, material)"
  @dragend="handleDragEnd"
>
```

`handleDragStart` 和 `handleDragEnd` 来自 `useDraggable()` 组合式函数。

---

## 三、交互层 — `src/composables/useDraggable.js`

处理从物料区到画布的完整拖拽流程：

```
物料卡片 (dragstart)                画布区域 (dragover + drop)
      │                                    │
      ├─ 将物料元数据序列化为 JSON           ├─ 计算插入位置，显示占位线
      │  写入 event.dataTransfer            │
      ├─ 设置 store.isDragging = true       ├─ 反序列化 JSON
      └───────────────────────────────────▶ └─ 创建组件实例 → store.addComponent()
```

### 3.1 handleDragStart

```js
function handleDragStart(event, material) {
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/json', JSON.stringify(material))
  store.setDragging(true)
}
```

将整个 `MaterialMeta` 对象序列化放入 `dataTransfer`，画布侧 drop 时可直接读取。

### 3.2 handleDragOver

在画布上根据鼠标 Y 坐标计算插入位置，设置 `store.dragPlaceholderStyle`，`CanvasRenderer.vue` 据此渲染一条蓝色占位线。

### 3.3 handleDrop

```js
function handleDrop(event) {
  const data = JSON.parse(event.dataTransfer.getData('application/json'))
  const component = {
    id: generateId(),
    type: data.type,
    label: data.name,
    props: { ...data.defaultProps },
    styles: { ...data.defaultStyles }
  }
  store.addComponent(component)
}
```

从 `dataTransfer` 反序列化物料数据，用 `defaultProps` + `defaultStyles` 创建组件实例，插入画布。

### 3.4 键盘快捷键

`useDraggable.js` 还负责全局键盘事件监听（与拖拽无关，但同属交互层）：

| 快捷键 | 操作 |
|--------|------|
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Delete/Backspace | 删除选中组件 |
| Ctrl+C | 复制 |
| Ctrl+V | 粘贴 |

---

## 四、整体数据流

```
materials/index.js         MaterialPanel.vue
┌──────────────┐          ┌──────────────────┐
│  元数据定义   │─────────▶│  可视化展示 +     │
│  propsSchema │  读取     │  dragstart 监听   │
│  defaults    │          └──────┬───────────┘
└──────────────┘                │ 拖拽
                                ▼
                         useDraggable.js
                    ┌──────────────────────┐
                    │ 序列化物料 →          │
                    │ dataTransfer (JSON)   │
                    │                      │
                    │ drop 后创建组件对象    │
                    │ → store.addComponent()│
                    └──────────┬───────────┘
                               │
                               ▼
                         editorStore.js
                    ┌──────────────────────┐
                    │  写入 pageSchema      │
                    │  + 记录到 history 栈  │
                    └──────────┬───────────┘
                               │
                               ▼
                    CanvasRenderer.vue
                    ┌──────────────────────┐
                    │ ComponentRenderer.vue │
                    │ → Element Plus 组件   │
                    └──────────────────────┘
```

---

## 五、物料组件完整清单（16 种）

| # | type | 名称 | 分类 | 容器 | Vue 文件 |
|---|------|------|------|------|----------|
| 1 | `button` | 按钮 | basic | 否 | `materials/base/Button/index.vue` |
| 2 | `input` | 输入框 | basic | 否 | `materials/base/Input/index.vue` |
| 3 | `textarea` | 多行文本框 | form | 否 | 无（动态渲染） |
| 4 | `number` | 数字输入框 | form | 否 | 无（动态渲染） |
| 5 | `radio` | 单选按钮组 | form | 否 | 无（动态渲染） |
| 6 | `checkbox` | 复选框组 | form | 否 | 无（动态渲染） |
| 7 | `select` | 下拉选择器 | form | 否 | 无（动态渲染） |
| 8 | `date` | 日期选择器 | form | 否 | 无（动态渲染） |
| 9 | `time` | 时间选择器 | form | 否 | 无（动态渲染） |
| 10 | `switch` | 开关 | form | 否 | 无（动态渲染） |
| 11 | `slider` | 滑块 | form | 否 | 无（动态渲染） |
| 12 | `rate` | 评分 | form | 否 | 无（动态渲染） |
| 13 | `upload` | 文件上传 | form | 否 | 无（动态渲染） |
| 14 | `divider` | 分隔线 | form | 否 | 无（动态渲染） |
| 15 | `static-text` | 静态文本 | form | 否 | 无（动态渲染） |
| 16 | `container` | 容器 | layout | **是** | 无（动态渲染） |
| 17 | `subform` | 子表单 | form | **是** | 无（动态渲染） |

---

## 六、关键设计点

### 6.1 预览即真实组件

`MaterialPanel.vue` 中的预览区直接使用 Element Plus 真实组件渲染（如 `<el-input>`、`<el-select>`），而非静态截图或图标。好处是用户能直观看到控件的真实外观。

### 6.2 两层渲染路径

物料在**物料区**和**画布**上的渲染走不同路径：

| 位置 | 渲染方式 |
|------|----------|
| 物料区（MaterialPanel） | 直接写死各种 Element Plus 组件的 HTML 片段 |
| 画布（ComponentRenderer） | 动态组件 `<component :is="...">` + 特殊模板分支 |

### 6.3 预留扩展能力

`registerMaterial()` / `unregisterMaterial()` 提供了运行时注册/注销物料的能力，目前未被 UI 调用，属于面向未来的扩展点。

### 6.4 容器组件

`container` 和 `subform` 的 `isContainer: true` 标记使其能接收子组件。`childrenTypes` 白名单限制了可放入的子组件类型——例如 `container` 只能放 `button`/`input`/`text`，而 `subform` 能放大部分表单组件但不能嵌套 `subform`（防止无限递归）。
