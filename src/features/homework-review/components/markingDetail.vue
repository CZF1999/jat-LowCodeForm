<!-- 兼容旧入口：Demo 请使用 PaperMarkingView + VuePaperSurface -->
<script setup lang="ts">
import PaperMarkingView from './PaperMarkingView.vue'
import type { PaperDetail } from '../paperTypes'

defineProps<{
  paper: PaperDetail
}>()
</script>

<template>
  <PaperMarkingView :paper="paper" />
</template>
