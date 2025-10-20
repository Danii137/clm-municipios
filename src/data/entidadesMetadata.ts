import rawCsv from './BD_Municipios-Entidades/ENTIDADES_utf8.csv?raw'
import type { EntidadInfo, ProvinciaId } from '../types/municipio'

const provinciasCLM = new Map<string, ProvinciaId>([
  ['Albacete', 'albacete'],
  ['Ciudad Real', 'ciudad-real'],
  ['Cuenca', 'cuenca'],
  ['Guadalajara', 'guadalajara'],
  ['Toledo', 'toledo']
])

type CsvRow = {
  CODIGOINE: string
  NOMBRE: string
  PROVINCIA: string
  TIPO: string
  POBLACION: string
  INEMUNI: string
  LONGITUD_ETRS89: string
  LATITUD_ETRS89: string
  ALTITUD: string
}

const parseFloatEs = (value?: string) => {
  if (!value) return undefined
  const normalized = value.replace(/\./g, '').replace(',', '.')
  const num = Number.parseFloat(normalized)
  return Number.isNaN(num) ? undefined : num
}

const parseIntSafe = (value?: string) => {
  if (!value) return undefined
  const num = Number.parseInt(value, 10)
  return Number.isNaN(num) ? undefined : num
}

const csvLines = rawCsv.trim().split(/\r?\n/)
const headerLine = csvLines.shift()

if (!headerLine) throw new Error('ENTIDADES_utf8.csv no contiene cabecera')

const headers = headerLine.split(';')
const indexOf = (name: keyof CsvRow) => headers.indexOf(name)

export type EntidadesPorMunicipio = Map<
  string,
  {
    entidades: EntidadInfo[]
  }
>

export const entidadesPorMunicipio: EntidadesPorMunicipio = new Map()

for (const line of csvLines) {
  if (!line.trim()) continue
  const values = line.split(';')
  if (values.length !== headers.length) continue

  const provinciaNombre = values[indexOf('PROVINCIA')]
  const provinciaId = provinciasCLM.get(provinciaNombre)
  if (!provinciaId) continue

  const codigoIne = values[indexOf('CODIGOINE')]
  if (!codigoIne) continue
  const key = `${codigoIne.slice(0, 5)}000000`.slice(0, 11)

  const nombre = values[indexOf('NOMBRE')]
  const tipo = values[indexOf('TIPO')]
  const poblacion = parseIntSafe(values[indexOf('POBLACION')])
  const altitud = parseIntSafe(values[indexOf('ALTITUD')])
  const longitud = parseFloatEs(values[indexOf('LONGITUD_ETRS89')])
  const latitud = parseFloatEs(values[indexOf('LATITUD_ETRS89')])

  const entidad: EntidadInfo = {
    id: codigoIne,
    nombre,
    tipo,
    poblacion,
    altitud,
    coordenadas:
      typeof latitud === 'number' && typeof longitud === 'number'
        ? { lat: latitud, lon: longitud }
        : undefined
  }

  const existing = entidadesPorMunicipio.get(key)
  if (existing) {
    existing.entidades.push(entidad)
  } else {
    entidadesPorMunicipio.set(key, { entidades: [entidad] })
  }
}
