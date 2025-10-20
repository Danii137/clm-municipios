export type MunicipioId = string

export type ProvinciaId =
  | 'albacete'
  | 'ciudad-real'
  | 'cuenca'
  | 'guadalajara'
  | 'toledo'

export type NivelDificultad = 'estudio' | 'reto-10' | 'reto-total'

export type MunicipioInfo = {
  id: MunicipioId
  nombre: string
  provincia: ProvinciaId
  poblacion?: number
  superficieKm2?: number
  altitud?: number
  gentilicio?: string
  descripcion?: string
}

export type RespuestaEstado = 'pendiente' | 'correcta' | 'fallida'

export type Pregunta = {
  id: string
  municipioId: MunicipioId
  enunciado: string
  respuesta?: MunicipioId
  estado: RespuestaEstado
}
