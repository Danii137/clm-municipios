import { create } from 'zustand'
import type {
  NivelDificultad,
  Pregunta,
  MunicipioId,
  RespuestaEstado
} from '../types/municipio'

export type GameMode = 'estudio' | 'preguntas'

export type ColorMode = 'uniforme' | 'por-provincia'

type GameState = {
  modo: GameMode
  dificultad: NivelDificultad
  colorMode: ColorMode
  preguntas: Pregunta[]
  activa?: Pregunta
  startQuiz: (dificultad: NivelDificultad) => void
  marcarMunicipio: (municipioId: MunicipioId) => void
  setModo: (modo: GameMode) => void
  setColorMode: (mode: ColorMode) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  modo: 'estudio',
  dificultad: 'estudio',
  colorMode: 'uniforme',
  preguntas: [],
  activa: undefined,
  startQuiz: (dificultad) => {
    const generated: Pregunta[] = []
    // TODO: generar preguntas reales cuando tengamos los datos
    set({
      modo: 'preguntas',
      dificultad,
      preguntas: generated,
      activa: generated[0]
    })
  },
  marcarMunicipio: (municipioId) => {
    const { activa, preguntas } = get()
    if (!activa) return
    const updated = preguntas.map((pregunta) => {
      if (pregunta.id !== activa.id) return pregunta
      const estado: RespuestaEstado =
        pregunta.municipioId === municipioId ? 'correcta' : 'fallida'
      return { ...pregunta, estado, respuesta: municipioId }
    })

    const siguiente = updated.find((p) => p.estado === 'pendiente')

    set({ preguntas: updated, activa: siguiente })
  },
  setModo: (modo) => set({ modo }),
  setColorMode: (mode) => set({ colorMode: mode })
}))
