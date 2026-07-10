<template>
  <el-input 
    :placeholder="props.placeholder || 'Please input'"
    :disabled="props.disabled"
    :size="props.size || 'medium'"
    :maxlength="props.maxlength"
    :show-word-limit="props.showWordLimit"
  />
</template>

<script setup lang="ts">
const props = defineProps({
  placeholder: {
    type: String,
    default: 'Please input'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  size: {
    type: String,
    default: 'medium'
  },
  maxlength: {
    type: Number,
    default: undefined
  },
  showWordLimit: {
    type: Boolean,
    default: false
  }
})
</script>
