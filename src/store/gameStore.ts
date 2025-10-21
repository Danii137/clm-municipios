import { create } from 'zustand'
import type {
  ComunidadId,
  MunicipioId,
  MunicipioInfo,
  NivelDificultad,
  ProvinciaId,
  RespuestaEstado
} from '../types/municipio'
import {
  comunidades as comunidadSummaries,
  provincias as provinciaSummaries,
  provinceById,
  provincesByCommunity,
  spanishMunicipiosById,
  spanishMunicipiosInfo
} from '../data/spainDivisions'

export type GameMode = 'estudio' | 'reto'

export type ColorMode =
  | 'colorido'
  | 'por-provincia'
  | 'por-comunidad'
  | 'poblacion'
  | 'altitud'

type QuizQuestion = {
  id: string
  municipioId: MunicipioId
  nombre: string
  estado: RespuestaEstado
  respuesta?: MunicipioId
}

type MapStatus = Record<MunicipioId, RespuestaEstado>

export type CelebrationState = {
  municipioId: MunicipioId
  key: number
}

export type DifficultyLevel = 'facil' | 'dificil'

const comunidadCastillaLaMancha = comunidadSummaries.find(
  (comunidad) => comunidad.nombre.toLowerCase() === 'castilla-la mancha'
)

const DEFAULT_COMMUNITY_ID =
  comunidadCastillaLaMancha?.id ?? comunidadSummaries[0]?.id ?? 'castilla-la-mancha'

const defaultProvinceSelection = provincesByCommunity.get(DEFAULT_COMMUNITY_ID) ?? [
  provinciaSummaries[0]?.id
].filter(Boolean) as ProvinciaId[]

const unique = <T,>(values: T[]) => Array.from(new Set(values))

type GameState = {
  modo: GameMode
  colorMode: ColorMode
  dificultad: NivelDificultad
  dificultadReto: DifficultyLevel
  soundEnabled: boolean
  selectedCommunities: ComunidadId[]
  selectedProvinces: ProvinciaId[]
  preguntas: QuizQuestion[]
  activeIndex: number
  aciertos: number
  fallos: number
  completado: boolean
  mapaEstados: MapStatus
  correctBlinkId?: MunicipioId
  celebration?: CelebrationState
  lockedMunicipios?: Set<MunicipioId>
  startQuiz: (params: { dificultad: NivelDificultad; municipios: MunicipioInfo[] }) => void
  marcarMunicipio: (municipioId: MunicipioId) => void
  resetQuiz: () => void
  setModo: (modo: GameMode) => void
  setColorMode: (mode: ColorMode) => void
  setDificultadReto: (dificultad: DifficultyLevel) => void
  toggleSound: () => void
  setSelectedCommunities: (communities: ComunidadId[]) => void
  toggleCommunity: (communityId: ComunidadId) => void
  toggleProvince: (provinciaId: ProvinciaId) => void
  setSelectedProvinces: (provincias: ProvinciaId[]) => void
  clearCelebration: () => void
}

const shuffle = <T,>(array: T[]): T[] => {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const createInitialQuizState = (): Pick<
  GameState,
  | 'dificultad'
  | 'preguntas'
  | 'activeIndex'
  | 'aciertos'
  | 'fallos'
  | 'completado'
  | 'mapaEstados'
  | 'correctBlinkId'
  | 'celebration'
  | 'lockedMunicipios'
> => ({
  dificultad: 'estudio',
  preguntas: [],
  activeIndex: -1,
  aciertos: 0,
  fallos: 0,
  completado: false,
  mapaEstados: {},
  correctBlinkId: undefined,
  celebration: undefined,
  lockedMunicipios: undefined
})

const ensureCommunitiesFromProvinces = (provinces: ProvinciaId[]): ComunidadId[] => {
  const communitiesFromProvinces = provinces
    .map((provinciaId) => provinceById.get(provinciaId)?.comunidadId)
    .filter((value): value is ComunidadId => Boolean(value))

  return unique(communitiesFromProvinces.length ? communitiesFromProvinces : [DEFAULT_COMMUNITY_ID])
}

export const useGameStore = create<GameState>((set, get) => ({
  modo: 'estudio',
  colorMode: 'por-provincia',
  dificultadReto: 'dificil',
  soundEnabled: true,
  selectedCommunities: [DEFAULT_COMMUNITY_ID],
  selectedProvinces: defaultProvinceSelection.length ? defaultProvinceSelection : [],
  ...createInitialQuizState(),
  startQuiz: ({ dificultad, municipios }) => {
    if (!municipios.length) return
    const { dificultadReto } = get()

    const pool = shuffle(municipios)
    const limit =
      dificultad === 'reto-10'
        ? Math.min(10, pool.length)
        : dificultad === 'reto-provincia'
          ? pool.length
          : pool.length

    const selected = pool.slice(0, limit)
    const preguntas: QuizQuestion[] = selected.map((municipio) => ({
      id: `q-${municipio.id}`,
      municipioId: municipio.id,
      nombre: municipio.nombre,
      estado: 'pendiente'
    }))

    set({
      modo: 'reto',
      dificultad,
      preguntas,
      activeIndex: preguntas.length ? 0 : -1,
      aciertos: 0,
      fallos: 0,
      completado: preguntas.length === 0,
      mapaEstados: {},
      correctBlinkId: undefined,
      celebration: undefined,
      lockedMunicipios: dificultadReto === 'facil' ? new Set<MunicipioId>() : undefined
    })
  },
  marcarMunicipio: (municipioId) => {
    const {
      preguntas,
      activeIndex,
      completado,
      mapaEstados,
      aciertos,
      fallos,
      dificultadReto,
      lockedMunicipios
    } = get()
    if (preguntas.length === 0 || activeIndex < 0 || completado) return
    const pregunta = preguntas[activeIndex]
    if (pregunta.estado !== 'pendiente') return

    const updatedPreguntas = [...preguntas]
    const updatedMapa: MapStatus = { ...mapaEstados }
    let nuevosAciertos = aciertos
    let nuevosFallos = fallos
    let correctBlinkId: MunicipioId | undefined
    let celebration: CelebrationState | undefined

    let estado: RespuestaEstado
    if (municipioId === pregunta.municipioId) {
      estado = 'correcta'
      updatedMapa[pregunta.municipioId] = 'correcta'
      nuevosAciertos += 1
      correctBlinkId = undefined
      celebration = {
        municipioId: pregunta.municipioId,
        key: Date.now()
      }
    } else {
      estado = 'fallida'
      updatedMapa[municipioId] = 'fallida'
      updatedMapa[pregunta.municipioId] = 'correcta'
      nuevosFallos += 1
      correctBlinkId = pregunta.municipioId
      celebration = undefined
    }

    updatedPreguntas[activeIndex] = {
      ...pregunta,
      estado,
      respuesta: municipioId
    }

    const nextIndex = updatedPreguntas.findIndex(
      (q, idx) => idx > activeIndex && q.estado === 'pendiente'
    )
    const newCompleted = nextIndex === -1

    let updatedLocked = lockedMunicipios ?? new Set<MunicipioId>()
    if (dificultadReto === 'facil') {
      updatedLocked = new Set<MunicipioId>(updatedLocked)
      updatedLocked.add(pregunta.municipioId)
      if (estado === 'fallida') {
        updatedLocked.add(municipioId)
      }
    }

    set({
      preguntas: updatedPreguntas,
      activeIndex: newCompleted ? -1 : nextIndex,
      aciertos: nuevosAciertos,
      fallos: nuevosFallos,
      completado: newCompleted,
      mapaEstados: updatedMapa,
      correctBlinkId,
      celebration,
      lockedMunicipios: dificultadReto === 'facil' ? updatedLocked : undefined
    })
  },
  resetQuiz: () => set((state) => ({ ...state, ...createInitialQuizState() })),
  setModo: (modo) => {
    if (modo === 'estudio') {
      set((state) => ({
        ...state,
        modo,
        ...createInitialQuizState()
      }))
    } else {
      set({ modo })
    }
  },
  setColorMode: (mode) => set({ colorMode: mode }),
  setDificultadReto: (dificultad) =>
    set((state) => ({
      dificultadReto: dificultad,
      lockedMunicipios:
        dificultad === 'facil'
          ? new Set(
              state.preguntas
                .filter((pregunta) => pregunta.estado !== 'pendiente')
                .map((pregunta) => pregunta.municipioId)
            )
          : undefined
    })),
  toggleSound: () => set((state) => ({ soundEnabled: !state.soundEnabled })),
  setSelectedCommunities: (communities) => {
    const validCommunities = communities.length ? communities : [DEFAULT_COMMUNITY_ID]
    const newProvinces = unique(
      validCommunities.flatMap(
        (comunidadId) => provincesByCommunity.get(comunidadId) ?? []
      )
    )
    set({
      selectedCommunities: validCommunities,
      selectedProvinces: newProvinces.length ? newProvinces : defaultProvinceSelection
    })
  },
  toggleCommunity: (communityId) => {
    const { selectedCommunities, selectedProvinces } = get()
    const currentCommunities = new Set(selectedCommunities)

    if (currentCommunities.has(communityId)) {
      if (currentCommunities.size === 1) return
      currentCommunities.delete(communityId)
      const remainingCommunities = Array.from(currentCommunities)
      const provincesToRemove = provincesByCommunity.get(communityId) ?? []
      const filteredProvinces = selectedProvinces.filter(
        (provinciaId) => !provincesToRemove.includes(provinciaId)
      )

      set({
        selectedCommunities: remainingCommunities,
        selectedProvinces:
          filteredProvinces.length > 0
            ? filteredProvinces
            : provincesByCommunity.get(remainingCommunities[0]) ?? filteredProvinces
      })
      return
    }

    const provincesToAdd = provincesByCommunity.get(communityId) ?? []
    set({
      selectedCommunities: [...selectedCommunities, communityId],
      selectedProvinces: unique([...selectedProvinces, ...provincesToAdd])
    })
  },
  toggleProvince: (provinciaId) => {
    const { selectedProvinces, selectedCommunities } = get()
    const province = provinceById.get(provinciaId)
    if (!province) return

    const isSelected = selectedProvinces.includes(provinciaId)
    if (isSelected) {
      if (selectedProvinces.length === 1) return
      const updatedProvinces = selectedProvinces.filter((id) => id !== provinciaId)

      const provincesOfCommunity = provincesByCommunity.get(province.comunidadId) ?? []
      const stillHasProvince = updatedProvinces.some((id) => provincesOfCommunity.includes(id))
      const updatedCommunities = stillHasProvince
        ? selectedCommunities
        : selectedCommunities.filter((id) => id !== province.comunidadId)

      set({
        selectedProvinces: updatedProvinces,
        selectedCommunities: updatedCommunities.length
          ? updatedCommunities
          : ensureCommunitiesFromProvinces(updatedProvinces)
      })
      return
    }

    const updatedProvinces = unique([...selectedProvinces, provinciaId])
    const updatedCommunities = selectedCommunities.includes(province.comunidadId)
      ? selectedCommunities
      : [...selectedCommunities, province.comunidadId]

    set({
      selectedProvinces: updatedProvinces,
      selectedCommunities: updatedCommunities
    })
  },
  setSelectedProvinces: (provincias) => {
    if (!provincias.length) return
    set({
      selectedProvinces: unique(provincias),
      selectedCommunities: ensureCommunitiesFromProvinces(provincias)
    })
  },
  clearCelebration: () => set({ celebration: undefined })
}))

export const municipiosInfo = spanishMunicipiosInfo
export const municipiosById = spanishMunicipiosById
