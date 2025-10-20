import { useState, useEffect } from 'react'
import type { MunicipioInfo } from '../../types/municipio'
import clsx from 'clsx'

type MunicipioInfoPanelProps = {
  municipio?: MunicipioInfo
}

const EMPTY_STATE: MunicipioInfo = {
  id: 'placeholder',
  nombre: 'Selecciona un municipio',
  provincia: 'toledo'
}

export const MunicipioInfoPanel = ({ municipio }: MunicipioInfoPanelProps) => {
  const [isVisible, setIsVisible] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const data = municipio ?? EMPTY_STATE

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    if (municipio) {
      setIsVisible(true)
    }
  }, [municipio])

  const togglePanel = () => {
    if (isMobile) {
      setIsVisible(!isVisible)
    }
  }

  const formatCoord = (value: number, axis: 'lat' | 'lon') => {
    const abs = Math.abs(value).toFixed(4)
    const suffix = value >= 0 ? (axis === 'lat' ? 'N' : 'E') : axis === 'lat' ? 'S' : 'O'
    return `${abs}º ${suffix}`
  }

  return (
    <section className="municipio-info">
      <h2 className="municipio-info__title">{data.nombre}</h2>
      {municipio ? (
        <dl className="municipio-info__list">
          <div>
            <dt>Provincia</dt>
            <dd>{municipio.provincia}</dd>
          </div>
          {typeof municipio.poblacion === 'number' ? (
            <div>
              <dt>Población</dt>
              <dd>{municipio.poblacion.toLocaleString('es-ES')}</dd>
            </div>
          ) : null}
          {typeof municipio.superficieKm2 === 'number' ? (
            <div>
              <dt>Superficie</dt>
              <dd>{municipio.superficieKm2.toLocaleString('es-ES')} km²</dd>
            </div>
          ) : null}
          {typeof municipio.altitud === 'number' ? (
            <div>
              <dt>Altitud</dt>
              <dd>{municipio.altitud.toLocaleString('es-ES')} m</dd>
            </div>
          ) : null}
          {municipio.coordenadas ? (
            <div>
              <dt>Coordenadas</dt>
              <dd>
                {formatCoord(municipio.coordenadas.lat, 'lat')} ·{' '}
                {formatCoord(municipio.coordenadas.lon, 'lon')}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="municipio-info__empty">
          Explora el mapa para consultar la ficha de cada municipio.
        </p>
      )}
    </section>
  )
}
