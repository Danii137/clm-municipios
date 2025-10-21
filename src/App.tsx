import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { AppShell } from './components/layout/AppShell'
import { MapCanvas } from './components/map/MapCanvas'
import { MunicipioInfoPanel } from './components/map/MunicipioInfoPanel'
import {
  comunidades as comunidadSummaries,
  provincias as provinciaSummaries,
  spanishMunicipioFeatures,
  spanishMunicipiosById,
  spanishMunicipiosInfo
} from './data/spainDivisions'
import { useGameStore, type ColorMode, type CelebrationState } from './store/gameStore'
import { useShallow } from 'zustand/react/shallow'
import type { ComunidadId, MunicipioInfo } from './types/municipio'
import './App.css'
import introLogo from './data/daniel-alonso-gomez.png'

const formatNumber = (value: number) => value.toLocaleString('es-ES')

const CELEBRATION_CLEAR_DELAY = 1400
const SUCCESS_SOUND_DURATION = 0.8
const SUCCESS_SOUND_PEAK_GAIN = 0.28
const SUCCESS_SOUND_START_FREQ = 523.25
const SUCCESS_SOUND_END_FREQ = 783.99

const getAudioContextConstructor = () => {
  if (typeof window === 'undefined') return undefined
  return (
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  )
}

function App() {
  const [selected, setSelected] = useState<MunicipioInfo | undefined>()
  const [showSplash, setShowSplash] = useState(true)

  const {
    modo,
    setModo,
    colorMode,
    setColorMode,
    selectedCommunities,
    selectedProvinces,
    toggleCommunity: toggleCommunitySelection,
    toggleProvince: toggleProvinceSelection,
    startQuiz,
    marcarMunicipio,
    resetQuiz,
    preguntas,
    activeIndex,
    aciertos,
    fallos,
    completado,
    mapaEstados,
    correctBlinkId,
    celebration,
    clearCelebration
  } = useGameStore(
    useShallow((state) => ({
      modo: state.modo,
      setModo: state.setModo,
      colorMode: state.colorMode,
      setColorMode: state.setColorMode,
      selectedCommunities: state.selectedCommunities,
      selectedProvinces: state.selectedProvinces,
      toggleCommunity: state.toggleCommunity,
      toggleProvince: state.toggleProvince,
      startQuiz: state.startQuiz,
      marcarMunicipio: state.marcarMunicipio,
      resetQuiz: state.resetQuiz,
      preguntas: state.preguntas,
      activeIndex: state.activeIndex,
      aciertos: state.aciertos,
      fallos: state.fallos,
      completado: state.completado,
      mapaEstados: state.mapaEstados,
      correctBlinkId: state.correctBlinkId,
      celebration: state.celebration,
      clearCelebration: state.clearCelebration
    }))
  )

  const activeQuestion = activeIndex >= 0 ? preguntas[activeIndex] : undefined

  const selectedCommunitiesSet = useMemo(
    () => new Set<ComunidadId>(selectedCommunities),
    [selectedCommunities]
  )

  const activeProvinces = useMemo(
    () =>
      provinciaSummaries.filter((provincia) =>
        selectedCommunitiesSet.has(provincia.comunidadId)
      ),
    [selectedCommunitiesSet]
  )

  const availableMunicipios = useMemo(() => {
    if (!selectedProvinces.length) {
      return [...spanishMunicipiosInfo].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }
    const provincesSet = new Set(selectedProvinces)
    return spanishMunicipiosInfo
      .filter((municipio) => provincesSet.has(municipio.provincia))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [selectedProvinces])

  const availableMunicipioIds = useMemo(() => new Set(availableMunicipios.map((m) => m.id)), [
    availableMunicipios
  ])

  const visibleFeatures = useMemo(() => {
    if (availableMunicipioIds.size === spanishMunicipiosInfo.length) {
      return spanishMunicipioFeatures
    }
    return spanishMunicipioFeatures.filter((feature) => {
      const featureId = String(feature.id ?? feature.properties?.NATCODE ?? '')
      return featureId && availableMunicipioIds.has(featureId)
    })
  }, [availableMunicipioIds])

  const remaining = preguntas.reduce(
    (acc, pregunta) => (pregunta.estado === 'pendiente' ? acc + 1 : acc),
    0
  )

  const handleSelectMunicipio = (municipioId: string) => {
    const info = spanishMunicipiosById.get(municipioId)
    if (info) setSelected(info)

    if (modo === 'reto') {
      marcarMunicipio(municipioId)
    }
  }

  const startReto = (tipo: 'reto-10' | 'reto-provincia' | 'reto-total') => {
    const pool = tipo === 'reto-total' ? spanishMunicipiosInfo : availableMunicipios
    if (pool.length === 0) return
    setSelected(undefined)
    startQuiz({ dificultad: tipo, municipios: pool })
  }

  const quizFinalizado = modo === 'reto' && preguntas.length > 0 && completado

  useCelebrationCue(celebration, clearCelebration)

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
            <h1>España Municipios Challenge</h1>
            <p>Activa las comunidades y provincias que quieras estudiar o utilizar en el reto.</p>
          </div>
          <div className="header__controls">
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
              <span>Paleta</span>
              <select
                value={colorMode}
                onChange={(event) =>
                  setColorMode(event.target.value as ColorMode)
                }
              >
                <option value="colorido">Colorido</option>
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
              <h2>Comunidades</h2>
              <p>Activa zonas del mapa para practicar.</p>
            </div>
            <div className="chip-grid">
              {comunidadSummaries.map((comunidad) => (
                <button
                  key={comunidad.id}
                  type="button"
                  className={clsx('chip', {
                    'chip--active': selectedCommunities.includes(comunidad.id)
                  })}
                  onClick={() => toggleCommunitySelection(comunidad.id)}
                >
                  {comunidad.nombre}
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <h2>Provincias</h2>
              <p>Selecciona sobre qué provincias quieres practicar.</p>
            </div>
            <div className="chip-grid">
              {(activeProvinces.length ? activeProvinces : provinciaSummaries).map((provincia) => (
                <button
                  key={provincia.id}
                  type="button"
                  className={clsx('chip', {
                    'chip--active': selectedProvinces.includes(provincia.id)
                  })}
                  onClick={() => toggleProvinceSelection(provincia.id)}
                >
                  {provincia.nombre}
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
            features={visibleFeatures}
            highlightMunicipioId={selected?.id}
            colorMode={colorMode}
            modo={modo}
            infoById={spanishMunicipiosById}
            selectedProvinces={selectedProvinces}
            statuses={mapaEstados}
            correctBlinkId={correctBlinkId}
            celebration={celebration}
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

function useCelebrationCue(
  celebration: CelebrationState | undefined,
  onClear: () => void
) {
  const audioContextRef = useRef<AudioContext | null>(null)

  const playSuccessSound = useCallback(async () => {
    const AudioContextCtor = getAudioContextConstructor()
    if (!AudioContextCtor) return

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor()
    }

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return
      }
    }

    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'triangle'
    oscillator.frequency.setValueAtTime(SUCCESS_SOUND_START_FREQ, now)
    oscillator.frequency.exponentialRampToValueAtTime(SUCCESS_SOUND_END_FREQ, now + 0.35)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(SUCCESS_SOUND_PEAK_GAIN, now + 0.04)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + SUCCESS_SOUND_DURATION)

    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(now)
    oscillator.stop(now + SUCCESS_SOUND_DURATION)
  }, [])

  useEffect(() => {
    if (!celebration) return

    const timeoutId = setTimeout(() => {
      onClear()
    }, CELEBRATION_CLEAR_DELAY)

    void playSuccessSound()

    return () => {
      clearTimeout(timeoutId)
    }
  }, [celebration, onClear, playSuccessSound])
}
