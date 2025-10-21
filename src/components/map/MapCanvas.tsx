import { memo, useMemo, useRef, useEffect } from 'react'
import type { ReactElement } from 'react'
import type { Feature, Geometry } from 'geojson'
import { geoMercator, geoPath } from 'd3-geo'
import { select, pointer } from 'd3-selection'
import { zoom, type ZoomBehavior } from 'd3-zoom'
import clsx from 'clsx'
import { assignColors } from '../../utils/coloring'
import type { CelebrationState, ColorMode, GameMode } from '../../store/gameStore'
import type { MunicipioId, MunicipioInfo, ProvinciaId, RespuestaEstado } from '../../types/municipio'

type MapCanvasProps = {
  features: Feature<Geometry, Record<string, unknown>>[]
  highlightMunicipioId?: string
  colorMode: ColorMode
  modo: GameMode
  infoById: Map<string, MunicipioInfo>
  selectedProvinces: ProvinciaId[]
  statuses?: Record<string, RespuestaEstado>
  onSelect?: (municipioId: string) => void
  correctBlinkId?: string
  celebration?: CelebrationState
  lockedMunicipios?: Set<MunicipioId>
}

const WIDTH = 760
const HEIGHT = 520

const uniformFill = '#c7d2fe'

const statusFill: Record<RespuestaEstado, string> = {
  correcta: '#22c55e',
  fallida: '#f87171',
  pendiente: uniformFill
}

const MIN_ZOOM = 0.85
const MAX_ZOOM = 10
const DOUBLE_CLICK_SCALE = 1.5
const DIM_FILL = '#9ca3af'
const LOCK_FILL = '#050505'
const ZOOM_PADDING = 80

const provinceColorCache = new Map<string, string>()
const communityColorCache = new Map<string, string>()

const colorForProvince = (provinciaId: string | undefined) => {
  if (!provinciaId) return '#6b7280'
  if (provinceColorCache.has(provinciaId)) {
    return provinceColorCache.get(provinciaId) as string
  }

  let hash = 0
  for (let i = 0; i < provinciaId.length; i += 1) {
    hash = (hash << 5) - hash + provinciaId.charCodeAt(i)
    hash |= 0
  }

  const hue = Math.abs(hash) % 360
  const color = `hsl(${hue}, 60%, 62%)`
  provinceColorCache.set(provinciaId, color)
  return color
}

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

const colorForCommunity = (communityId: string | undefined) => {
  if (!communityId) return '#6b7280'
  if (communityColorCache.has(communityId)) {
    return communityColorCache.get(communityId) as string
  }

  let hash = 0
  for (let i = 0; i < communityId.length; i += 1) {
    hash = (hash << 5) - hash + communityId.charCodeAt(i)
    hash |= 0
  }

  const color = communityPalette[Math.abs(hash) % communityPalette.length]
  communityColorCache.set(communityId, color)
  return color
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

const bringFeatureToFront = (element: SVGPathElement | null) => {
  if (!element) return
  const parent = element.parentNode
  if (parent && typeof (parent as SVGGElement).appendChild === 'function') {
    ;(parent as SVGGElement).appendChild(element)
  }
}

const MapCanvasComponent = ({
  features,
  highlightMunicipioId,
  colorMode,
  modo,
  infoById,
  selectedProvinces,
  statuses,
  onSelect,
  correctBlinkId,
  celebration,
  lockedMunicipios
}: MapCanvasProps) => {
  // Mantener set de provincias seleccionadas
  const selectedProvinceSet = useMemo(
    () => new Set<ProvinciaId>(selectedProvinces),
    [selectedProvinces]
  )

  const { pathGenerator, projectedFeatures } = useMemo(() => {
    if (features.length === 0) {
      return {
        pathGenerator: null,
        projectedFeatures: [] as Feature<Geometry, Record<string, unknown>>[]
      }
    }

    const projection = geoMercator().fitSize([WIDTH, HEIGHT], {
      type: 'FeatureCollection',
      features
    })
    const generator = geoPath(projection)
    return { pathGenerator: generator, projectedFeatures: features }
  }, [features])

  // refs for zoom/pan
  const svgRef = useRef<SVGSVGElement | null>(null)
  const gRef = useRef<SVGGElement | null>(null)

  // set up d3 zoom behaviour only on the map svg
  useEffect(() => {
    if (!svgRef.current || !gRef.current) return
    const svg = select<SVGSVGElement, unknown>(svgRef.current)
    const g = select<SVGGElement, unknown>(gRef.current)
    const rawSvg = svgRef.current

    svg.style('touch-action', 'none')
    svg.style('cursor', 'grab')

    const zoomBehavior: ZoomBehavior<SVGSVGElement, unknown> = zoom<SVGSVGElement, unknown>()
      .scaleExtent([MIN_ZOOM, MAX_ZOOM])
      .translateExtent([
        [-ZOOM_PADDING, -ZOOM_PADDING],
        [WIDTH + ZOOM_PADDING, HEIGHT + ZOOM_PADDING]
      ])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoomBehavior)

    // prevent page scroll when using wheel over the svg (allow wheel to zoom map)
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault()
    }
    rawSvg.addEventListener('wheel', wheelHandler, { passive: false })

    const pointerDownHandler = () => {
      svg.style('cursor', 'grabbing')
    }
    const pointerUpHandler = () => {
      svg.style('cursor', 'grab')
    }

    rawSvg.addEventListener('pointerdown', pointerDownHandler)
    rawSvg.addEventListener('pointerup', pointerUpHandler)
    rawSvg.addEventListener('pointerleave', pointerUpHandler)
    rawSvg.addEventListener('pointercancel', pointerUpHandler)

    const dblHandler = (event: MouseEvent) => {
      // zoom in around pointer on double click
      event.preventDefault()
      const point = pointer(event, rawSvg) as [number, number]
      try {
        zoomBehavior.scaleBy(svg, DOUBLE_CLICK_SCALE, point)
      } catch (error) {
        g.attr('transform', 'translate(0,0) scale(1)')
      }
    }
    rawSvg.addEventListener('dblclick', dblHandler)

    return () => {
      rawSvg.removeEventListener('wheel', wheelHandler)
      rawSvg.removeEventListener('dblclick', dblHandler)
      rawSvg.removeEventListener('pointerdown', pointerDownHandler)
      rawSvg.removeEventListener('pointerup', pointerUpHandler)
      rawSvg.removeEventListener('pointerleave', pointerUpHandler)
      rawSvg.removeEventListener('pointercancel', pointerUpHandler)
      svg.on('.zoom', null)
    }
  }, [features])

  // asignar colores únicos a cada municipio usando la heurística
  const colorById = useMemo(() => {
    try {
      return assignColors(features)
    } catch (e) {
      console.error('Error assigning colors', e)
      return new Map<string, string>()
    }
  }, [features])

  const celebrationPoint = useMemo(() => {
    if (!celebration || !pathGenerator) return undefined
    if (!celebration.municipioId) return undefined
    const feature = projectedFeatures.find((feat) => {
      const municipioId = String(feat.properties?.id ?? feat.id ?? 'sin-id')
      return municipioId === celebration.municipioId
    })
    if (!feature) return undefined
    try {
      const [cx, cy] = (pathGenerator as any).centroid(feature)
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return undefined
      return {
        x: cx,
        y: cy,
        key: celebration.key
      }
    } catch (error) {
      console.error('Error calculating celebration centroid', error)
      return undefined
    }
  }, [celebration, pathGenerator, projectedFeatures])

  return (
    <div className="map-container map-canvas">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Mapa vectorial de Castilla-La Mancha"
      >
        <g ref={gRef}>
          <rect
            width={WIDTH}
            height={HEIGHT}
            rx={24}
            className="map-canvas__background"
          />
          {pathGenerator && projectedFeatures.length > 0
            ? projectedFeatures.map((feature): ReactElement | null => {
                const municipioId = String(
                  feature.properties?.id ?? feature.id ?? 'sin-id'
                )
                const info = infoById.get(municipioId)
                const provincia = info?.provincia ?? String(feature.properties?.provincia ?? '')
                const comunidad = info?.comunidad
                const nombreProp = info?.nombre ?? municipioId
                const d = pathGenerator(feature as Feature)
                if (!d) return null

                const status = statuses?.[municipioId]
                const isActive = highlightMunicipioId === municipioId
                // Si hay provincias seleccionadas, solo se encienden los municipios de esas provincias
                const isProvinceDimmed =
                  selectedProvinceSet.size > 0 && !selectedProvinceSet.has(provincia as ProvinciaId)

                const isLocked = lockedMunicipios?.has(municipioId)

                const fill = (() => {
                  if (isLocked) return LOCK_FILL
                  if (isProvinceDimmed) return DIM_FILL
                  if (status) return statusFill[status]
                  switch (colorMode) {
                    case 'por-provincia':
                      return colorForProvince(provincia)
                    case 'por-comunidad':
                      return colorForCommunity(comunidad)
                    case 'poblacion':
                      return populationColor(info)
                    case 'altitud':
                      return altitudeColor(info?.altitud)
                    case 'colorido':
                    default:
                      return colorById.get(municipioId) ?? uniformFill
                  }
                })()

                const opacity = isLocked
                  ? 0.9
                  : status
                    ? 0.95
                    : isProvinceDimmed
                      ? 0.6
                      : 0.85
                const isCorrectTarget = correctBlinkId === municipioId
                const showCelebration = celebration?.municipioId === municipioId
                const featureClassName = clsx('map-canvas__feature', {
                  'map-canvas__feature--active': isActive,
                  'map-canvas__feature--dimmed': !status && isProvinceDimmed,
                  'map-canvas__feature--quiz': modo === 'reto',
                  'map-canvas__feature--correct-target': isCorrectTarget,
                  'map-canvas__feature--locked': isLocked,
                  'map-canvas__feature--locked-success': isLocked && status === 'correcta',
                  'map-canvas__feature--locked-fail': isLocked && status === 'fallida',
                  'map-canvas__feature--celebration': showCelebration
                })

                const strokeColor = isLocked ? '#0f172a' : '#312e81'

                const strokeWidth = isLocked
                  ? status === 'correcta' || status === 'fallida'
                    ? 2.4
                    : 1.8
                  : isActive
                    ? 2.4
                    : 1.1

                const strokeDasharray = isLocked
                  ? status === 'correcta' || status === 'fallida'
                    ? '4 2'
                    : '2 2'
                  : undefined

                return (
                  <path
                    key={municipioId}
                    d={d}
                    className={featureClassName}
                    fill={fill}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    vectorEffect="non-scaling-stroke"
                    fillOpacity={opacity}
                onClick={() => onSelect?.(municipioId)}
                onMouseEnter={(event) => bringFeatureToFront(event.currentTarget)}
              >
                <title>{nombreProp}</title>
              </path>
            )
          })
            : null}
          {celebrationPoint ? (
            <g
              key={celebrationPoint.key}
              className="map-celebration"
              transform={`translate(${celebrationPoint.x} ${celebrationPoint.y})`}
            >
              <circle className="map-celebration__glow" r="18" />
              <path
                className="map-celebration__star"
                d="M0 -12 L3.6 -4.2 L11.5 -3.8 L5.8 1.8 L7.8 9.6 L0 5.2 L-7.8 9.6 L-5.8 1.8 L-11.5 -3.8 L-3.6 -4.2 Z"
              />
            </g>
          ) : null}
        </g>
        {!pathGenerator || projectedFeatures.length === 0 ? (
          <text x="50%" y="50%" textAnchor="middle" className="map-canvas__placeholder">
            Cargando mapa…
          </text>
        ) : null}
      </svg>
    </div>
  )
}

export const MapCanvas = memo(MapCanvasComponent)
