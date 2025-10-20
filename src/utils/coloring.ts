import type { Feature, Geometry } from 'geojson'

// Paleta de 10 colores agradables (tonos pastel / vibrantes) — pueden ajustarse
export const PALETTE = [
  '#ff6b6b', // rojo-rosado
  '#f59e0b', // ámbar
  '#f97316', // naranja
  '#f472b6', // rosa
  '#60a5fa', // azul claro
  '#34d399', // verde menta
  '#7c3aed', // violeta
  '#06b6d4', // cian
  '#fbbf24', // amarillo
  '#a78bfa'  // lila
]

// Bounding box helper
const bboxOf = (feat: Feature<Geometry>) => {
  const coords: number[][] = []
  const geom: any = feat.geometry

  const collect = (c: any) => {
    if (typeof c[0] === 'number') {
      coords.push(c as number[])
    } else {
      for (const sub of c) collect(sub)
    }
  }

  if (!geom) return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  collect(geom.coordinates)

  const xs = coords.map((c) => c[0])
  const ys = coords.map((c) => c[1])
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys)
  }
}

const bboxesIntersect = (a: ReturnType<typeof bboxOf>, b: ReturnType<typeof bboxOf>) => {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY)
}

// Heurística simple para detectar adyacencia: bbox intersection + comprobación de si comparten vértices
const shareVertex = (a: Feature<Geometry>, b: Feature<Geometry>) => {
  const coordsA: number[][] = []
  const coordsB: number[][] = []
  const collect = (c: any, out: number[][]) => {
    if (!c) return
    if (typeof c[0] === 'number') {
      out.push(c as number[])
    } else {
      for (const sub of c) collect(sub, out)
    }
  }
  // Geometry puede ser varios tipos; accedemos a coordinates con cast a any
  collect((a.geometry as any)?.coordinates, coordsA)
  collect((b.geometry as any)?.coordinates, coordsB)

  const setA = new Set(coordsA.map((c) => `${c[0].toFixed(6)},${c[1].toFixed(6)}`))
  for (const cb of coordsB) {
    if (setA.has(`${cb[0].toFixed(6)},${cb[1].toFixed(6)}`)) return true
  }
  return false
}

export const buildAdjacency = (features: Feature<Geometry, any>[]) => {
  const n = features.length
  const bboxes = features.map(bboxOf)
  const adjacency = new Map<string, Set<string>>()

  for (let i = 0; i < n; i++) {
    const idA = String(features[i].id ?? features[i].properties?.id ?? i)
    adjacency.set(idA, new Set())
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = features[i]
      const b = features[j]
      const idA = String(a.id ?? a.properties?.id ?? i)
      const idB = String(b.id ?? b.properties?.id ?? j)

      if (!bboxesIntersect(bboxes[i], bboxes[j])) continue

      // si comparten vértice, los consideramos vecinos
      if (shareVertex(a, b)) {
        adjacency.get(idA)!.add(idB)
        adjacency.get(idB)!.add(idA)
      }
    }
  }
  return adjacency
}

// Asignación de colores greedy: ordena por grado descendente y asigna el primer color disponible
export const assignColors = (features: Feature<Geometry, any>[]) => {
  const adjacency = buildAdjacency(features)
  const ids = features.map((f, i) => String(f.id ?? f.properties?.id ?? i))
  const degree = ids.map((id) => ({ id, d: adjacency.get(id)?.size ?? 0 }))
  degree.sort((a, b) => b.d - a.d)

  const colorById = new Map<string, string>()

  for (const { id } of degree) {
    const used = new Set<string>()
    for (const nb of adjacency.get(id) ?? []) {
      const c = colorById.get(nb)
      if (c) used.add(c)
    }

    // elegir el primer color no usado
    let chosen = PALETTE.find((p) => !used.has(p))
    if (!chosen) {
      // si todos los 10 están usados entre vecinos, elegir uno minimizando conflictos
      chosen = PALETTE[Math.floor(Math.random() * PALETTE.length)]
    }
    colorById.set(id, chosen)
  }

  return colorById
}
