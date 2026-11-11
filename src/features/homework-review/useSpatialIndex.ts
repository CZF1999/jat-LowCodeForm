import { onBeforeUnmount, ref, shallowRef, watch, type Ref, type ShallowRef } from 'vue'
import type { PinAnnotation, ViewportRect } from './types'
import SpatialWorker from './workers/spatialIndex.worker.ts?worker'

interface SpatialPoint {
  id: string
  x: number
  y: number
}

export function useSpatialIndex(pins: Ref<PinAnnotation[]> | ShallowRef<PinAnnotation[]>) {
  const visibleIds = shallowRef<string[]>([])
  const workerReady = ref(false)
  let worker: Worker | null = null
  let requestId = 0
  const pending = new Map<number, (ids: string[]) => void>()

  function ensureWorker() {
    if (worker) return worker
    worker = new SpatialWorker()
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data
      if (data.type === 'ready') {
        workerReady.value = true
        return
      }
      if (data.type === 'queryResult') {
        const resolve = pending.get(data.requestId)
        if (resolve) {
          pending.delete(data.requestId)
          resolve(data.ids as string[])
        }
      }
    }
    return worker
  }

  function rebuild() {
    const points: SpatialPoint[] = pins.value
      .filter((pin) => typeof pin.x === 'number' && typeof pin.y === 'number')
      .map((pin) => ({ id: pin.id, x: pin.x as number, y: pin.y as number }))
    const w = ensureWorker()
    workerReady.value = false
    w.postMessage({ type: 'rebuild', points, cellSize: 0.05 })
  }

  function queryViewport(rect: ViewportRect, limit = 80): Promise<string[]> {
    const w = ensureWorker()
    const id = ++requestId
    return new Promise((resolve) => {
      pending.set(id, resolve)
      w.postMessage({ type: 'query', requestId: id, rect, limit })
    })
  }

  async function syncVisible(rect: ViewportRect, selectedId: string | null, limit = 80) {
    const ids = await queryViewport(rect, limit)
    const set = new Set(ids)
    if (selectedId) set.add(selectedId)
    visibleIds.value = Array.from(set)
  }

  watch(pins, () => rebuild(), { immediate: true })

  onBeforeUnmount(() => {
    worker?.terminate()
    worker = null
    pending.clear()
  })

  return {
    visibleIds,
    workerReady,
    rebuild,
    queryViewport,
    syncVisible,
  }
}
