import { useMemo, useState } from 'react'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import { AppShell } from './components/layout/AppShell'
import { MapCanvas } from './components/map/MapCanvas'
import { MunicipioInfoPanel } from './components/map/MunicipioInfoPanel'
import { mockMunicipios } from './data/mockMunicipios'
import { useGameStore, type GameMode, type ColorMode } from './store/gameStore'
import type { MunicipioInfo } from './types/municipio'
import sampleMap from './data/sample-map.json' with { type: 'json' }
import './App.css'

function App() {
  const [selected, setSelected] = useState<MunicipioInfo | undefined>()
  const { modo, setModo, colorMode, setColorMode } = useGameStore()

  const municipiosOrdenados = useMemo(
    () => [...mockMunicipios].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    []
  )

  const municipiosPorId = useMemo(() => {
    const map = new Map<string, MunicipioInfo>()
    for (const municipio of mockMunicipios) {
      map.set(municipio.id, municipio)
    }
    return map
  }, [])

  const sampleFeatures = useMemo(() => {
    const fc = sampleMap as FeatureCollection
    return fc.features as Feature<Geometry, Record<string, unknown>>[]
  }, [])

  const handleSelect = (municipioId: string) => {
    const municipio = municipiosPorId.get(municipioId)
    setSelected(municipio)
  }

  return (
    <AppShell
      header={
        <div className="header">
          <div>
            <h1>CLM Municipios</h1>
            <p>Entrena tu memoria geográfica de Castilla-La Mancha</p>
          </div>
          <div className="header__controls">
            <label>
              Modo
              <select
                value={modo}
                onChange={(event) => setModo(event.target.value as GameMode)}
              >
                <option value="estudio">Estudiar</option>
                <option value="preguntas">Reto</option>
              </select>
            </label>
            <label>
              Colores
              <select
                value={colorMode}
                onChange={(event) => setColorMode(event.target.value as ColorMode)}
              >
                <option value="uniforme">Uniforme</option>
                <option value="por-provincia">Por provincia</option>
              </select>
            </label>
          </div>
        </div>
      }
      sidebar={
        <div className="sidebar">
          <h2>Municipios (muestra)</h2>
          <p className="sidebar__hint">
            Selecciona un municipio para practicar mientras preparamos el mapa
            interactivo completo.
          </p>
          <ul className="sidebar__list">
            {municipiosOrdenados.map((municipio) => (
              <li key={municipio.id}>
                <button
                  type="button"
                  className={
                    selected?.id === municipio.id
                      ? 'sidebar__item sidebar__item--active'
                      : 'sidebar__item'
                  }
                  onClick={() => handleSelect(municipio.id)}
                >
                  {municipio.nombre}
                </button>
              </li>
            ))}
          </ul>
        </div>
      }
    >
      <div className="map-section">
        <MapCanvas
          features={sampleFeatures}
          highlightMunicipioId={selected?.id}
          colorMode={colorMode}
          onSelect={handleSelect}
        />
        <MunicipioInfoPanel municipio={selected} />
      </div>
    </AppShell>
  )
}

export default App
