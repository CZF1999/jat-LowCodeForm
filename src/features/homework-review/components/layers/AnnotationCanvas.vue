<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { Annotation, PinAnnotation, StrokeAnnotation } from '../../types'

const props = defineProps<{
  width: number
  height: number
  annotations: Annotation[]
  selectedId: string | null
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.max(1, Math.floor(props.width * dpr))
  canvas.height = Math.max(1, Math.floor(props.height * dpr))
  canvas.style.width = `${props.width}px`
  canvas.style.height = `${props.height}px`
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, props.width, props.height)

  for (const item of props.annotations) {
    if (item.kind === 'stroke') drawStroke(ctx, item)
    else if (item.kind === 'pin') drawPin(ctx, item)
  }
}

function drawPin(ctx: CanvasRenderingContext2D, pin: PinAnnotation) {
  if (typeof pin.x !== 'number' || typeof pin.y !== 'number') return
  const x = pin.x * props.width
  const y = pin.y * props.height
  const selected = pin.id === props.selectedId
  ctx.beginPath()
  ctx.arc(x, y, selected ? 8 : 5, 0, Math.PI * 2)
  ctx.fillStyle = pin.color || '#3b82f6'
  ctx.fill()
  if (selected) {
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1d4ed8'
    ctx.stroke()
  }
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: StrokeAnnotation) {
  if (!stroke.points.length) return
  ctx.beginPath()
  stroke.points.forEach((point, index) => {
    const x = point.x * props.width
    const y = point.y * props.height
    if (index === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  })
  ctx.strokeStyle = stroke.color || '#ef4444'
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

onMounted(draw)
watch(() => [props.annotations, props.width, props.height, props.selectedId], draw, { deep: false })
</script>

<template>
  <canvas ref="canvasRef" class="annotation-canvas" />
</template>

<style scoped>
.annotation-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}
</style>
