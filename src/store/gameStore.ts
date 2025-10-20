import { create } from 'zustand'
import type {
  MunicipioId,
  MunicipioInfo,
  NivelDificultad,
  ProvinciaId,
  RespuestaEstado
} from '../types/municipio'

export type GameMode = 'estudio' | 'reto'

export type ColorMode = 'uniforme' | 'por-provincia'

type QuizQuestion = {
  id: string
  municipioId: MunicipioId
  nombre: string
  estado: RespuestaEstado
  respuesta?: MunicipioId
}

type MapStatus = Record<MunicipioId, RespuestaEstado>

const ALL_PROVINCES: ProvinciaId[] = [
  'albacete',
  'ciudad-real',
  'cuenca',
  'guadalajara',
  'toledo'
]

export const PROVINCES: readonly ProvinciaId[] = Object.freeze([...ALL_PROVINCES])

type GameState = {
  modo: GameMode
  colorMode: ColorMode
  dificultad: NivelDificultad
  selectedProvinces: ProvinciaId[]
  preguntas: QuizQuestion[]
  activeIndex: number
  aciertos: number
  fallos: number
  completado: boolean
  mapaEstados: MapStatus
  startQuiz: (params: { dificultad: NivelDificultad; municipios: MunicipioInfo[] }) => void
  marcarMunicipio: (municipioId: MunicipioId) => void
  resetQuiz: () => void
  setModo: (modo: GameMode) => void
  setColorMode: (mode: ColorMode) => void
  setSelectedProvinces: (provincias: ProvinciaId[]) => void
}

const shuffle = <T,>(array: T[]): T[] => {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

const initialState: Pick<
  GameState,
  'dificultad' | 'preguntas' | 'activeIndex' | 'aciertos' | 'fallos' | 'completado' | 'mapaEstados'
> = {
  dificultad: 'estudio',
  preguntas: [],
  activeIndex: -1,
  aciertos: 0,
  fallos: 0,
  completado: false,
  mapaEstados: {}
}

export const useGameStore = create<GameState>((set, get) => ({
  modo: 'estudio',
  colorMode: 'por-provincia',
  selectedProvinces: ALL_PROVINCES,
  ...initialState,
  startQuiz: ({ dificultad, municipios }) => {
    if (!municipios.length) return

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
      mapaEstados: {}
    })
  },
  marcarMunicipio: (municipioId) => {
    const { preguntas, activeIndex, completado, mapaEstados, aciertos, fallos } = get()
    if (preguntas.length === 0 || activeIndex < 0 || completado) return
    const pregunta = preguntas[activeIndex]
    if (pregunta.estado !== 'pendiente') return

    const updatedPreguntas = [...preguntas]
    const updatedMapa: MapStatus = { ...mapaEstados }
    let nuevosAciertos = aciertos
    let nuevosFallos = fallos

    let estado: RespuestaEstado
    if (municipioId === pregunta.municipioId) {
      estado = 'correcta'
      updatedMapa[pregunta.municipioId] = 'correcta'
      nuevosAciertos += 1
    } else {
      estado = 'fallida'
      updatedMapa[municipioId] = 'fallida'
      updatedMapa[pregunta.municipioId] = 'correcta'
      nuevosFallos += 1
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

    set({
      preguntas: updatedPreguntas,
      activeIndex: newCompleted ? -1 : nextIndex,
      aciertos: nuevosAciertos,
      fallos: nuevosFallos,
      completado: newCompleted,
      mapaEstados: updatedMapa
    })
  },
  resetQuiz: () => set(initialState),
  setModo: (modo) => {
    if (modo === 'estudio') {
      set({ modo, ...initialState })
    } else {
      set({ modo })
    }
  },
  setColorMode: (mode) => set({ colorMode: mode }),
  setSelectedProvinces: (provincias) => {
    if (!provincias.length) return
    set({ selectedProvinces: provincias })
  }
}))
