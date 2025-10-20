import { memo, useMemo } from 'react'
import type { ReactElement } from 'react'
import type { Feature, Geometry } from 'geojson'
import { geoMercator, geoPath } from 'd3-geo'
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
    <div className="map-canvas">
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
            const isDimmed = !status && !selectedProvinceSet.has(provincia as ProvinciaId)

            const fill = status
              ? statusFill[status]
              : colorMode === 'por-provincia'
                ? // en modo por-provincia mantenemos el comportamiento anterior
                  provincePalette[provincia] ?? '#fbbf24'
                : // modo uniforme ahora usa colores individuales por municipio
                  colorById.get(municipioId) ?? uniformFill

            const opacity = status ? 0.95 : isDimmed ? 0.25 : 0.85

            return (
              <path
                key={municipioId}
                d={d}
                className={clsx('map-canvas__feature', {
                  'map-canvas__feature--active': isActive,
                  'map-canvas__feature--dimmed': !status && isDimmed,
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
