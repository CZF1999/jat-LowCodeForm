# LowCodeEdit

一个基于 Vue 3 + Element Plus 的低代码表单编辑器，支持可视化拖拽创建表单并自动生成代码。

## 功能特性

-  **可视化拖拽**：通过拖拽方式创建和排列表单组件
-  **丰富的组件库**：支持输入框、文本域、数字输入、单选框、复选框、下拉选择、日期选择、开关、滑块、评分、上传等组件
-  **属性编辑**：支持自定义组件属性、验证规则、禁用状态等
-  **代码生成**：一键生成完整的 Vue 3 表单代码，包含 Element Plus 组件
-  **表单验证**：支持必填、长度限制、数值范围、正则表达式等验证规则
-  **响应式布局**：自适应不同屏幕尺寸

## 技术栈

- Vue 3 (Composition API)
- Element Plus
- Vite
- Pinia

## 安装和运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 使用说明

1. **添加组件**：从左侧组件库拖拽组件到画布
2. **编辑属性**：选中组件后在右侧属性面板编辑组件属性
3. **设置验证**：在属性面板中设置表单验证规则
4. **生成代码**：点击工具栏的"生成代码"按钮，查看并复制生成的代码

## 生成的代码特性

- 使用 `el-form` 和 `el-form-item` 组件，符合 Element Plus 最佳实践
- 支持表单验证（`validate`）和重置（`resetFields`）
- 自动处理禁用状态
- 语义化的代码结构

## 示例

```vue
<template>
  <el-form :model="form" :rules="rules" ref="formRef" label-width="120px" class="generated-form">
    <el-form-item label="输入框" prop="input">
      <el-input v-model="form.input" placeholder="请输入" size="small" />
    </el-form-item>
    <el-form-item label="开关" prop="switch">
      <el-switch v-model="form.switch" />
    </el-form-item>
    <div class="form-actions">
      <el-button @click="cancelForm">取消</el-button>
      <el-button type="primary" @click="submitForm">提交</el-button>
    </div>
  </el-form>
</template>

<script setup>
import { ref } from "vue"

const form = ref({
  input: "",
  switch: false,
})

const rules = ref({
  input: [
    { required: true, message: '请输入', trigger: 'blur' }
  ],
})

const formRef = ref()

const submitForm = () => {
  formRef.value?.validate((valid) => {
    if (valid) {
      console.log("Form submitted:", form.value)
    } else {
      console.log("Validation failed:", form.value)
    }
  })
}

const cancelForm = () => {
  formRef.value?.resetFields()
  console.log("表单已重置")
}
</script>
```

## 许可证

MIT
