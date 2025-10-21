import rawCsv from './BD_Municipios-Entidades/MUNICIPIOS_utf8.csv?raw'
import { entidadesPorMunicipio } from './entidadesMetadata'
import type {
  MunicipioInfo,
  ProvinciaId,
  EntidadInfo,
  Coordenadas
} from '../types/municipio'

const provinciasCLM = new Map<string, ProvinciaId>([
  ['Albacete', 'albacete'],
  ['Ciudad Real', 'ciudad-real'],
  ['Cuenca', 'cuenca'],
  ['Guadalajara', 'guadalajara'],
  ['Toledo', 'toledo']
])

type CsvRow = {
  COD_INE: string
  COD_GEO: string
  PROVINCIA: string
  NOMBRE_ACTUAL: string
  POBLACION_MUNI: string
  SUPERFICIE: string
  CAPITAL: string
  COD_INE_CAPITAL: string
  POBLACION_CAPITAL: string
  LONGITUD_ETRS89: string
  LATITUD_ETRS89: string
  ORIGENCOOR: string
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

const normalizeKey = (provincia: ProvinciaId, nombre: string) =>
  `${provincia}:${nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}`

type MunicipioRecord = {
  codIne: string
  codGeo: string
  key: string
  info: MunicipioInfo
}

const csvLines = rawCsv.trim().split(/\r?\n/)
const headerLine = csvLines.shift()

if (!headerLine) throw new Error('MUNICIPIOS_utf8.csv no tiene cabecera')

const headers = headerLine.split(';')
const indexOf = (name: keyof CsvRow) => headers.indexOf(name)

const records: MunicipioRecord[] = []

for (const line of csvLines) {
  if (!line.trim()) continue
  const values = line.split(';')
  if (values.length !== headers.length) continue

  const provinciaNombre = values[indexOf('PROVINCIA')]
  const provinciaId = provinciasCLM.get(provinciaNombre)
  if (!provinciaId) continue

  const codIne = values[indexOf('COD_INE')]
  const codGeo = values[indexOf('COD_GEO')]
  const nombre = values[indexOf('NOMBRE_ACTUAL')]
  const poblacion = parseIntSafe(values[indexOf('POBLACION_MUNI')])
  const superficie = parseFloatEs(values[indexOf('SUPERFICIE')])
  const altitud = parseIntSafe(values[indexOf('ALTITUD')])
  const capitalNombre = values[indexOf('CAPITAL')]
  const capitalCodigo = values[indexOf('COD_INE_CAPITAL')]
  const poblacionCapital = parseIntSafe(values[indexOf('POBLACION_CAPITAL')])
  const longitud = parseFloatEs(values[indexOf('LONGITUD_ETRS89')])
  const latitud = parseFloatEs(values[indexOf('LATITUD_ETRS89')])

  const coordenadas:
    | Coordenadas
    | undefined = typeof latitud === 'number' && typeof longitud === 'number'
    ? { lat: latitud, lon: longitud }
    : undefined

  const capitalEntidad: EntidadInfo | undefined = capitalNombre
    ? {
        id: capitalCodigo || codIne,
        nombre: capitalNombre,
        tipo: 'Capital de municipio',
        poblacion: poblacionCapital,
        coordenadas
      }
    : undefined

  const info: MunicipioInfo = {
    id: codIne,
    nombre,
    provincia: provinciaId,
    comunidad: 'castilla-la-mancha',
    poblacion,
    superficieKm2: superficie,
    altitud,
    coordenadas,
    capital: capitalEntidad
  }

  records.push({
    codIne,
    codGeo,
    key: normalizeKey(provinciaId, nombre),
    info
  })
}

const mergeEntidades = () => {
  for (const record of records) {
  const entidadesEntry = entidadesPorMunicipio.get(record.codIne)
    if (!entidadesEntry) continue

    const entidades = entidadesEntry.entidades
    if (!entidades.length) continue

    const capitalEntidad = entidades.find((ent) =>
      ent.tipo.toLowerCase().includes('capital')
    )

    record.info.entidades = entidades
    if (capitalEntidad) {
      record.info.capital = capitalEntidad
    }
  }
}

mergeEntidades()

export const municipioRecords = records

export const metadataPorCodigoINE = new Map<string, MunicipioInfo>(
  records.map((record) => [record.codIne, record.info])
)

export const metadataPorNombre = new Map<string, MunicipioInfo>(
  records.map((record) => [record.key, record.info])
)

export { normalizeKey as buildMunicipioKey }
