import type { Feature, Geometry } from 'geojson'

export const PALETTE = [
  '#00A6ED', // Sky Pulse
  '#7ED957', // Lime Burst
  '#7E57C2', // Purple Bloom
  '#FF6F00', // Solar Pop
  '#FF5252', // Coral Heat
  '#FFEB3B', // Sunny Kick
  '#E91E63', // Neon Pink
  '#00BFA5', // Aqua Twist
  '#2962FF', // Deep Wave
  '#D68600'  // Golden Clay
]

const stringHash = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return hash >>> 0
}

export const assignColors = (features: Feature<Geometry, Record<string, unknown>>[]) => {
  const paletteSize = PALETTE.length
  if (paletteSize === 0) return new Map<string, string>()

  const sortedIds = features
    .map((feature, index) => {
      const id = String(feature.id ?? feature.properties?.id ?? index)
      return { id, hash: stringHash(id) }
    })
    .sort((a, b) => {
      if (a.hash === b.hash) {
        return a.id.localeCompare(b.id)
      }
      return a.hash - b.hash
    })

  const colorById = new Map<string, string>()
  for (let index = 0; index < sortedIds.length; index += 1) {
    const { id } = sortedIds[index]
    const color = PALETTE[index % paletteSize]
    colorById.set(id, color)
  }

  return colorById
}
