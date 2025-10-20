import { useEffect, useMemo, useState } from 'react'
import clsx from 'clsx'
import { AppShell } from './components/layout/AppShell'
import { MapCanvas } from './components/map/MapCanvas'
import { MunicipioInfoPanel } from './components/map/MunicipioInfoPanel'
import {
  clmMunicipioFeatures,
  clmMunicipiosById,
  clmMunicipiosInfo
} from './data/clmMunicipios'
import { useGameStore, PROVINCES, type ColorMode } from './store/gameStore'
import { useShallow } from 'zustand/react/shallow'
import type { MunicipioInfo, ProvinciaId } from './types/municipio'
import './App.css'
import introLogo from './data/daniel-alonso-gomez.png'

const formatNumber = (value: number) => value.toLocaleString('es-ES')

type ComunidadId = 'clm' | 'custom'

const COMMUNITY_OPTIONS: Array<{
  id: ComunidadId
  label: string
  provinces?: ProvinciaId[]
}> = [
  { id: 'clm', label: 'Castilla-La Mancha', provinces: [...PROVINCES] as ProvinciaId[] },
  { id: 'custom', label: 'Personalizado' }
]

function App() {
  const [selected, setSelected] = useState<MunicipioInfo | undefined>()
  const [selectedCommunity, setSelectedCommunity] = useState<ComunidadId>('clm')
  const [showSplash, setShowSplash] = useState(true)

  const {
    modo,
    setModo,
    colorMode,
    setColorMode,
    selectedProvinces,
    setSelectedProvinces,
    startQuiz,
    marcarMunicipio,
    resetQuiz,
    preguntas,
    activeIndex,
    aciertos,
    fallos,
    completado,
    mapaEstados
  } = useGameStore(
    useShallow((state) => ({
      modo: state.modo,
      setModo: state.setModo,
      colorMode: state.colorMode,
      setColorMode: state.setColorMode,
      selectedProvinces: state.selectedProvinces,
      setSelectedProvinces: state.setSelectedProvinces,
      startQuiz: state.startQuiz,
      marcarMunicipio: state.marcarMunicipio,
      resetQuiz: state.resetQuiz,
      preguntas: state.preguntas,
      activeIndex: state.activeIndex,
      aciertos: state.aciertos,
      fallos: state.fallos,
      completado: state.completado,
      mapaEstados: state.mapaEstados
    }))
  )

  const activeQuestion = activeIndex >= 0 ? preguntas[activeIndex] : undefined

  const availableMunicipios = useMemo(
    () =>
      clmMunicipiosInfo.filter((municipio) =>
        selectedProvinces.includes(municipio.provincia)
      ),
    [selectedProvinces]
  )

  const remaining = preguntas.reduce(
    (acc, pregunta) => (pregunta.estado === 'pendiente' ? acc + 1 : acc),
    0
  )

  const handleSelectMunicipio = (municipioId: string) => {
    const info = clmMunicipiosById.get(municipioId)
    if (info) setSelected(info)

    if (modo === 'reto') {
      marcarMunicipio(municipioId)
    }
  }

  const toggleProvince = (provincia: ProvinciaId) => {
    if (selectedProvinces.includes(provincia)) {
      if (selectedProvinces.length === 1) return
      setSelectedProvinces(selectedProvinces.filter((prov) => prov !== provincia))
    } else {
      setSelectedProvinces([...selectedProvinces, provincia])
    }
    setSelectedCommunity('custom')
  }

  const startReto = (tipo: 'reto-10' | 'reto-provincia' | 'reto-total') => {
    const pool =
      tipo === 'reto-total' ? clmMunicipiosInfo : availableMunicipios
    if (pool.length === 0) return
    setSelected(undefined)
    startQuiz({ dificultad: tipo, municipios: pool })
  }

  const handleCommunityChange = (communityId: ComunidadId) => {
    setSelectedCommunity(communityId)
    const community = COMMUNITY_OPTIONS.find((option) => option.id === communityId)
    if (community?.provinces) {
      setSelectedProvinces(community.provinces)
    }
  }

  const quizFinalizado = modo === 'reto' && preguntas.length > 0 && completado

  useEffect(() => {
    if (!showSplash) return
    const timeout = setTimeout(() => setShowSplash(false), 3000)
    return () => clearTimeout(timeout)
  }, [showSplash])

  return (
    <>
      {showSplash ? (
        <div className="splash-screen" onClick={() => setShowSplash(false)}>
          <div className="splash-screen__card" onClick={(event) => event.stopPropagation()}>
            <img src={introLogo} alt="Daniel Alonso Gómez" className="splash-screen__logo" />
            <h1>Desarrollado por Daniel Alonso Gómez</h1>
            <p>Arquitecto Tecnológico</p>
            <button type="button" className="ghost-button" onClick={() => setShowSplash(false)}>
              Entrar
            </button>
          </div>
        </div>
      ) : null}
      <AppShell
      header={
        <div className="header">
          <div className="header__title">
            <h1>Castilla-La Mancha Challenge</h1>
            <p>Estudia o reta tu memoria geográfica municipio a municipio.</p>
          </div>
          <div className="header__controls">
            <label className="select-control">
              <span>Comunidad</span>
              <select
                value={selectedCommunity}
                onChange={(event) => handleCommunityChange(event.target.value as ComunidadId)}
              >
                {COMMUNITY_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mode-switch">
              <button
                type="button"
                className={clsx('mode-switch__btn', {
                  'mode-switch__btn--active': modo === 'estudio'
                })}
                onClick={() => {
                  resetQuiz()
                  setModo('estudio')
                }}
              >
                Estudiar
              </button>
              <button
                type="button"
                className={clsx('mode-switch__btn', {
                  'mode-switch__btn--active': modo === 'reto'
                })}
                onClick={() => setModo('reto')}
              >
                Reto
              </button>
            </div>
            <label className="select-control">
              <span>Colores</span>
              <select
                value={colorMode}
                onChange={(event) =>
                  setColorMode(event.target.value as ColorMode)
                }
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
          <section className="panel">
            <div className="panel__header">
              <h2>Provincias</h2>
              <p>Selecciona sobre qué provincias quieres practicar.</p>
            </div>
            <div className="chip-grid">
              {PROVINCES.map((provincia) => (
                <button
                  key={provincia}
                  type="button"
                  className={clsx('chip', {
                    'chip--active': selectedProvinces.includes(provincia)
                  })}
                  onClick={() => toggleProvince(provincia)}
                >
                  {provincia.replace('-', ' ')}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>{modo === 'reto' ? 'Reto' : 'Municipios'}</h2>
              {modo === 'estudio' ? (
                <span>{formatNumber(availableMunicipios.length)} municipios</span>
              ) : null}
            </div>

            {modo === 'reto' ? (
              <div className="panel__content">
                <p className="panel__hint">
                  Elige un modo de reto. Haz clic en el municipio correcto cuando se muestre el nombre.
                </p>
                <div className="panel__actions">
                  <button
                    type="button"
                    onClick={() => startReto('reto-10')}
                    className="ghost-button"
                  >
                    10 aleatorias
                  </button>
                  <button
                    type="button"
                    onClick={() => startReto('reto-provincia')}
                    className="ghost-button"
                  >
                    Provincias seleccionadas
                  </button>
                  <button
                    type="button"
                    onClick={() => startReto('reto-total')}
                    className="ghost-button"
                  >
                    Completar mapa
                  </button>
                </div>

                {preguntas.length > 0 ? (
                  <div className="panel__summary">
                    <p>
                      Preguntas: {preguntas.length} · Aciertos: {aciertos} · Fallos: {fallos}
                    </p>
                    {quizFinalizado ? (
                      <button type="button" className="ghost-button" onClick={resetQuiz}>
                        Reiniciar reto
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="panel__content panel__list">
                <ul className="sidebar__list">
                  {availableMunicipios.map((municipio) => (
                    <li key={municipio.id}>
                      <button
                        type="button"
                        className={clsx('sidebar__item', {
                          'sidebar__item--active': selected?.id === municipio.id
                        })}
                        onClick={() => handleSelectMunicipio(municipio.id)}
                      >
                        {municipio.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      }
    >
      <div className="map-section">
        <div className="map-card">
          {modo === 'reto' ? (
            <div className="quiz-hud">
              {preguntas.length === 0 ? (
                <div className="quiz-hud__empty">
                  <p>Selecciona uno de los modos de reto para comenzar.</p>
                </div>
              ) : (
                <div className="quiz-hud__status">
                  <div className="quiz-hud__question">
                    {quizFinalizado ? (
                      <span>
                        ¡Reto completado! Aciertos {aciertos} de {preguntas.length}
                      </span>
                    ) : (
                      <span>
                        ¿Dónde está <strong>{activeQuestion?.nombre}</strong>?
                      </span>
                    )}
                  </div>
                  <div className="quiz-hud__metrics">
                    <span>Aciertos {aciertos}</span>
                    <span>Fallos {fallos}</span>
                    <span>Restantes {remaining}</span>
                  </div>
                  <div className="quiz-hud__actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={resetQuiz}
                    >
                      Resetear reto
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          <MapCanvas
            features={clmMunicipioFeatures}
            highlightMunicipioId={selected?.id}
            colorMode={colorMode}
            modo={modo}
            infoById={clmMunicipiosById}
            selectedProvinces={selectedProvinces}
            statuses={mapaEstados}
            onSelect={handleSelectMunicipio}
          />
        </div>
        <MunicipioInfoPanel municipio={selected} />
      </div>
      </AppShell>
    </>
  )
}

export default App
