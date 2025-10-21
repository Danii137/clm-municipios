import { memo, useMemo, useRef, useEffect } from 'react'
import type { ReactElement } from 'react'
import type { Feature, Geometry } from 'geojson'
import { geoMercator, geoPath } from 'd3-geo'
import { select } from 'd3-selection'
import { zoom, type ZoomBehavior } from 'd3-zoom'
import clsx from 'clsx'
import { assignColors } from '../../utils/coloring'
import type { ColorMode, GameMode } from '../../store/gameStore'
import type { MunicipioInfo, ProvinciaId, RespuestaEstado } from '../../types/municipio'

type MapCanvasProps = {
  features: Feature<Geometry, Record<string, unknown>>[]
  highlightMunicipioId?: string
  colorMode: ColorMode
  modo: GameMode
  infoById: Map<string, MunicipioInfo>
  selectedProvinces: ProvinciaId[]
  statuses?: Record<string, RespuestaEstado>
  onSelect?: (municipioId: string) => void
}

const WIDTH = 760
const HEIGHT = 520

const provincePalette: Record<string, string> = {
  toledo: '#818cf8',
  'ciudad-real': '#f97316',
  cuenca: '#22d3ee',
  guadalajara: '#8b5cf6',
  albacete: '#34d399'
}

const uniformFill = '#c7d2fe'

const statusFill: Record<RespuestaEstado, string> = {
  correcta: '#22c55e',
  fallida: '#f87171',
  pendiente: uniformFill
}

const MapCanvasComponent = ({
  features,
  highlightMunicipioId,
  colorMode,
  modo,
  infoById,
  selectedProvinces,
  statuses,
  onSelect
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
    const svg = select(svgRef.current)
    const g = select(gRef.current)

    const zb: ZoomBehavior<Element, unknown> = zoom()
      .scaleExtent([0.5, 20])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zb as any)

    // prevent page scroll when using wheel over the svg (allow wheel to zoom map)
    const rawSvg = svgRef.current
    const wheelHandler = (e: WheelEvent) => {
      // allow CTRL+wheel for browser zoom? we want wheel to zoom map, so always prevent default
      e.preventDefault()
    }
    rawSvg.addEventListener('wheel', wheelHandler, { passive: false })

    return () => {
      rawSvg.removeEventListener('wheel', wheelHandler)
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

  return (
    <div className="map-container map-canvas">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Mapa vectorial de Castilla-La Mancha"
      >
        <rect
          width={WIDTH}
          height={HEIGHT}
          rx={24}
          className="map-canvas__background"
        />
        {pathGenerator && projectedFeatures.length > 0 ? (
          projectedFeatures.map((feature): ReactElement | null => {
            const municipioId = String(
              feature.properties?.id ?? feature.id ?? 'sin-id'
            )
            const info = infoById.get(municipioId)
            const provincia = info?.provincia ?? String(feature.properties?.provincia ?? '')
            const nombreProp = info?.nombre ?? municipioId
            const d = pathGenerator(feature as Feature)
            if (!d) return null

            const status = statuses?.[municipioId]
            const isActive = highlightMunicipioId === municipioId
            // Si hay provincias seleccionadas, solo se encienden los municipios de esas provincias
            const isProvinceDimmed = selectedProvinceSet.size > 0 && !selectedProvinceSet.has(provincia as ProvinciaId)

            // Color gris cuando la provincia está deseleccionada
            const DIM_FILL = '#9ca3af'

            const fill = isProvinceDimmed
              ? DIM_FILL
              : status
                ? statusFill[status]
                : colorMode === 'por-provincia'
                  ? // en modo por-provincia mantenemos el comportamiento anterior
                    provincePalette[provincia] ?? '#fbbf24'
                  : // modo uniforme ahora usa colores individuales por municipio
                    colorById.get(municipioId) ?? uniformFill

            const opacity = status ? 0.95 : isProvinceDimmed ? 0.6 : 0.85

            return (
              <path
                key={municipioId}
                d={d}
                className={clsx('map-canvas__feature', {
                  'map-canvas__feature--active': isActive,
                  'map-canvas__feature--dimmed': !status && isProvinceDimmed,
                  'map-canvas__feature--quiz': modo === 'reto'
                })}
                fill={fill}
                stroke="#312e81"
                strokeWidth={isActive ? 2.4 : 1.1}
                fillOpacity={opacity}
                onClick={() => onSelect?.(municipioId)}
              >
                <title>{nombreProp}</title>
              </path>
            )
          })
        ) : (
          <text x="50%" y="50%" textAnchor="middle" className="map-canvas__placeholder">
            Cargando mapa…
          </text>
        )}
      </svg>
    </div>
  )
}

export const MapCanvas = memo(MapCanvasComponent)
