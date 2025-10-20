import type { MunicipioInfo } from '../../types/municipio'

type MunicipioInfoPanelProps = {
  municipio?: MunicipioInfo
}

const EMPTY_STATE: MunicipioInfo = {
  id: 'placeholder',
  nombre: 'Selecciona un municipio',
  provincia: 'toledo'
}

export const MunicipioInfoPanel = ({ municipio }: MunicipioInfoPanelProps) => {
  const data = municipio ?? EMPTY_STATE

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
          {municipio.descripcion ? (
            <div>
              <dt>Descripción</dt>
              <dd>{municipio.descripcion}</dd>
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
