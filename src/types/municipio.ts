export type MunicipioId = string

export type ComunidadId = string

export type ProvinciaId = string

export type NivelDificultad = 'estudio' | 'reto-10' | 'reto-total' | 'reto-provincia'

export type Coordenadas = {
  lat: number
  lon: number
}

export type EntidadInfo = {
  id: string
  nombre: string
  tipo: string
  poblacion?: number
  altitud?: number
  coordenadas?: Coordenadas
}

export type MunicipioInfo = {
  id: MunicipioId
  nombre: string
  provincia: ProvinciaId
  comunidad: ComunidadId
  poblacion?: number
  superficieKm2?: number
  densidadHabKm2?: number
  altitud?: number
  gentilicio?: string
  descripcion?: string
  coordenadas?: Coordenadas
  capital?: EntidadInfo
  entidades?: EntidadInfo[]
}

export type RespuestaEstado = 'pendiente' | 'correcta' | 'fallida'

export type Pregunta = {
  id: string
  municipioId: MunicipioId
  enunciado: string
  respuesta?: MunicipioId
  estado: RespuestaEstado
}
