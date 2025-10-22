import type { Feature, Geometry } from 'geojson'

export const PALETTE = [
  '#264653', // Deep Teal
  '#2a9d8f', // Aqua Green
  '#8ab17d', // Laurel
  '#e9c46a', // Saffron
  '#f4a261', // Desert
  '#e76f51', // Coral
  '#f28482', // Soft Salmon
  '#84a59d', // Misty Sage
  '#52796f', // Pine
  '#ff9f1c', // Amber
  '#9d4edd', // Violet Pulse
  '#48cae4', // Sky Cyan
  '#b5179e', // Magenta Bloom
  '#2b9348'  // Meadow Green
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
