import { memo, useMemo } from 'react'
import type { ReactElement } from 'react'
import type { Feature, Geometry } from 'geojson'
import { geoMercator, geoPath } from 'd3-geo'
import type { ColorMode } from '../../store/gameStore'

type MapCanvasProps = {
  features: Feature<Geometry, Record<string, unknown>>[]
  highlightMunicipioId?: string
  colorMode: ColorMode
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

const MapCanvasComponent = ({
  features,
  highlightMunicipioId,
  colorMode,
  onSelect
}: MapCanvasProps) => {
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
            const provincia = String(feature.properties?.provincia ?? '')
            const nombreProp =
              typeof feature.properties?.nombre === 'string'
                ? feature.properties.nombre
                : municipioId
            const d = pathGenerator(feature as Feature)
            if (!d) return null

            const isActive = highlightMunicipioId === municipioId
            const fill =
              colorMode === 'por-provincia'
                ? provincePalette[provincia] ?? '#fbbf24'
                : uniformFill

            return (
              <path
                key={municipioId}
                d={d}
                className={`map-canvas__feature${
                  isActive ? ' map-canvas__feature--active' : ''
                }`}
                fill={fill}
                stroke="#312e81"
                strokeWidth={isActive ? 2.8 : 1.2}
                onClick={() => onSelect?.(municipioId)}
              >
                <title>{nombreProp}</title>
              </path>
            )
          })
        ) : (
          <text x="50%" y="50%" textAnchor="middle" className="map-canvas__placeholder">
            Cargando mapa de prueba…
          </text>
        )}
      </svg>
    </div>
  )
}

export const MapCanvas = memo(MapCanvasComponent)
