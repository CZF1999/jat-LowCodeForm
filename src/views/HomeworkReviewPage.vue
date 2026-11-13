<script setup lang="ts">
import { RouterLink } from 'vue-router'
import ReviewShell from '../features/homework-review/components/ReviewShell.vue'
</script>

<template>
  <div class="page">
    <div class="nav">
      <RouterLink to="/">← 返回低代码编辑器</RouterLink>
      <span>作业批阅 Demo </span>
    </div>
    <ReviewShell />
  </div>
</template>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.nav {
  flex: 0 0 auto;
  z-index: 20;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 16px;
  background: #0f172a;
  color: #e2e8f0;
  font-size: 13px;
}

.page :deep(.shell) {
  flex: 1;
  min-height: 0;
  height: auto;
}

.nav a {
  color: #93c5fd;
  text-decoration: none;
}
</style>
