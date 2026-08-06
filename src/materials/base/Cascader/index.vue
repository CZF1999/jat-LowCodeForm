<template>
  <el-cascader
    :options="props.options"
    :placeholder="props.placeholder || '请选择'"
    :disabled="props.disabled"
    :size="props.size || 'small'"
    :separator="props.separator || '/'"
    :multiple="props.multiple"
    :check-strictly="props.checkStrictly"
    :emit-path="props.emitPath"
  />
</template>

<script setup lang="ts">
const props = defineProps({
  options: {
    type: Array,
    default: () => []
  },
  placeholder: {
    type: String,
    default: '请选择'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'small'
  },
  separator: {
    type: String,
    default: '/'
  },
  multiple: {
    type: Boolean,
    default: false
  },
  checkStrictly: {
    type: Boolean,
    default: false
  },
  emitPath: {
    type: Boolean,
    default: false
  }
})
</script>
