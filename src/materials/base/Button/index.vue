<template>
  <el-button 
    :type="props.type || 'primary'"
    :size="props.size || 'medium'"
    :disabled="props.disabled"
    :round="props.round"
    :circle="props.circle"
  >
    {{ props.label || 'Button' }}
  </el-button>
</template>

<script setup>
const props = defineProps({
  type: {
    type: String,
    default: 'primary'
  },
  size: {
    type: String,
    default: 'medium'
  },
  label: {
    type: String,
    default: 'Button'
  },
  disabled: {
    type: Boolean,
    default: false
  },
  round: {
    type: Boolean,
    default: false
  },
  circle: {
    type: Boolean,
    default: false
  }
})
</script>
