# low-code-edit 项目树结构

> 一个基于 Vue 3 + Element Plus + Pinia + Vite 的**低代码表单编辑器**，支持可视化拖拽搭建表单，导出 JS 格式的表单配置供运行时动态渲染。

---

## 完整目录树

```
low-code-edit/
│
├── .gitignore                          # Git 忽略规则 (node_modules, dist, .env 等)
├── .vscode/
│   └── extensions.json                 # VS Code 插件推荐 (Vue Volar)
│
├── index.html                          # Vite 入口 HTML，挂载点 <div id="app">
├── package.json                        # 项目清单: 依赖、脚本 (dev/build/preview)
├── package-lock.json                   # NPM 依赖锁定文件
├── vite.config.js                      # Vite 构建配置 (注册 @vitejs/plugin-vue)
├── LICENSE                             # MIT 许可证
├── README.md                           # 项目说明文档
├── IMPLEMENTATION_PLAN.md              # 表单配置导出功能实施方案
├── ARCHITECTURE.md                     # 架构文档
├── MATERIAL_AREA.md                    # 物料区文档
├── PROJECT_TREE.md                     # 本文件
│
├── public/                             # 静态资源 (直接复制到 dist)
│   ├── favicon.svg                     # 网站图标
│   └── icons.svg                       # SVG 图标精灵图
│
├── src/                                # 源代码目录
│   ├── main.js                         # 【应用入口】创建 Vue 实例，注册 Pinia/Element Plus，挂载 #app
│   ├── App.vue                         # 【根组件】三栏布局: 顶部工具栏 + 左侧物料库 + 中间画布 + 右侧属性面板
│   ├── style.css                       # 【全局样式】CSS 变量、深色模式、排版基础样式
│   │
│   ├── assets/                         # 静态资源 (Vite 模板遗留，当前未使用)
│   │   ├── hero.png
│   │   ├── vite.svg
│   │   └── vue.svg
│   │
│   ├── components/                     # 【UI 面板组件】三大功能面板
│   │   ├── MaterialPanel.vue           # 左侧物料面板: 展示可拖拽组件库列表，带实时预览
│   │   ├── PropertyPanel.vue           # 右侧属性面板: 编辑选中组件的基础信息/布局/属性/验证规则/高级配置/选项/样式
│   │   └── CodeGenerator.vue           # 代码生成弹窗: 根据组件树 + 布局配置生成完整 Vue 3 SFC 代码
│   │
│   ├── composables/                    # 【Vue 组合式函数】
│   │   └── useDraggable.js            # 拖拽功能封装: 物料拖入 / 组件排序 / 插入位置计算 / 键盘快捷键
│   │
│   ├── core/                           # 【核心引擎】
│   │   ├── renderer/                   # 渲染器: 负责在画布和预览中渲染组件
│   │   │   ├── CanvasRenderer.vue      # 画布渲染器: 拖放区域，支持 grid/inline/vertical 布局，组件间插入指示器
│   │   │   ├── ComponentRenderer.vue   # 组件渲染器: 类型→Element Plus 映射，拖拽手柄排序，响应 span 宽度
│   │   │   └── PreviewRenderer.vue     # 预览渲染器: 无编辑态的简化版，支持 grid/inline/vertical 布局
│   │   │
│   │   ├── schema/                     # Schema 数据层
│   │   │   ├── types.ts               # TypeScript 类型定义: ComponentSchema, PageSchema, FormConfig, FieldConfig 等接口
│   │   │   ├── validator.ts           # Schema 校验: 递归校验组件结构及版本格式
│   │   │   └── version.ts            # Schema 版本管理: 当前 1.0.0，支持从 0.1.0 迁移
│   │   │
│   │   └── generator/                  # 【代码生成器】
│   │       └── FormConfigGenerator.js  # 表单配置导出: 组件树 → JS 配置代码 (支持函数体/异步 options/级联依赖)
│   │
│   ├── materials/                      # 【物料系统】组件定义与注册
│   │   ├── index.js                   # 物料注册中心: 定义 16 种组件元数据 (含 span/fieldName/pidField/visibleCondition/optionsApi 等高级属性)
│   │   └── base/                       # 基础物料实现
│   │       ├── Button/
│   │       │   └── index.vue           # 按钮物料 (封装 el-button)
│   │       └── Input/
│   │           └── index.vue           # 输入框物料 (封装 el-input)
│   │
│   └── stores/                         # 【状态管理】Pinia Store
│       └── editorStore.js             # 编辑器核心 Store: 页面Schema/选中/剪贴板/拖拽状态/插入索引/撤销历史(50条)
│
└── node_modules/                       # 依赖包 (不纳入版本控制)
```

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Vue 3 | ^3.5.32 | 前端框架 (Composition API + `<script setup>`) |
| Vite | ^8.0.4 | 构建工具 & 开发服务器 |
| Pinia | ^3.0.4 | 状态管理 |
| Element Plus | ^2.13.7 | UI 组件库 (表单、按钮、弹窗等) |
| @vitejs/plugin-vue | ^6.0.5 | Vite Vue SFC 编译插件 |
| TypeScript | (隐式) | 仅用于 Schema 类型定义 (`core/schema/*.ts`) |

---

## 核心架构

```
┌──────────────────────────────────────────────────────────────────┐
│                         App.vue                                   │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────────────┐  │
│  │ Material │  │   Canvas     │  │        Property            │  │
│  │  Panel   │  │  Renderer    │  │         Panel              │  │
│  │ (左侧)   │  │  (中间)      │  │        (右侧)              │  │
│  │          │  │              │  │                            │  │
│  │ 物料列表 │──▶ 拖放画布    │◀─│ 基本信息 / 布局配置         │  │
│  │ 可拖拽   │  │ 组件排序    │  │ 属性 / 验证规则             │  │
│  │          │  │ grid布局    │  │ 高级配置 / 选项 / 样式      │  │
│  └──────────┘  └──────────────┘  └────────────────────────────┘  │
│                         │                                         │
│                         ▼                                         │
│              ┌──────────────────┐                                 │
│              │ editorStore.js   │                                 │
│              │ (Pinia 状态中枢)  │                                 │
│              │  - pageSchema    │                                 │
│              │  - selectedId    │                                 │
│              │  - dragType      │                                 │
│              │  - insertionIndex│                                 │
│              │  - history[]     │                                 │
│              │  - clipboard     │                                 │
│              └──────────────────┘                                 │
│                     │               │                             │
│                     ▼               ▼                             │
│          ┌──────────────┐  ┌──────────────────┐                   │
│          │ CodeGenerator│  │FormConfigGenerator│                  │
│          │ 生成 Vue SFC │  │  生成 JS 配置     │                  │
│          └──────────────┘  └──────────────────┘                   │
└──────────────────────────────────────────────────────────────────┘
```

### 数据流

1. **物料库注册** → `materials/index.js` 定义 16 种组件类型元数据（含 span/pidField/optionsApi 等）
2. **拖拽创建** → `useDraggable.js` 处理 HTML5 拖放，支持物料新增 & 组件排序，计算插入位置
3. **画布渲染** → `CanvasRenderer` → `ComponentRenderer` 根据 type + layout 渲染，支持 grid/inline/vertical 布局
4. **属性编辑** → `PropertyPanel` 编辑 7 个维度: 基本信息 / 布局 / 属性 / 验证 / 高级配置 / 选项 / 样式
5. **撤销/重做** → Store 维护 history 栈 (深拷贝，上限 50)
6. **导出** → 三种格式: Schema JSON / Vue 3 SFC 代码 / 表单配置 JS

---

## 物料组件清单 (16 种)

| 类型 | 名称 | 分类 | 容器 | 高级属性 |
|------|------|------|------|----------|
| `button` | 按钮 | basic | 否 | - |
| `input` | 输入框 | basic | 否 | span, fieldName, visibleCondition |
| `textarea` | 多行文本 | form | 否 | span, fieldName, visibleCondition |
| `number` | 数字输入 | form | 否 | span, fieldName, visibleCondition |
| `radio` | 单选框组 | form | 否 | span, fieldName, visibleCondition, optionsType, optionsApi |
| `checkbox` | 多选框组 | form | 否 | span, fieldName, visibleCondition, optionsType, optionsApi |
| `select` | 下拉选择 | form | 否 | span, fieldName, visibleCondition, pidField, optionsType, optionsApi |
| `date` | 日期选择 | form | 否 | span, fieldName, visibleCondition |
| `time` | 时间选择 | form | 否 | span, fieldName, visibleCondition |
| `switch` | 开关 | form | 否 | span, fieldName, visibleCondition |
| `slider` | 滑块 | form | 否 | span, fieldName, visibleCondition |
| `rate` | 评分 | form | 否 | span, fieldName, visibleCondition |
| `upload` | 文件上传 | form | 否 | span, fieldName, visibleCondition |
| `divider` | 分割线 | form | 否 | - |
| `static-text` | 静态文本 | form | 否 | - |
| `subform` | 子表单 | form | **是** | - |

---

## 各模块职责总结

| 模块 | 路径 | 职责 |
|------|------|------|
| 应用入口 | `src/main.js` | 初始化 Vue/Pinia/Element Plus |
| 根布局 | `src/App.vue` | 三栏编辑器框架 + 导入导出(Schema/JS配置/Vue SFC) + 预览弹窗 |
| 物料面板 | `src/components/MaterialPanel.vue` | 展示可拖拽组件库 |
| 属性面板 | `src/components/PropertyPanel.vue` | 7 个配置区: 基本信息/布局/属性/验证/高级配置/选项/样式 |
| 代码生成 | `src/components/CodeGenerator.vue` | 生成 Vue 3 SFC 代码 (支持 grid 布局) |
| 配置导出 | `src/core/generator/FormConfigGenerator.js` | 导出 JS 表单配置 (函数体/异步选项/级联依赖) |
| 拖拽系统 | `src/composables/useDraggable.js` | 物料拖入 + 组件排序 + 键盘快捷键 (防输入冲突) |
| 画布渲染 | `src/core/renderer/CanvasRenderer.vue` | 拖放区域 + grid/inline/vertical 布局 + 插入指示器 |
| 组件渲染 | `src/core/renderer/ComponentRenderer.vue` | 通用组件渲染 (类型→Element Plus) + 拖拽手柄 + span 宽度 |
| 预览渲染 | `src/core/renderer/PreviewRenderer.vue` | 无编辑态预览 + grid 布局支持 |
| Schema 类型 | `src/core/schema/types.ts` | 数据模型接口 (含 FormConfig/FieldConfig) |
| Schema 校验 | `src/core/schema/validator.ts` | 数据完整性校验 |
| 版本管理 | `src/core/schema/version.ts` | Schema 版本迁移 |
| 物料注册 | `src/materials/index.js` | 组件元数据中心 (含高级属性) |
| 物料实现 | `src/materials/base/` | 具体物料组件 (Button/Input) |
| 状态管理 | `src/stores/editorStore.js` | 核心状态 + 组件移动/插入 + 拖拽状态 + 撤销历史 |

---

## 功能特性

### 编辑器
- ✅ 16 种物料组件，分类展示，拖拽即用
- ✅ 三栏布局：物料库 → 画布 ← 属性面板
- ✅ 组件拖拽排序（带插入指示器）
- ✅ 画布支持 grid / inline / vertical 三种布局
- ✅ 组件栅格跨度 (span 1-24) 控制宽度
- ✅ 键盘快捷键: Ctrl+Z/Y 撤销重做, Ctrl+C/V 复制粘贴, Delete 删除
- ✅ 输入框内不拦截键盘快捷键

### 属性配置
- ✅ 基本信息: 组件类型 / 显示名称 / 标题位置
- ✅ 布局配置: 栅格跨度 (span)
- ✅ 通用属性: 按类型自动渲染 (string/boolean/number)
- ✅ 验证规则: 必填 / 数据类型 / 长度 / 范围 / 正则
- ✅ 高级配置: 字段 Key / 级联依赖 / 可见条件 / 选项来源
- ✅ 选项配置: 静态选项动态增删
- ✅ 样式配置: 宽高/边距/颜色/字体等
- ✅ 表单级配置: 标题 / 布局 / 列数

### 导出
- ✅ Schema JSON 导出/导入
- ✅ Vue 3 SFC 代码生成 (含 grid 布局 CSS)
- ✅ JS 表单配置导出 (无引号 key，函数体原样输出，支持 async options)
