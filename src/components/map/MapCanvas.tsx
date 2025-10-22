import { memo, useEffect, useMemo, useRef, useState } from 'react'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import maplibregl, {
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapLibreMap,
  type StyleSpecification
} from 'maplibre-gl'
import { geoBounds, geoCentroid } from 'd3-geo'
import { assignColors } from '../../utils/coloring'
import type {
  CelebrationState,
  ColorMode,
  GameMode
} from '../../store/gameStore'
import type {
  ComunidadId,
  MunicipioId,
  MunicipioInfo,
  ProvinciaId,
  RespuestaEstado
} from '../../types/municipio'

type MapCanvasProps = {
  features: Feature<Geometry, Record<string, unknown>>[]
  highlightMunicipioId?: string
  colorMode: ColorMode
  modo: GameMode
  infoById: Map<string, MunicipioInfo>
  selectedProvinces: ProvinciaId[]
  selectedCommunities: ComunidadId[]
  statuses?: Record<string, RespuestaEstado>
  onSelect?: (municipioId: string) => void
  correctBlinkId?: string
  celebration?: CelebrationState
  lockedMunicipios?: Set<MunicipioId>
  showLabels?: boolean
  theme: 'oscuro' | 'claro'
  focusedMunicipios?: Set<MunicipioId> | null
}

type MunicipioFeatureProperties = {
  id: string
  nombre: string
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  label: string
  labelSize: number
  labelColor: string
  labelOpacity: number
  locked: boolean
  cursor: 'pointer' | 'default'
  maskVisible: boolean
}

type MunicipioDataset = {
  collection: FeatureCollection<Geometry, MunicipioFeatureProperties>
  bounds?: [[number, number], [number, number]]
}

const MAP_SOURCE_ID = 'municipios'
const MAP_FILL_LAYER_ID = 'municipios-fill'
const MAP_LINE_LAYER_ID = 'municipios-outline'
const MAP_HIGHLIGHT_LAYER_ID = 'municipios-highlight'
const MAP_LABEL_LAYER_ID = 'municipios-labels'
const MAP_CELEBRATION_SOURCE_ID = 'celebration'
const MAP_CELEBRATION_LAYER_ID = 'celebration-layer'
const BASE_SOURCE_IDS = {
  roads: 'basemap-roads'
} as const
const BASE_LAYER_IDS = {
  roads: 'basemap-roads-layer'
} as const
type RoadsLayerKey = keyof typeof BASE_SOURCE_IDS
const MASK_SOURCE_ID = 'basemap-mask'
const MASK_LAYER_ID = 'basemap-mask-layer'
const DEFAULT_CENTER: [number, number] = [-3.7, 40.0]
const DEFAULT_ZOOM = 6

const blankStyle: StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'
}

const BASE_LAYER_CONFIG: Record<
  RoadsLayerKey,
  {
    tiles: string
    attribution: string
    minzoom: number
    maxzoom: number
    tileSize?: number
  }
> = {
  roads: {
    tiles: 'https://cartodb-basemaps-a.global.ssl.fastly.net/light_nolabels/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors, CartoDB',
    minzoom: 0,
    maxzoom: 19
  }
}

const LOCK_FILL = '#050505'
const DIM_FILL = '#9ca3af'

const uniformFill = '#c7d2fe'

const statusFill: Record<RespuestaEstado, string> = {
  correcta: '#22c55e',
  fallida: '#f87171',
  pendiente: uniformFill
}

const provinceColorCache: Record<'oscuro' | 'claro', Map<string, string>> = {
  claro: new Map<string, string>(),
  oscuro: new Map<string, string>()
}

const communityColorCache: Record<'oscuro' | 'claro', Map<string, string>> = {
  claro: new Map<string, string>(),
  oscuro: new Map<string, string>()
}

const PROVINCE_BASE_PALETTE = [
  '#1b9e77',
  '#d95f02',
  '#7570b3',
  '#e7298a',
  '#66a61e',
  '#e6ab02',
  '#a6761d',
  '#1f78b4',
  '#b2df8a',
  '#fb9a99',
  '#fdbf6f',
  '#cab2d6',
  '#6a3d9a',
  '#8dd3c7',
  '#80b1d3',
  '#fdae61',
  '#abdda4',
  '#e6f598',
  '#f46d43',
  '#74add1'
]

const communityPalette = [
  '#0ea5e9',
  '#f97316',
  '#34d399',
  '#a855f7',
  '#ef4444',
  '#22d3ee',
  '#fbbf24',
  '#c084fc',
  '#4ade80',
  '#fb7185',
  '#38bdf8',
  '#facc15'
]

const stringHash = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const mixHexColors = (base: string, mixWith: string, weight: number) => {
  const parse = (hex: string) => {
    const clean = hex.replace('#', '')
    const normalized = clean.length === 3 ? clean.repeat(2) : clean
    const value = Number.parseInt(normalized, 16)
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    }
  }
  const baseRgb = parse(base)
  const mixRgb = parse(mixWith)
  const w = Math.min(1, Math.max(0, weight))
  const blend = (a: number, b: number) => Math.round(a * (1 - w) + b * w)
  const r = blend(baseRgb.r, mixRgb.r)
  const g = blend(baseRgb.g, mixRgb.g)
  const b = blend(baseRgb.b, mixRgb.b)
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

const colorForProvince = (provinciaId: string | undefined, theme: 'oscuro' | 'claro') => {
  if (!provinciaId) {
    return theme === 'oscuro' ? 'rgba(148, 163, 184, 0.65)' : '#64748b'
  }
  const cache = provinceColorCache[theme]
  if (cache.has(provinciaId)) {
    return cache.get(provinciaId) as string
  }
  const hash = stringHash(provinciaId)
  const base = PROVINCE_BASE_PALETTE[hash % PROVINCE_BASE_PALETTE.length]
  const adjusted =
    theme === 'oscuro'
      ? mixHexColors(base, '#cbd5f5', 0.38)
      : mixHexColors(base, '#ffffff', 0.1)
  cache.set(provinciaId, adjusted)
  return adjusted
}

const adaptColorForTheme = (color: string, theme: 'oscuro' | 'claro') => {
  if (!color || !color.startsWith('#')) return color
  const mixTarget = theme === 'oscuro' ? '#dbeafe' : '#ffffff'
  const weight = theme === 'oscuro' ? 0.3 : 0.1
  return mixHexColors(color, mixTarget, weight)
}

const colorForCommunity = (communityId: string | undefined, theme: 'oscuro' | 'claro') => {
  if (!communityId) return theme === 'oscuro' ? 'rgba(148, 163, 184, 0.65)' : '#6b7280'
  const cache = communityColorCache[theme]
  if (cache.has(communityId)) {
    return cache.get(communityId) as string
  }
  const hash = stringHash(communityId)
  const base = communityPalette[Math.abs(hash) % communityPalette.length]
  const adjusted = adaptColorForTheme(base, theme)
  cache.set(communityId, adjusted)
  return adjusted
}

const populationColor = (info?: MunicipioInfo) => {
  const densidad = info?.densidadHabKm2
  if (!densidad || densidad <= 0) return '#dbeafe'

  const normalized = Math.min(1, Math.log10(densidad + 1) / 4.3)
  const hue = 210 - normalized * 210
  const saturation = 72 + normalized * 22
  const lightness = 72 - normalized * 35
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`
}

const altitudeColor = (altitud?: number) => {
  if (typeof altitud !== 'number' || Number.isNaN(altitud)) return '#39ff14'
  const normalized = Math.max(0, Math.min(1, altitud / 2500))
  const low = '#39ff14'
  const high = '#9d00ff'
  const percentage = Math.round(normalized * 100)
  return `color-mix(in srgb, ${low} ${100 - percentage}%, ${high} ${percentage}%)`
}

const buildDataset = (
  features: Feature<Geometry, Record<string, unknown>>[],
  infoById: Map<string, MunicipioInfo>,
  selectedProvinceSet: Set<ProvinciaId>,
  selectedCommunitySet: Set<ComunidadId>,
  colorMode: ColorMode,
  statuses: Record<string, RespuestaEstado> | undefined,
  highlightMunicipioId: string | undefined,
  correctBlinkId: string | undefined,
  celebration: CelebrationState | undefined,
  lockedMunicipios: Set<MunicipioId> | undefined,
  colorById: Map<string, string>,
  theme: 'oscuro' | 'claro',
  roadsMode: boolean,
  focusedMunicipios: Set<MunicipioId> | null
): MunicipioDataset => {
  if (features.length === 0) {
    return {
      collection: {
        type: 'FeatureCollection',
        features: []
      }
    }
  }

  const lockedSet = lockedMunicipios ?? new Set()
  const focusSet = focusedMunicipios ?? null
  const hasFocusFilter = Boolean(focusSet && focusSet.size > 0)
  const hasRoadsLayer = roadsMode

  const collection: FeatureCollection<Geometry, MunicipioFeatureProperties> = {
    type: 'FeatureCollection',
    features: []
  }

  const bounds = geoBounds({
    type: 'FeatureCollection',
    features
  })

  const maskByProvince = selectedProvinceSet.size > 0
  const maskByCommunity = !maskByProvince && selectedCommunitySet.size > 0

  for (const feature of features) {
    const municipioId = String(feature.properties?.id ?? feature.id ?? 'sin-id')
    const info = infoById.get(municipioId)
    const provincia = info?.provincia ?? String(feature.properties?.provincia ?? '')
    const comunidad = info?.comunidad
    const status = statuses?.[municipioId]
    const isLocked = lockedSet.has(municipioId)
    const isProvinceDimmed =
      selectedProvinceSet.size > 0 && !selectedProvinceSet.has(provincia as ProvinciaId)
    const isFocusDimmed = hasFocusFilter && !(focusSet?.has(municipioId) ?? false)
    const isHighlight = highlightMunicipioId === municipioId
    const isCorrectBlink = correctBlinkId === municipioId
    const showCelebration = celebration?.municipioId === municipioId

    const maskVisible = maskByProvince
      ? selectedProvinceSet.has(provincia as ProvinciaId)
      : maskByCommunity
        ? selectedCommunitySet.has(comunidad as ComunidadId)
        : true

    let fill = (() => {
      if (isLocked) return LOCK_FILL
      if (isProvinceDimmed) return DIM_FILL
      if (status) return statusFill[status]
      switch (colorMode) {
        case 'por-provincia':
          return colorForProvince(provincia, theme)
        case 'por-comunidad':
          return colorForCommunity(comunidad, theme)
        case 'poblacion':
          return populationColor(info)
        case 'altitud':
          return altitudeColor(info?.altitud)
        case 'colorido':
        default:
          return adaptColorForTheme(colorById.get(municipioId) ?? uniformFill, theme)
      }
    })()

    if (isFocusDimmed) {
      fill = mixHexColors(
        fill,
        theme === 'oscuro' ? '#0f172a' : '#e2e8f0',
        theme === 'oscuro' ? 0.5 : 0.35
      )
    }

    if (isCorrectBlink) {
      fill = mixHexColors(fill, '#fde047', 0.45)
    } else if (showCelebration) {
      fill = mixHexColors(fill, '#facc15', 0.3)
    }

    const baseOpacity = isLocked
      ? 0.8
      : status
        ? 0.85
        : isProvinceDimmed
          ? 0.5
          : isFocusDimmed
            ? 0.3
            : 0.75

    let fillOpacity = baseOpacity
    if (hasRoadsLayer) {
      if (status) {
        fillOpacity = 0.32
      } else if (isHighlight || isCorrectBlink || showCelebration) {
        fillOpacity = 0.25
      } else {
        fillOpacity = 0.04
      }
    }

    const baseStroke = theme === 'oscuro' ? '#0f172a' : '#475569'
    const neonStroke = '#22d3ee'
    const stroke = (() => {
      if (hasRoadsLayer) {
        if (status === 'correcta') return '#22c55e'
        if (status === 'fallida') return '#f87171'
        if (isHighlight || isCorrectBlink || showCelebration) return '#facc15'
        if (isFocusDimmed) return mixHexColors(neonStroke, '#64748b', 0.35)
        return neonStroke
      }
      if (isLocked) return '#0b1220'
      return baseStroke
    })()

    const strokeWidth = hasRoadsLayer
      ? isHighlight || status || isCorrectBlink
        ? 3.2
        : isFocusDimmed
          ? 1.6
          : 2.4
      : isLocked
        ? 1.8
        : isHighlight
          ? 2.4
          : 1.1

    const superficie = info?.superficieKm2 ?? 0
    const labelSize = Math.max(10, Math.min(22, Math.sqrt(Math.abs(superficie)) * 0.45))
    const labelOpacity = hasRoadsLayer
      ? isProvinceDimmed || isFocusDimmed
        ? 0.75
        : 1
      : isProvinceDimmed || isFocusDimmed
        ? 0.35
        : 0.9
    const labelColor = hasRoadsLayer ? '#ffffff' : theme === 'oscuro' ? '#f8fafc' : '#0f172a'

    collection.features.push({
      type: 'Feature',
      geometry: feature.geometry,
      id: municipioId,
      properties: {
        id: municipioId,
        nombre: info?.nombre ?? municipioId,
        fill,
        fillOpacity,
        stroke,
        strokeWidth,
        label: info?.nombre ?? municipioId,
        labelSize,
        labelColor,
        labelOpacity,
        locked: isLocked,
        cursor: isLocked ? 'default' : 'pointer',
        maskVisible
      }
    })
  }

  return { collection, bounds }
}

const calculateCelebrationPoint = (
  celebration: CelebrationState | undefined,
  dataset: FeatureCollection<Geometry, MunicipioFeatureProperties>
) => {
  if (!celebration?.municipioId) return undefined
  const feature = dataset.features.find((feat) => feat.id === celebration.municipioId)
  if (!feature) return undefined
  try {
    const [lon, lat] = geoCentroid(feature as Feature<Geometry, MunicipioFeatureProperties>)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined
    return { lon, lat }
  } catch {
    return undefined
  }
}

const EMPTY_COLLECTION: FeatureCollection = {
  type: 'FeatureCollection',
  features: []
}

const WORLD_OUTER_RING: [number, number][] = [
  [-179.99, -85],
  [-179.99, 85],
  [179.99, 85],
  [179.99, -85],
  [-179.99, -85]
]

const ringArea = (ring: number[][]) => {
  let area = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index]
    const [x2, y2] = ring[index + 1]
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

const ensureClockwise = (ring: number[][]) => {
  if (ringArea(ring) < 0) return ring
  return [...ring].reverse()
}

const ensureCounterClockwise = (ring: number[][]) => {
  if (ringArea(ring) > 0) return ring
  return [...ring].reverse()
}

const closeRing = (ring: number[][]) => {
  if (ring.length === 0) return ring
  const [firstLon, firstLat] = ring[0]
  const [lastLon, lastLat] = ring[ring.length - 1]
  if (firstLon === lastLon && firstLat === lastLat) {
    return [...ring]
  }
  return [...ring, [firstLon, firstLat]]
}

const buildMaskCollection = (
  features: Feature<Geometry, MunicipioFeatureProperties>[],
  roadsMode: boolean
): FeatureCollection => {
  if (!roadsMode) return EMPTY_COLLECTION

  const holes: number[][][] = []

  for (const feature of features) {
    const maskVisible = Boolean(feature.properties?.maskVisible)
    if (!maskVisible) continue
    const geometry = feature.geometry
    if (!geometry) continue

    if (geometry.type === 'Polygon') {
      const polygons = geometry.coordinates
      if (!polygons.length) continue
      const outer = closeRing(polygons[0])
      if (outer.length < 4) continue
      holes.push(ensureClockwise(outer))
    } else if (geometry.type === 'MultiPolygon') {
      for (const polygon of geometry.coordinates) {
        if (!polygon.length) continue
        const outer = closeRing(polygon[0])
        if (outer.length < 4) continue
        holes.push(ensureClockwise(outer))
      }
    }
  }

  if (holes.length === 0) return EMPTY_COLLECTION

  const outerRing = ensureCounterClockwise(closeRing(WORLD_OUTER_RING))

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [outerRing, ...holes]
        },
        properties: {}
      }
    ]
  }
}

const MapCanvasComponent = ({
  features,
  highlightMunicipioId,
  colorMode,
  modo,
  infoById,
  selectedCommunities,
  selectedProvinces,
  statuses,
  onSelect,
  correctBlinkId,
  celebration,
  lockedMunicipios,
  showLabels = false,
  theme,
  focusedMunicipios
}: MapCanvasProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const hasFitBoundsRef = useRef(false)

  const selectedProvinceSet = useMemo(
    () => new Set<ProvinciaId>(selectedProvinces),
    [selectedProvinces]
  )

  const selectedCommunitySet = useMemo(
    () => new Set<ComunidadId>(selectedCommunities),
    [selectedCommunities]
  )

  const colorById = useMemo(() => {
    try {
      return assignColors(features)
    } catch (error) {
      console.error('Error assigning colors', error)
      return new Map<string, string>()
    }
  }, [features])

  const roadsMode = colorMode === 'carreteras'

  const dataset = useMemo(
    () =>
      buildDataset(
        features,
        infoById,
        selectedProvinceSet,
        selectedCommunitySet,
        colorMode,
        statuses,
        highlightMunicipioId,
        correctBlinkId,
        celebration,
        lockedMunicipios,
        colorById,
        theme,
        roadsMode,
        focusedMunicipios ?? null
      ),
    [
      celebration,
      colorById,
      colorMode,
      correctBlinkId,
      features,
      focusedMunicipios,
      highlightMunicipioId,
      infoById,
      lockedMunicipios,
      selectedCommunitySet,
      selectedProvinceSet,
      statuses,
      theme,
      roadsMode
    ]
  )

  const celebrationPoint = useMemo(
    () => calculateCelebrationPoint(celebration, dataset.collection),
    [celebration, dataset.collection]
  )

  const maskCollection = useMemo(
    () => buildMaskCollection(dataset.collection.features, roadsMode),
    [roadsMode, dataset.collection.features]
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: blankStyle,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      cooperativeGestures: true
    })

    map.addControl(new maplibregl.AttributionControl({ compact: true }))

    mapRef.current = map
    const onLoad = () => {
      setMapReady(true)
    }

    map.on('load', onLoad)

    return () => {
      map.off('load', onLoad)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    ;(['roads'] as const).forEach((key) => {
      const sourceId = BASE_SOURCE_IDS[key]
      if (!map.getSource(sourceId)) {
        const config = BASE_LAYER_CONFIG[key]
        map.addSource(sourceId, {
          type: 'raster',
          tiles: [config.tiles],
          tileSize: config.tileSize ?? 256,
          minzoom: config.minzoom,
          maxzoom: config.maxzoom,
          attribution: config.attribution
        })
      }

      const layerId = BASE_LAYER_IDS[key]
      if (!map.getLayer(layerId)) {
        map.addLayer(
          {
            id: layerId,
            type: 'raster',
            source: sourceId,
            paint: {
              'raster-opacity': 1,
              'raster-contrast': 0.85,
              'raster-brightness-max': 1.35,
              'raster-brightness-min': 0.1,
              'raster-saturation': 0.2
            }
          },
          MAP_FILL_LAYER_ID
        )
        map.setLayoutProperty(layerId, 'visibility', 'none')
      }
    })

    if (!map.getSource(MASK_SOURCE_ID)) {
      map.addSource(MASK_SOURCE_ID, {
        type: 'geojson',
        data: EMPTY_COLLECTION
      })
    }

    if (!map.getLayer(MASK_LAYER_ID)) {
      map.addLayer(
        {
          id: MASK_LAYER_ID,
          type: 'fill',
          source: MASK_SOURCE_ID,
          paint: {
            'fill-color': theme === 'oscuro' ? '#0b1120' : '#e2e8f0',
            'fill-opacity': roadsMode ? 1 : 0
          }
        },
        MAP_FILL_LAYER_ID
      )
      map.setLayoutProperty(MASK_LAYER_ID, 'visibility', 'none')
    } else {
      map.setPaintProperty(MASK_LAYER_ID, 'fill-color', theme === 'oscuro' ? '#0b1120' : '#e2e8f0')
      map.setPaintProperty(MASK_LAYER_ID, 'fill-opacity', roadsMode ? 1 : 0)
    }
  }, [mapReady, theme, roadsMode])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current

    const source = map.getSource(MAP_SOURCE_ID) as GeoJSONSource | undefined

    if (!source) {
      map.addSource(MAP_SOURCE_ID, {
        type: 'geojson',
        data: dataset.collection
      })

      map.addLayer(
        {
          id: MAP_FILL_LAYER_ID,
          type: 'fill',
          source: MAP_SOURCE_ID,
          paint: {
            'fill-color': ['get', 'fill'],
            'fill-opacity': ['get', 'fillOpacity']
          }
        },
        undefined
      )

      map.addLayer({
        id: MAP_LINE_LAYER_ID,
        type: 'line',
        source: MAP_SOURCE_ID,
        paint: {
          'line-color': ['get', 'stroke'],
          'line-width': ['get', 'strokeWidth']
        }
      })

      map.addLayer({
        id: MAP_HIGHLIGHT_LAYER_ID,
        type: 'line',
        source: MAP_SOURCE_ID,
        paint: {
          'line-color': '#facc15',
          'line-width': 3
        },
        filter: ['==', ['id'], '']
      })

      map.addLayer({
        id: MAP_LABEL_LAYER_ID,
        type: 'symbol',
        source: MAP_SOURCE_ID,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': ['get', 'labelSize'],
          'text-font': ['Noto Sans Regular'],
          'text-allow-overlap': false,
          'text-padding': 2,
          'symbol-z-order': 'source'
        },
        paint: {
          'text-color': ['get', 'labelColor'],
          'text-opacity': ['get', 'labelOpacity']
        }
      })

      map.on('click', MAP_FILL_LAYER_ID, (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        const id = String(feature.id ?? feature.properties?.id ?? '')
        const locked = Boolean(feature.properties?.locked)
        if (locked) return
        onSelect?.(id)
      })

      map.on('mouseenter', MAP_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer'
      })

      map.on('mouseleave', MAP_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = ''
      })
    } else {
      source.setData(dataset.collection)
    }

    if (dataset.bounds && !hasFitBoundsRef.current) {
      hasFitBoundsRef.current = true
      const [[minLon, minLat], [maxLon, maxLat]] = dataset.bounds
      if (
        Number.isFinite(minLat) &&
        Number.isFinite(minLon) &&
        Number.isFinite(maxLat) &&
        Number.isFinite(maxLon)
      ) {
        const bounds: LngLatBoundsLike = [
          [minLon, minLat],
          [maxLon, maxLat]
        ]
        map.fitBounds(
          bounds,
          {
            padding: 32,
            duration: 0
          },
          undefined
        )
      }
    }
  }, [dataset, mapReady, onSelect])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const source = map.getSource(MASK_SOURCE_ID) as GeoJSONSource | undefined
    if (!source) return
    source.setData(maskCollection)
  }, [mapReady, maskCollection])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (!map.getLayer(MAP_HIGHLIGHT_LAYER_ID)) return

    if (highlightMunicipioId) {
      map.setFilter(MAP_HIGHLIGHT_LAYER_ID, ['==', ['id'], highlightMunicipioId])
    } else {
      map.setFilter(MAP_HIGHLIGHT_LAYER_ID, ['==', ['literal', ''], 'not-used'])
    }
  }, [highlightMunicipioId, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    ;(['roads'] as const).forEach((key) => {
      const layerId = BASE_LAYER_IDS[key]
      if (!map.getLayer(layerId)) return
      const visibility = roadsMode ? 'visible' : 'none'
      map.setLayoutProperty(layerId, 'visibility', visibility)
    })
    if (map.getLayer(MASK_LAYER_ID)) {
      map.setLayoutProperty(MASK_LAYER_ID, 'visibility', roadsMode ? 'visible' : 'none')
      map.setPaintProperty(MASK_LAYER_ID, 'fill-opacity', roadsMode ? 1 : 0)
    }
  }, [roadsMode, mapReady])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    if (!map.getLayer(MAP_LABEL_LAYER_ID)) return
    const visible = modo === 'estudio' && showLabels ? 'visible' : 'none'
    map.setLayoutProperty(MAP_LABEL_LAYER_ID, 'visibility', visible)
  }, [mapReady, modo, showLabels])

  useEffect(() => {
    if (!mapReady || !mapRef.current) return
    const map = mapRef.current
    const existingSource = map.getSource(MAP_CELEBRATION_SOURCE_ID) as GeoJSONSource | undefined

    if (!celebrationPoint) {
      if (existingSource && map.getLayer(MAP_CELEBRATION_LAYER_ID)) {
        map.removeLayer(MAP_CELEBRATION_LAYER_ID)
        map.removeSource(MAP_CELEBRATION_SOURCE_ID)
      }
      return
    }

    const celebrationFeature: FeatureCollection = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [celebrationPoint.lon, celebrationPoint.lat]
          },
          properties: {}
        }
      ]
    }

    if (!existingSource) {
      map.addSource(MAP_CELEBRATION_SOURCE_ID, {
        type: 'geojson',
        data: celebrationFeature
      })

      map.addLayer({
        id: MAP_CELEBRATION_LAYER_ID,
        type: 'circle',
        source: MAP_CELEBRATION_SOURCE_ID,
        paint: {
          'circle-radius': 18,
          'circle-color': '#facc15',
          'circle-opacity': 0.35,
          'circle-stroke-color': '#fde68a',
          'circle-stroke-width': 2
        }
      })
    } else {
      existingSource.setData(celebrationFeature)
    }
  }, [celebrationPoint, mapReady])

  return (
    <div className="map-container map-canvas">
      <div ref={containerRef} className="maplibre-container" />
    </div>
  )
}

export const MapCanvas = memo(MapCanvasComponent)
