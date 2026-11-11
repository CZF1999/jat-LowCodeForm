/// <reference lib="webworker" />

export interface SpatialPoint {
  id: string
  x: number
  y: number
}

export interface QueryRect {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

type InMessage =
  | { type: 'rebuild'; points: SpatialPoint[]; cellSize?: number }
  | { type: 'query'; requestId: number; rect: QueryRect; limit?: number }
  | { type: 'hit'; requestId: number; x: number; y: number; radius?: number }

type OutMessage =
  | { type: 'ready' }
  | { type: 'queryResult'; requestId: number; ids: string[] }
  | { type: 'hitResult'; requestId: number; id: string | null }

interface CellBucket {
  ids: string[]
}

const pointMap = new Map<string, SpatialPoint>()
const grid = new Map<string, CellBucket>()
let cellSize = 0.05

function cellKey(cx: number, cy: number): string {
  return `${cx}:${cy}`
}

function rebuild(points: SpatialPoint[], nextCellSize = 0.05) {
  pointMap.clear()
  grid.clear()
  cellSize = nextCellSize
  for (const point of points) {
    pointMap.set(point.id, point)
    const cx = Math.floor(point.x / cellSize)
    const cy = Math.floor(point.y / cellSize)
    const key = cellKey(cx, cy)
    const bucket = grid.get(key)
    if (bucket) bucket.ids.push(point.id)
    else grid.set(key, { ids: [point.id] })
  }
}

function query(rect: QueryRect, limit = 80): string[] {
  const minCX = Math.floor(rect.minX / cellSize)
  const maxCX = Math.floor(rect.maxX / cellSize)
  const minCY = Math.floor(rect.minY / cellSize)
  const maxCY = Math.floor(rect.maxY / cellSize)
  const ids: string[] = []
  for (let cx = minCX; cx <= maxCX; cx++) {
    for (let cy = minCY; cy <= maxCY; cy++) {
      const bucket = grid.get(cellKey(cx, cy))
      if (!bucket) continue
      for (const id of bucket.ids) {
        const point = pointMap.get(id)
        if (!point) continue
        if (
          point.x >= rect.minX &&
          point.x <= rect.maxX &&
          point.y >= rect.minY &&
          point.y <= rect.maxY
        ) {
          ids.push(id)
          if (ids.length >= limit) return ids
        }
      }
    }
  }
  return ids
}

function hitTest(x: number, y: number, radius = 0.02): string | null {
  const minX = x - radius
  const maxX = x + radius
  const minY = y - radius
  const maxY = y + radius
  const candidates = query({ minX, minY, maxX, maxY }, 32)
  let best: string | null = null
  let bestDist = radius * radius
  for (const id of candidates) {
    const point = pointMap.get(id)
    if (!point) continue
    const dx = point.x - x
    const dy = point.y - y
    const d2 = dx * dx + dy * dy
    if (d2 <= bestDist) {
      bestDist = d2
      best = id
    }
  }
  return best
}

const workerScope = self as unknown as DedicatedWorkerGlobalScope

workerScope.onmessage = (event: MessageEvent<InMessage>) => {
  const msg = event.data
  if (msg.type === 'rebuild') {
    rebuild(msg.points, msg.cellSize)
    workerScope.postMessage({ type: 'ready' } satisfies OutMessage)
    return
  }
  if (msg.type === 'query') {
    const ids = query(msg.rect, msg.limit)
    workerScope.postMessage({
      type: 'queryResult',
      requestId: msg.requestId,
      ids,
    } satisfies OutMessage)
    return
  }
  if (msg.type === 'hit') {
    const id = hitTest(msg.x, msg.y, msg.radius)
    workerScope.postMessage({
      type: 'hitResult',
      requestId: msg.requestId,
      id,
    } satisfies OutMessage)
  }
}
