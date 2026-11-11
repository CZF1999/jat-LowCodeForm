<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  HIGHLIGHT_PRESET_COLORS,
  STAMP_SYMBOL_LABEL,
  TEXTBOX_PRESETS,
  type Annotation,
  type StampAnnotation,
} from '../../types'

const props = defineProps<{
  annotation: Annotation | null
  focusToken?: number
}>()

const emit = defineEmits<{
  'update:comment': [value: string]
  'update:text': [value: string]
  'update:color': [value: string]
  remove: []
  close: []
}>()

const inputRef = ref<HTMLTextAreaElement | null>(null)

const title = computed(() => {
  const item = props.annotation
  if (!item) return ''
  if (item.kind === 'stamp') {
    return `图章 ${STAMP_SYMBOL_LABEL[(item as StampAnnotation).symbol]}`
  }
  if (item.kind === 'textbox') return '短文本'
  if (item.kind === 'callout') return '引注'
  if (item.kind === 'highlight') return '高亮'
  if (item.kind === 'underline') return '下划线'
  if (item.kind === 'stroke') return '笔迹'
  if (item.kind === 'pin') return '批注钉'
  return '批注'
})

const placeholder = computed(() => {
  const kind = props.annotation?.kind
  if (kind === 'stamp' || kind === 'textbox') return '写一句错因，如「单位未换算」…'
  if (kind === 'callout') return '写清问题定位与改进方向…'
  if (kind === 'highlight' || kind === 'underline') return '写具体改进意见（不要只划线）…'
  if (kind === 'stroke') return '可选：说明圈画指出的问题…'
  return '写下批阅意见…'
})

const quote = computed(() => {
  const item = props.annotation
  if (!item) return ''
  if (item.kind === 'highlight' || item.kind === 'underline') return item.htmlAnchor.quote
  return ''
})

const comment = computed({
  get: () => props.annotation?.comment ?? '',
  set: (value: string) => emit('update:comment', value),
})

const textboxText = computed({
  get: () => (props.annotation?.kind === 'textbox' ? props.annotation.text : ''),
  set: (value: string) => emit('update:text', value.slice(0, 40)),
})

const calloutText = computed({
  get: () => (props.annotation?.kind === 'callout' ? props.annotation.text : ''),
  set: (value: string) => emit('update:text', value.slice(0, 200)),
})

const showPresets = computed(
  () => props.annotation?.kind === 'stamp' || props.annotation?.kind === 'textbox',
)

const showHighlightColors = computed(() => props.annotation?.kind === 'highlight')

const currentHighlightColor = computed(() =>
  props.annotation?.kind === 'highlight' ? props.annotation.color || '#facc15' : '',
)

function applyPreset(phrase: string) {
  if (props.annotation?.kind === 'textbox') {
    emit('update:text', phrase.slice(0, 40))
  }
  emit('update:comment', phrase)
}

function applyColor(color: string) {
  emit('update:color', color)
}

watch(
  () => [props.focusToken, props.annotation?.id] as const,
  async () => {
    if (!props.annotation) return
    await nextTick()
    inputRef.value?.focus()
  },
)
</script>

<template>
  <div v-if="annotation" class="popover">
    <header class="popover__head">
      <strong>{{ title }}</strong>
      <button type="button" class="link" @click="emit('close')">关闭</button>
    </header>

    <p v-if="quote" class="quote">「{{ quote }}」</p>

    <div v-if="showHighlightColors" class="color-field">
      <span>高亮颜色</span>
      <div class="swatch-group">
        <button
          v-for="color in HIGHLIGHT_PRESET_COLORS"
          :key="color"
          type="button"
          class="swatch"
          :class="{ active: currentHighlightColor === color }"
          :style="{ background: color }"
          :aria-label="`高亮色 ${color}`"
          @click="applyColor(color)"
        />
      </div>
    </div>

    <label v-if="annotation.kind === 'textbox'" class="field">
      <span>短句（最多 40 字）</span>
      <textarea
        ref="inputRef"
        v-model="textboxText"
        class="popover__input"
        rows="2"
        maxlength="40"
        :placeholder="placeholder"
      />
    </label>

    <label v-else-if="annotation.kind === 'callout'" class="field">
      <span>长文本（最多 200 字）</span>
      <textarea
        ref="inputRef"
        v-model="calloutText"
        class="popover__input"
        rows="6"
        maxlength="200"
        :placeholder="placeholder"
      />
    </label>

    <label v-else class="field">
      <span>{{ annotation.kind === 'stamp' ? '错因短句' : '批阅意见' }}</span>
      <textarea
        ref="inputRef"
        v-model="comment"
        class="popover__input"
        rows="4"
        :placeholder="placeholder"
      />
    </label>

    <div v-if="showPresets" class="presets">
      <button
        v-for="phrase in TEXTBOX_PRESETS"
        :key="phrase"
        type="button"
        class="preset"
        @click="applyPreset(phrase)"
      >
        {{ phrase }}
      </button>
    </div>

    <footer class="popover__foot">
      <button type="button" class="danger" @click="emit('remove')">删除</button>
    </footer>
  </div>
</template>

<style scoped>
.popover {
  border: 1px solid #dbe4f3;
  border-radius: 12px;
  background: #fff;
  padding: 12px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
}

.popover__head,
.popover__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quote {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  line-height: 1.45;
}

.color-field {
  margin-top: 10px;
}

.color-field > span {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #64748b;
}

.swatch-group {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
}

.swatch.active {
  border-color: #1d4ed8;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);
}

.field {
  display: block;
  margin-top: 10px;
}

.field > span {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  color: #64748b;
}

.popover__input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d0d7e5;
  border-radius: 8px;
  padding: 8px 10px;
  resize: vertical;
  font: inherit;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.preset {
  border: 1px solid #e2e8f0;
  background: #f8fafc;
  border-radius: 999px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}

.preset:hover {
  border-color: #93c5fd;
  background: #eff6ff;
}

.popover__foot {
  margin-top: 10px;
}

.link,
.danger {
  border: none;
  background: transparent;
  cursor: pointer;
  font: inherit;
}

.link {
  color: #2563eb;
}

.danger {
  color: #dc2626;
}
</style>
