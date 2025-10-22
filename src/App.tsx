import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
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
import { useGameStore, type ColorMode, type CelebrationState, type GameMode } from './store/gameStore'
import { useShallow } from 'zustand/react/shallow'
import type { ComunidadId, MunicipioId, MunicipioInfo } from './types/municipio'
import './App.css'
import introLogo from './data/daniel-alonso-gomez.png'

const formatNumber = (value: number) => value.toLocaleString('es-ES')

const CELEBRATION_CLEAR_DELAY = 1400
// Tiempo límite por pregunta (segundos)
const TIME_LIMIT = 20
const SUCCESS_SOUND_DURATION = 0.8
const SUCCESS_SOUND_PEAK_GAIN = 0.28
const SUCCESS_SOUND_START_FREQ = 523.25
const SUCCESS_SOUND_END_FREQ = 783.99

type ExpandableSection = 'communities' | 'provinces' | 'details'

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
  const [paused, setPaused] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<ExpandableSection, boolean>>({
    communities: true,
    provinces: true,
    details: true
  })
  const [floatingLabel, setFloatingLabel] = useState<string | undefined>()
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT)
  const [showMunicipioLabels, setShowMunicipioLabels] = useState(false)
  const [showRetoModal, setShowRetoModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false)
  const [focusedQuizMunicipios, setFocusedQuizMunicipios] = useState<Set<MunicipioId> | null>(null)
  const timerRef = useRef<number | null>(null)
  const prevQuestionRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  const ensureAudioContext = useCallback(async (): Promise<AudioContext | null> => {
    const AudioContextCtor = getAudioContextConstructor()
    if (!AudioContextCtor) return null

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor()
    }

    const ctx = audioContextRef.current
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        return null
      }
    }

    return ctx
  }, [])

  const playSuccessSound = useCallback(async () => {
    const ctx = await ensureAudioContext()
    if (!ctx) return

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
  }, [ensureAudioContext])

  const playFailureSound = useCallback(async () => {
    const ctx = await ensureAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()

    oscillator.type = 'sawtooth'
    oscillator.frequency.setValueAtTime(660, now)
    oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.25)

    gain.gain.setValueAtTime(0.25, now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5)

    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.5)
  }, [ensureAudioContext])

  const toggleSection = (section: ExpandableSection) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const {
    modo,
    setModo,
    colorMode,
    setColorMode,
    dificultadReto,
    setDificultadReto,
    soundEnabled,
    toggleSound,
    theme,
    toggleTheme,
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
    clearCelebration,
    lockedMunicipios,
    registrarTiempoAgotado
  } = useGameStore(
    useShallow((state) => ({
      modo: state.modo,
      setModo: state.setModo,
      colorMode: state.colorMode,
      setColorMode: state.setColorMode,
      dificultadReto: state.dificultadReto,
      setDificultadReto: state.setDificultadReto,
      soundEnabled: state.soundEnabled,
      toggleSound: state.toggleSound,
      theme: state.theme,
      toggleTheme: state.toggleTheme,
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
      clearCelebration: state.clearCelebration,
      lockedMunicipios: state.lockedMunicipios,
      registrarTiempoAgotado: state.registrarTiempoAgotado
    }))
  )

  const activeQuestion = activeIndex >= 0 ? preguntas[activeIndex] : undefined
  const totalPreguntas = preguntas.length
  const respondidas = aciertos + fallos

  const prevModoRef = useRef(modo)
  const prevTotalPreguntasRef = useRef(totalPreguntas)

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

  const computeMostPopulatedMunicipios = useCallback(
    (count: number): MunicipioInfo[] => {
      if (availableMunicipios.length === 0) return []

      const withPopulation = availableMunicipios.filter((municipio) =>
        typeof municipio.poblacion === 'number' && Number.isFinite(municipio.poblacion)
      )

      const sortedByPopulation = withPopulation.sort((a, b) => {
        const popA = a.poblacion ?? 0
        const popB = b.poblacion ?? 0
        if (popA === popB) {
          return a.nombre.localeCompare(b.nombre, 'es')
        }
        return popB - popA
      })

      const selected: MunicipioInfo[] = sortedByPopulation.slice(0, count)
      if (selected.length >= count) {
        return selected
      }

      const usedIds = new Set(selected.map((municipio) => municipio.id))
      for (const municipio of availableMunicipios) {
        if (selected.length >= count) break
        if (!usedIds.has(municipio.id)) {
          selected.push(municipio)
          usedIds.add(municipio.id)
        }
      }

      return selected
    },
    [availableMunicipios]
  )

  // Número de preguntas restantes podría calcularse si se necesita en el futuro
  const progresoResueltas = totalPreguntas > 0 ? Math.round((respondidas / totalPreguntas) * 100) : 0
  const progresoAciertos = totalPreguntas > 0 ? Math.round((aciertos / totalPreguntas) * 100) : 0
  const timerPercent =
    modo === 'reto' && activeQuestion
      ? Math.max(0, Math.min((timeLeft / TIME_LIMIT) * 100, 100))
      : 0

  useEffect(() => {
    const prevModo = prevModoRef.current
    const prevTotal = prevTotalPreguntasRef.current

    if (
      modo === 'reto' &&
      (prevModo !== 'reto' || (prevTotal > 0 && totalPreguntas === 0))
    ) {
      setShowRetoModal(true)
    }

    if (prevModo === 'reto' && modo !== 'reto') {
      setShowRetoModal(false)
    }

    prevModoRef.current = modo
    prevTotalPreguntasRef.current = totalPreguntas
  }, [modo, totalPreguntas])

  const handleSelectMunicipio = (municipioId: string) => {
    if (modo === 'reto' && paused) return
    if (modo === 'reto' && dificultadReto === 'facil' && lockedMunicipios?.has(municipioId)) {
      return
    }
    const info = spanishMunicipiosById.get(municipioId)
    if (info) setSelected(info)
    if (info) {
      setFloatingLabel(info.nombre)
      setTimeout(() => {
        setFloatingLabel((current) => (current === info.nombre ? undefined : current))
      }, 2000)
    }

    if (modo === 'reto') {
      marcarMunicipio(municipioId)
    }
  }

  const startReto = (tipo: 'reto-10' | 'reto-provincia' | 'reto-total') => {
    const pool = tipo === 'reto-total' ? spanishMunicipiosInfo : availableMunicipios
    if (pool.length === 0) return
    setSelected(undefined)
    setPaused(false)
    setShowRetoModal(false)
    setFocusedQuizMunicipios(null)
    startQuiz({ dificultad: tipo, municipios: pool })
  }

  const startPopulatedReto = (count: 10 | 50 | 100) => {
    const populous = computeMostPopulatedMunicipios(count)
    if (populous.length === 0) return
    setSelected(undefined)
    setPaused(false)
    setShowRetoModal(false)
    setFocusedQuizMunicipios(new Set(populous.map((municipio) => municipio.id)))
    startQuiz({ dificultad: 'reto-provincia', municipios: populous })
  }

  const handleResetQuiz = useCallback(() => {
    resetQuiz()
    setFocusedQuizMunicipios(null)
  }, [resetQuiz])

  const handleModoChange = (nextMode: GameMode) => {
    if (nextMode === modo) return
    if (nextMode === 'estudio') {
      handleResetQuiz()
    } else {
      setFocusedQuizMunicipios(null)
    }
    setModo(nextMode)
  }

  const quizFinalizado = modo === 'reto' && preguntas.length > 0 && completado

useCelebrationCue(celebration, clearCelebration, soundEnabled, playSuccessSound)

const prevFallosRef = useRef(fallos)

useEffect(() => {
  if (soundEnabled && fallos > prevFallosRef.current) {
    void playFailureSound()
  }
  prevFallosRef.current = fallos
}, [fallos, soundEnabled, playFailureSound])

useEffect(() => {
  const body = document.body
  body.classList.remove('theme-dark', 'theme-light')
  body.classList.add(theme === 'oscuro' ? 'theme-dark' : 'theme-light')
}, [theme])

useEffect(() => {
  if (typeof window === 'undefined') return
  const updateIsMobile = () => {
    setIsMobile(window.innerWidth < 768)
  }
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  return () => {
    window.removeEventListener('resize', updateIsMobile)
  }
}, [])

useEffect(() => {
  if (!isMobile && mobileControlsOpen) {
    setMobileControlsOpen(false)
  }
}, [isMobile, mobileControlsOpen])

useEffect(() => {
  if (mobileControlsOpen) {
    setMobileControlsOpen(false)
  }
}, [modo, mobileControlsOpen])

useEffect(() => {
  if (preguntas.length === 0 && focusedQuizMunicipios) {
    setFocusedQuizMunicipios(null)
  }
}, [preguntas.length, focusedQuizMunicipios])


useEffect(() => {
  if (modo !== 'reto' || activeIndex < 0 || !activeQuestion || totalPreguntas === 0) {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setTimeLeft(TIME_LIMIT)
    return
  }

  if (paused) {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    return
  }

  if (timerRef.current) {
    window.clearInterval(timerRef.current)
  }
  // Si la pregunta cambió, reinicia el tiempo; si venimos de una pausa, conserva el valor
  const currentKey = String(activeQuestion.municipioId ?? activeIndex)
  if (prevQuestionRef.current !== currentKey) {
    setTimeLeft(TIME_LIMIT)
    prevQuestionRef.current = currentKey
  }

  timerRef.current = window.setInterval(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        if (timerRef.current) {
          window.clearInterval(timerRef.current)
          timerRef.current = null
        }
        registrarTiempoAgotado()
        return TIME_LIMIT
      }
      return prev - 1
    })
  }, 1000)

  return () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }
}, [modo, activeIndex, activeQuestion, registrarTiempoAgotado, totalPreguntas, paused])

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
      {showRetoModal ? (
        <div className="reto-modal-overlay" onClick={() => setShowRetoModal(false)}>
          <div
            className="reto-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reto-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="reto-modal-title" className="reto-modal__title">
              Elige tu reto
            </h2>
            <p className="reto-modal__subtitle">
              Selecciona la dificultad y el conjunto de municipios con los que quieres practicar.
            </p>
            <div className="difficulty-switch">
              <span className="difficulty-switch__label">Dificultad</span>
              <div className="difficulty-switch__buttons">
                <button
                  type="button"
                  className={clsx('difficulty-switch__btn', {
                    'difficulty-switch__btn--active': dificultadReto === 'facil'
                  })}
                  onClick={() => setDificultadReto('facil')}
                >
                  Fácil
                </button>
                <button
                  type="button"
                  className={clsx('difficulty-switch__btn', {
                    'difficulty-switch__btn--active': dificultadReto === 'dificil'
                  })}
                  onClick={() => setDificultadReto('dificil')}
                >
                  Difícil
                </button>
              </div>
            </div>
            <div className="reto-modal__actions">
              <button type="button" className="ghost-button" onClick={() => startReto('reto-10')}>
                10 aleatorias
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => startReto('reto-provincia')}
              >
                Provincias seleccionadas
              </button>
              <button type="button" className="ghost-button" onClick={() => startReto('reto-total')}>
                Completar mapa
              </button>
            </div>
            <div className="reto-modal__group">
              <span className="reto-modal__group-title">Más poblados de tus provincias</span>
              <div className="reto-modal__group-buttons">
                <button
                  type="button"
                  className="ghost-button ghost-button--dense"
                  onClick={() => startPopulatedReto(10)}
                >
                  10 más poblados
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--dense"
                  onClick={() => startPopulatedReto(50)}
                >
                  50 más poblados
                </button>
                <button
                  type="button"
                  className="ghost-button ghost-button--dense"
                  onClick={() => startPopulatedReto(100)}
                >
                  100 más poblados
                </button>
              </div>
            </div>
            <div className="reto-modal__footer">
              <button type="button" className="ghost-button" onClick={() => setShowRetoModal(false)}>
                Cerrar
              </button>
            </div>
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
          {!isMobile ? (
            <div className="header__controls">
              <div className="mode-switch">
                <button
                  type="button"
                  className={clsx('mode-switch__btn', {
                    'mode-switch__btn--active': modo === 'estudio'
                  })}
                  onClick={() => handleModoChange('estudio')}
                >
                  Estudiar
                </button>
                <button
                  type="button"
                  className={clsx('mode-switch__btn', {
                    'mode-switch__btn--active': modo === 'reto'
                  })}
                  onClick={() => handleModoChange('reto')}
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
                <option value="por-comunidad">Por comunidad</option>
                <option value="poblacion">Pulso de población</option>
                <option value="altitud">Relieve</option>
                <option value="carreteras">Mapa carreteras</option>
              </select>
            </label>
              {modo === 'estudio' ? (
                <button
                  type="button"
                  className={clsx('ghost-button', 'header__labels-toggle', {
                    'ghost-button--active': showMunicipioLabels
                  })}
                  onClick={() => setShowMunicipioLabels((value) => !value)}
                >
                  {showMunicipioLabels ? 'Ocultar nombres' : 'Mostrar nombres'}
                </button>
              ) : null}
              <button
                type="button"
                className="theme-toggle-btn"
                onClick={toggleTheme}
                aria-label={theme === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
              >
                {theme === 'oscuro' ? '☀️' : '🌙'}
              </button>
            </div>
          ) : null}
        </div>
      }
      sidebar={
        <div className="sidebar">
          <section className="panel">
            <div className="panel__header">
              <div className="panel__header-text">
                <h2>Comunidades</h2>
                <p>Activa zonas del mapa para practicar.</p>
              </div>
              <button
                type="button"
                className="panel__toggle-button"
                aria-expanded={expandedSections.communities}
                onClick={() => toggleSection('communities')}
              >
                <span
                  className={clsx('panel__chevron', {
                    'panel__chevron--collapsed': !expandedSections.communities
                  })}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </div>
            {expandedSections.communities ? (
              <div className="panel__content">
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
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel__header">
              <div className="panel__header-text">
                <h2>Provincias</h2>
                <p>Selecciona sobre qué provincias quieres practicar.</p>
              </div>
              <button
                type="button"
                className="panel__toggle-button"
                aria-expanded={expandedSections.provinces}
                onClick={() => toggleSection('provinces')}
              >
                <span
                  className={clsx('panel__chevron', {
                    'panel__chevron--collapsed': !expandedSections.provinces
                  })}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </div>
            {expandedSections.provinces ? (
              <div className="panel__content">
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
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel__header">
              <div className="panel__header-text panel__header-text--compact">
                <h2>{modo === 'reto' ? 'Reto' : 'Municipios'}</h2>
                {modo === 'estudio' ? (
                  <span>{formatNumber(availableMunicipios.length)} municipios</span>
                ) : null}
              </div>
              <button
                type="button"
                className="panel__toggle-button"
                aria-expanded={expandedSections.details}
                onClick={() => toggleSection('details')}
              >
                <span
                  className={clsx('panel__chevron', {
                    'panel__chevron--collapsed': !expandedSections.details
                  })}
                  aria-hidden="true"
                >
                  ▾
                </span>
              </button>
            </div>

            {expandedSections.details ? (
              modo === 'reto' ? (
                <div className="panel__content">
                  <div className="difficulty-switch">
                    <span className="difficulty-switch__label">Dificultad</span>
                    <div className="difficulty-switch__buttons">
                      <button
                        type="button"
                        className={clsx('difficulty-switch__btn', {
                          'difficulty-switch__btn--active': dificultadReto === 'facil'
                        })}
                        onClick={() => setDificultadReto('facil')}
                      >
                        Fácil
                      </button>
                      <button
                        type="button"
                        className={clsx('difficulty-switch__btn', {
                          'difficulty-switch__btn--active': dificultadReto === 'dificil'
                        })}
                        onClick={() => setDificultadReto('dificil')}
                      >
                        Difícil
                      </button>
                    </div>
                  </div>
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
                  <div className="panel__actions-group">
                    <span className="panel__actions-group-title">Más poblados de tus provincias</span>
                    <div className="panel__actions-group-buttons">
                      <button
                        type="button"
                        className="ghost-button ghost-button--dense"
                        onClick={() => startPopulatedReto(10)}
                      >
                        10 más poblados
                      </button>
                      <button
                        type="button"
                        className="ghost-button ghost-button--dense"
                        onClick={() => startPopulatedReto(50)}
                      >
                        50 más poblados
                      </button>
                      <button
                        type="button"
                        className="ghost-button ghost-button--dense"
                        onClick={() => startPopulatedReto(100)}
                      >
                        100 más poblados
                      </button>
                    </div>
                  </div>

                  {preguntas.length > 0 ? (
                    <div className="panel__summary">
                      <p>
                        Preguntas: {preguntas.length} · Aciertos: {aciertos} · Fallos: {fallos}
                      </p>
                      {quizFinalizado ? (
                        <button type="button" className="ghost-button" onClick={handleResetQuiz}>
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
              )
            ) : null}
          </section>
        </div>
      }
    >
      <div className="map-section">
        <div
          className={clsx('map-card', {
            'map-card--mobile-full': isMobile,
            'map-card--mobile-game': isMobile && modo === 'reto'
          })}
        >
          {modo === 'reto' ? (
            <div className="quiz-hud">
              {preguntas.length === 0 ? (
                <div className="quiz-hud__empty">
                  <p>Selecciona uno de los modos de reto para comenzar.</p>
                </div>
              ) : (
                <>
                  <div className="quiz-hud__header">
                    <button
                      type="button"
                      className="quiz-hud__icon-btn"
                      aria-label="Mostrar ayuda"
                      onClick={() => toggleSection('details')}
                    >
                      ?
                    </button>
                    <div className="quiz-hud__question-box">
                      <div className="quiz-hud__question-text">
                        {quizFinalizado
                          ? '¡Reto completado!'
                          : `¿Dónde está ${activeQuestion?.nombre ?? ''}?`}
                      </div>
                      {!quizFinalizado ? (
                        <div className="quiz-hud__timer">
                          <div
                            className="quiz-hud__timer-fill"
                            style={{ width: `${timerPercent}%` }}
                          />
                        </div>
                      ) : null}
                      {!quizFinalizado ? (
                        <div className="quiz-hud__timer-info">
                          {paused ? 'Pausado' : `Tiempo restante: ${timeLeft}s`}
                        </div>
                      ) : null}
                    </div>
                    <div className="quiz-hud__actions">
                      <button
                        type="button"
                        className="quiz-hud__icon-btn"
                        aria-label={paused ? 'Reanudar' : 'Pausar'}
                        onClick={() => setPaused((p) => !p)}
                        disabled={preguntas.length === 0 || quizFinalizado}
                        title={paused ? 'Reanudar' : 'Pausar'}
                      >
                        {paused ? '▶' : '⏸'}
                      </button>
                      <button
                        type="button"
                        className={clsx('quiz-hud__icon-btn', {
                          'quiz-hud__icon-btn--muted': !soundEnabled
                        })}
                        aria-label={soundEnabled ? 'Silenciar sonido' : 'Activar sonido'}
                        onClick={toggleSound}
                      >
                        {soundEnabled ? '🔊' : '🔈'}
                      </button>
                      <button
                        type="button"
                        className="quiz-hud__icon-btn"
                        aria-label="Reiniciar reto"
                        onClick={handleResetQuiz}
                      >
                        ⟲
                      </button>
                    </div>
                  </div>
                  <div className="quiz-hud__stats">
                    <div className="quiz-hud__stat">
                      Aciertos: <strong>{aciertos}</strong> ({progresoAciertos}%) · Fallos: {fallos}
                    </div>
                    <div className="quiz-hud__progress">
                      <div className="quiz-hud__progress-bar">
                        <div
                          className="quiz-hud__progress-fill"
                          style={{ width: `${progresoResueltas}%` }}
                        />
                      </div>
                      <span>
                        {respondidas}/{totalPreguntas} ({progresoResueltas}%)
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}

          <MapCanvas
            features={visibleFeatures}
            highlightMunicipioId={selected?.id}
            colorMode={colorMode}
            modo={modo}
            infoById={spanishMunicipiosById}
            selectedCommunities={selectedCommunities}
            selectedProvinces={selectedProvinces}
            statuses={mapaEstados}
            correctBlinkId={correctBlinkId}
            celebration={celebration}
            lockedMunicipios={
              modo === 'reto' && dificultadReto === 'facil' ? lockedMunicipios : undefined
            }
            showLabels={modo === 'estudio' && showMunicipioLabels}
            theme={theme}
            focusedMunicipios={focusedQuizMunicipios}
            onSelect={handleSelectMunicipio}
          />
          {isMobile ? (
            <MobileFloatingControls
              modo={modo}
              onChangeModo={handleModoChange}
              colorMode={colorMode}
              onChangeColorMode={(mode) => setColorMode(mode)}
              showMunicipioLabels={showMunicipioLabels}
              onToggleLabels={() => setShowMunicipioLabels((value) => !value)}
              theme={theme}
              onToggleTheme={toggleTheme}
              open={mobileControlsOpen}
              onToggleOpen={() => setMobileControlsOpen((prev) => !prev)}
              onOpenRetoModal={() => setShowRetoModal(true)}
            />
          ) : null}
          {floatingLabel ? (
            <div className="map-floating-label" key={floatingLabel}>
              {floatingLabel}
            </div>
          ) : null}
          {modo === 'reto' && preguntas.length > 0 ? (
            <div className="quiz-hud__footer">
              <div className="quiz-hud__badge">
                Correctos: <strong>{aciertos}</strong> ({progresoAciertos}%)
              </div>
              <div className="quiz-hud__badge">
                {respondidas}/{totalPreguntas} ({progresoResueltas}%)
              </div>
            </div>
          ) : null}
        </div>
        <MunicipioInfoPanel municipio={selected} />
      </div>
      </AppShell>
    </>
  )
}

export default App

type MobileControlsProps = {
  modo: GameMode
  onChangeModo: (mode: GameMode) => void
  colorMode: ColorMode
  onChangeColorMode: (mode: ColorMode) => void
  showMunicipioLabels: boolean
  onToggleLabels: () => void
  theme: 'oscuro' | 'claro'
  onToggleTheme: () => void
  open: boolean
  onToggleOpen: () => void
  onOpenRetoModal: () => void
}

const MobileFloatingControls = ({
  modo,
  onChangeModo,
  colorMode,
  onChangeColorMode,
  showMunicipioLabels,
  onToggleLabels,
  theme,
  onToggleTheme,
  open,
  onToggleOpen,
  onOpenRetoModal
}: MobileControlsProps) => {
  const closeIfOpen = () => {
    if (open) onToggleOpen()
  }

  const handlePaletteChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onChangeColorMode(event.target.value as ColorMode)
    closeIfOpen()
  }

  return (
    <div className={clsx('mobile-controls', { 'mobile-controls--open': open })}>
      <div className="mobile-controls__panel">
        <div className="mobile-controls__section">
          <span className="mobile-controls__section-label">Modo</span>
          <div className="mode-switch mode-switch--mobile">
            <button
              type="button"
              className={clsx('mode-switch__btn', {
                'mode-switch__btn--active': modo === 'estudio'
              })}
              onClick={() => {
                onChangeModo('estudio')
                closeIfOpen()
              }}
            >
              Estudiar
            </button>
            <button
              type="button"
              className={clsx('mode-switch__btn', {
                'mode-switch__btn--active': modo === 'reto'
              })}
              onClick={() => {
                onChangeModo('reto')
                closeIfOpen()
              }}
            >
              Reto
            </button>
          </div>
        </div>
        <label className="select-control select-control--mobile">
          <span>Paleta</span>
          <select value={colorMode} onChange={handlePaletteChange}>
            <option value="colorido">Colorido</option>
            <option value="por-provincia">Por provincia</option>
            <option value="por-comunidad">Por comunidad</option>
            <option value="poblacion">Pulso de población</option>
            <option value="altitud">Relieve</option>
            <option value="carreteras">Mapa carreteras</option>
          </select>
        </label>
        {modo === 'estudio' ? (
          <button
            type="button"
            className="ghost-button ghost-button--dense"
            onClick={() => {
              onToggleLabels()
              closeIfOpen()
            }}
          >
            {showMunicipioLabels ? 'Ocultar nombres' : 'Mostrar nombres'}
          </button>
        ) : (
          <button
            type="button"
            className="ghost-button ghost-button--dense"
            onClick={() => {
              onOpenRetoModal()
              closeIfOpen()
            }}
          >
            Elegir reto
          </button>
        )}
        <button
          type="button"
          className="ghost-button ghost-button--dense"
          onClick={() => {
            onToggleTheme()
            closeIfOpen()
          }}
        >
          {theme === 'oscuro' ? 'Tema claro ☀️' : 'Tema oscuro 🌙'}
        </button>
      </div>
      <div className="mobile-controls__mini-stack">
        <button
          type="button"
          className="mobile-controls__fab mobile-controls__fab--mini"
          onClick={onToggleTheme}
          aria-label={theme === 'oscuro' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
        >
          {theme === 'oscuro' ? '☀️' : '🌙'}
        </button>
        {modo === 'estudio' ? (
          <button
            type="button"
            className={clsx('mobile-controls__fab', 'mobile-controls__fab--mini', {
              'mobile-controls__fab--active': showMunicipioLabels
            })}
            onClick={onToggleLabels}
            aria-label={showMunicipioLabels ? 'Ocultar nombres de municipios' : 'Mostrar nombres de municipios'}
          >
            {showMunicipioLabels ? '🚫' : '🔤'}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        className="mobile-controls__fab mobile-controls__fab--primary"
        onClick={onToggleOpen}
        aria-expanded={open}
        aria-label={open ? 'Cerrar controles de mapa' : 'Abrir controles de mapa'}
      >
        {open ? '✕' : '☰'}
      </button>
    </div>
  )
}

function useCelebrationCue(
  celebration: CelebrationState | undefined,
  onClear: () => void,
  soundEnabled: boolean,
  playSuccessSound: () => Promise<void>
) {
  useEffect(() => {
    if (!celebration) return

    const timeoutId = setTimeout(() => {
      onClear()
    }, CELEBRATION_CLEAR_DELAY)

    if (soundEnabled) {
      void playSuccessSound()
    }

    return () => {
      clearTimeout(timeoutId)
    }
  }, [celebration, onClear, soundEnabled, playSuccessSound])
}
