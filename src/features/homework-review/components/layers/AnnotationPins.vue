<script setup lang="ts">
import { computed } from 'vue'
import type { PinAnnotation } from '../../types'

const props = defineProps<{
  pins: PinAnnotation[]
  visibleIds: string[]
  selectedId: string | null
  width: number
  height: number
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const visiblePins = computed(() => {
  const allow = new Set(props.visibleIds)
  if (props.selectedId) allow.add(props.selectedId)
  return props.pins.filter((pin) => allow.has(pin.id) && typeof pin.x === 'number' && typeof pin.y === 'number')
})

function styleOf(pin: PinAnnotation) {
  return {
    left: `${(pin.x as number) * props.width}px`,
    top: `${(pin.y as number) * props.height}px`,
  }
}
</script>

<template>
  <div class="pin-layer">
    <button
      v-for="pin in visiblePins"
      :key="pin.id"
      type="button"
      class="pin"
      :class="{ 'is-selected': pin.id === selectedId }"
      :style="styleOf(pin)"
      :title="pin.comment || pin.id"
      @click.stop="emit('select', pin.id)"
    />
  </div>
</template>

<style scoped>
.pin-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.pin {
  pointer-events: auto;
  position: absolute;
  width: 16px;
  height: 16px;
  margin: -8px 0 0 -8px;
  border-radius: 50%;
  border: 2px solid #fff;
  background: #3b82f6;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);
  cursor: pointer;
  padding: 0;
}

.pin.is-selected {
  background: #1d4ed8;
  transform: scale(1.2);
}
</style>
