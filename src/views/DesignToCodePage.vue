<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import modelIcon from '../assets/design-to-code/model-icon.png'
import modalWaveBg from '../assets/design-to-code/modal-wave-bg.png'
import panelSoftBg from '../assets/design-to-code/panel-soft-bg.png'

interface ModelItem {
  id: number
  name: string
}

const router = useRouter()
const models: ModelItem[] = Array.from({ length: 16 }, (_, index) => ({
  id: index + 1,
  name: '具体模型名...',
}))

// 设计稿：第 2 行第 3 列（从 0 起 index = 6）
const selectedId = ref(7)

function selectModel(id: number) {
  selectedId.value = id
}

function handleClose() {
  router.push('/')
}
</script>

<template>
  <div class="dtc-page">
    <div class="dtc-modal" role="dialog" aria-label="模型选择">
      <div class="dtc-modal__bg" :style="{ backgroundImage: `url(${panelSoftBg})` }" />
      <div class="dtc-modal__wave" :style="{ backgroundImage: `url(${modalWaveBg})` }" />

      <div class="dtc-badge">容器 1</div>

      <button class="dtc-close" type="button" aria-label="关闭" @click="handleClose">
        <span class="dtc-close__icon" aria-hidden="true">×</span>
      </button>

      <div class="dtc-grid">
        <button
          v-for="model in models"
          :key="model.id"
          type="button"
          class="dtc-card"
          :class="{ 'is-selected': selectedId === model.id }"
          @click="selectModel(model.id)"
        >
          <div class="dtc-card__thumb">
            <img class="dtc-card__icon" :src="modelIcon" alt="" />
          </div>
          <p class="dtc-card__name">{{ model.name }}</p>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dtc-page {
  --dtc-bg: #1a1d24;
  --dtc-text: #3a4658;
  --dtc-accent: #3b82f6;
  --dtc-accent-soft: rgba(59, 130, 246, 0.35);
  --dtc-card: rgba(255, 255, 255, 0.72);
  --dtc-thumb: #e8f2ff;

  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  background: var(--dtc-bg);
  font-family: 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.dtc-modal {
  position: relative;
  width: min(420px, 100%);
  min-height: 640px;
  border-radius: 28px;
  overflow: hidden;
  box-shadow:
    0 24px 64px rgba(0, 0, 0, 0.45),
    0 0 0 1px rgba(255, 255, 255, 0.08);
  isolation: isolate;
}

.dtc-modal__bg {
  position: absolute;
  inset: 0;
  background-color: #f5f8ff;
  background-size: cover;
  background-position: center top;
  z-index: 0;
}

.dtc-modal__wave {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 42%;
  background-size: cover;
  background-position: center bottom;
  pointer-events: none;
  z-index: 1;
  opacity: 0.95;
  mask-image: linear-gradient(to top, #000 55%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, #000 55%, transparent 100%);
}

.dtc-badge {
  position: absolute;
  top: 18px;
  left: 18px;
  z-index: 3;
  padding: 6px 12px;
  border-radius: 8px;
  background: #2f3542;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}

.dtc-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 3;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 14px rgba(47, 84, 140, 0.18);
  color: #5b6575;
  cursor: pointer;
  display: grid;
  place-items: center;
  transition: transform 0.15s ease, background 0.15s ease;
}

.dtc-close:hover {
  transform: scale(1.04);
  background: #fff;
}

.dtc-close__icon {
  font-size: 22px;
  line-height: 1;
  margin-top: -1px;
}

.dtc-grid {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px 12px;
  padding: 64px 22px 48px;
}

.dtc-card {
  appearance: none;
  border: 2px solid transparent;
  background: transparent;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: center;
  border-radius: 14px;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.dtc-card:hover .dtc-card__thumb {
  transform: translateY(-1px);
  box-shadow: 0 8px 18px rgba(74, 124, 196, 0.16);
}

.dtc-card.is-selected {
  border-color: var(--dtc-accent);
  box-shadow: 0 0 0 3px var(--dtc-accent-soft);
  background: rgba(255, 255, 255, 0.35);
}

.dtc-card__thumb {
  aspect-ratio: 1;
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(232, 242, 255, 0.95)),
    var(--dtc-thumb);
  display: grid;
  place-items: center;
  padding: 10px;
  box-sizing: border-box;
  box-shadow: 0 2px 8px rgba(90, 130, 180, 0.08);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.dtc-card__icon {
  width: 78%;
  height: auto;
  display: block;
  object-fit: contain;
  filter: drop-shadow(0 6px 10px rgba(40, 90, 180, 0.2));
}

.dtc-card__name {
  margin: 8px 2px 6px;
  font-size: 12px;
  line-height: 1.3;
  color: var(--dtc-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@media (max-width: 420px) {
  .dtc-modal {
    min-height: auto;
    border-radius: 22px;
  }

  .dtc-grid {
    gap: 10px 8px;
    padding: 58px 14px 36px;
  }

  .dtc-card__name {
    font-size: 11px;
  }
}
</style>
