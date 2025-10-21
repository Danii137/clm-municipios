import comunidadesTopo from './es_ccaa.topo.json' with { type: 'json' }
import provinciasTopo from './es_provincias.topo.json' with { type: 'json' }
import municipiosTopo from './es_municipios.topo.json' with { type: 'json' }
import provinciasMeta from './provincias.json' with { type: 'json' }
import municipiosMeta from './municipios.json' with { type: 'json' }
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { ComunidadId, MunicipioInfo, ProvinciaId } from '../types/municipio'
import { slugify } from '../utils/slug'

type ComunidadFeatureProperties = {
  NAMEUNIT?: string
  CODNUT2?: string
}

type ProvinciaFeatureProperties = {
  NAMEUNIT?: string
  CODNUT2?: string
}

type MunicipioFeatureProperties = {
  NAMEUNIT?: string
  CODNUT2?: string
  CODNUT3?: string
  NATCODE?: string
}

type ProvinciaCsvRecord = {
  COD_PROV: string
  PROVINCIA: string
  COD_CA: string
  COMUNIDAD_AUTONOMA: string
  CAPITAL: string
}

type MunicipioCsvRecord = {
  COD_INE: string
  COD_PROV: string
  PROVINCIA: string
  NOMBRE_ACTUAL: string
  POBLACION_MUNI?: number
  SUPERFICIE?: number
  COD_INE_CAPITAL?: string
  CAPITAL?: string
  POBLACION_CAPITAL?: number
  LONGITUD_ETRS89?: number
  LATITUD_ETRS89?: number
  ALTITUD?: number
}

export type ComunidadSummary = {
  id: ComunidadId
  nombre: string
  codCa: string
  codNut2: string
}

export type ProvinciaSummary = {
  id: ProvinciaId
  nombre: string
  codProv: string
  codCa: string
  codNut2: string
  comunidadId: ComunidadId
  comunidadNombre: string
}

const toFeatureCollection = (
  topology: Record<string, unknown>
) => {
  const objectKey = Object.keys((topology as { objects: Record<string, unknown> }).objects)[0]
  const geoResult = feature(
    topology as any,
    (topology as { objects: Record<string, unknown> }).objects[objectKey] as any
  )

  if (
    !geoResult ||
    typeof geoResult !== 'object' ||
    geoResult === null ||
    !Array.isArray((geoResult as { features?: unknown }).features)
  ) {
    throw new Error('El TopoJSON no contiene una FeatureCollection válida')
  }

  return geoResult as unknown as FeatureCollection<Geometry, Record<string, unknown>>
}

const comunidadFeatures = toFeatureCollection(comunidadesTopo) as FeatureCollection<
  Geometry,
  ComunidadFeatureProperties
>

const provinciaFeatures = toFeatureCollection(provinciasTopo) as FeatureCollection<
  Geometry,
  ProvinciaFeatureProperties
>

const municipioFeatures = toFeatureCollection(municipiosTopo) as FeatureCollection<
  Geometry,
  MunicipioFeatureProperties
>

const provinciaRecords = provinciasMeta as ProvinciaCsvRecord[]
const municipioRecords = municipiosMeta as MunicipioCsvRecord[]

const comunidadFeatureBySlug = new Map(
  comunidadFeatures.features.map((feature) => {
    const nombre = feature.properties?.NAMEUNIT ?? ''
    return [slugify(nombre), feature]
  })
)

const provinceFeatureBySlug = new Map(
  provinciaFeatures.features.map((feature) => {
    const nombre = feature.properties?.NAMEUNIT ?? ''
    return [slugify(nombre), feature]
  })
)

const toProvinciaId = (nombre: string) => slugify(nombre)

const comunidadSummariesMap = new Map<ComunidadId, ComunidadSummary>()

const provinceSummaries: ProvinciaSummary[] = []
const provinceByCod = new Map<string, ProvinciaSummary>()

for (const record of provinciaRecords) {
  const provinciaNombre = record.PROVINCIA
  const provinciaSlug = toProvinciaId(provinciaNombre)
  const feature = provinceFeatureBySlug.get(provinciaSlug)

  if (!feature) {
    console.warn(`No se encontró geometría para la provincia ${provinciaNombre}. Se omite.`)
    continue
  }

  const comunidadSlug = slugify(record.COMUNIDAD_AUTONOMA)
  const comunidadFeature = comunidadFeatureBySlug.get(comunidadSlug)

  if (!comunidadFeature) {
    console.warn(
      `No se encontró geometría para la comunidad autónoma ${record.COMUNIDAD_AUTONOMA}. Se omite la provincia ${provinciaNombre}.`
    )
    continue
  }

  const comunidadNombre = comunidadFeature.properties?.NAMEUNIT ?? record.COMUNIDAD_AUTONOMA
  const comunidadId = slugify(comunidadNombre)
  const codNut2 = feature.properties?.CODNUT2 ?? comunidadFeature.properties?.CODNUT2 ?? ''

  if (!comunidadSummariesMap.has(comunidadId)) {
    comunidadSummariesMap.set(comunidadId, {
      id: comunidadId,
      nombre: comunidadNombre,
      codCa: record.COD_CA,
      codNut2
    })
  }

  const summary: ProvinciaSummary = {
    id: provinciaSlug,
    nombre: provinciaNombre,
    codProv: record.COD_PROV,
    codCa: record.COD_CA,
    codNut2,
    comunidadId,
    comunidadNombre
  }

  provinceSummaries.push(summary)
  provinceByCod.set(record.COD_PROV.padStart(2, '0'), summary)
}

export const comunidades: ComunidadSummary[] = Array.from(comunidadSummariesMap.values()).sort(
  (a, b) => a.nombre.localeCompare(b.nombre, 'es')
)

export const provincias: ProvinciaSummary[] = provinceSummaries.sort((a, b) =>
  a.nombre.localeCompare(b.nombre, 'es')
)

const provinceIdsByCommunity = new Map<ComunidadId, ProvinciaId[]>(
  comunidades.map((community) => [
    community.id,
    provincias.filter((prov) => prov.comunidadId === community.id).map((prov) => prov.id)
  ])
)

type EnrichedMunicipioRecord = MunicipioCsvRecord & {
  provinciaId?: ProvinciaId
  comunidadId?: ComunidadId
}

const municipioRecordsWithIds: EnrichedMunicipioRecord[] = municipioRecords.map((record) => {
  const provincia = provinceByCod.get(record.COD_PROV.padStart(2, '0'))

  return {
    ...record,
    provinciaId: provincia?.id,
    comunidadId: provincia?.comunidadId
  }
})

const metadataByProvinceAndName = new Map<string, EnrichedMunicipioRecord>()
const metadataByName = new Map<string, EnrichedMunicipioRecord[]>()

const buildMunicipioKey = (provinciaId: ProvinciaId | undefined, nombre: string) =>
  provinciaId ? `${provinciaId}__${slugify(nombre)}` : slugify(nombre)

for (const record of municipioRecordsWithIds) {
  if (!record.provinciaId) continue

  const key = buildMunicipioKey(record.provinciaId, record.NOMBRE_ACTUAL)
  if (!metadataByProvinceAndName.has(key)) {
    metadataByProvinceAndName.set(key, record)
  }

  const nameKey = slugify(record.NOMBRE_ACTUAL)
  const existing = metadataByName.get(nameKey) ?? []
  existing.push(record)
  metadataByName.set(nameKey, existing)
}

const findMetadataForFeature = (
  feature: Feature<Geometry, MunicipioFeatureProperties>
): EnrichedMunicipioRecord | undefined => {
  const nombre = feature.properties?.NAMEUNIT ?? ''
  const nameKey = slugify(nombre)

  const candidates = metadataByName.get(nameKey)
  if (!candidates || candidates.length === 0) return undefined

  if (candidates.length === 1) return candidates[0]

  const codNut2 = feature.properties?.CODNUT2
  if (!codNut2) return candidates[0]

  const community = comunidades.find((comunidad) => comunidad.codNut2 === codNut2)
  if (!community) return candidates[0]

  return candidates.find((candidate) => candidate.comunidadId === community.id) ?? candidates[0]
}

type FeatureWithInfo = {
  feature: Feature<Geometry, MunicipioFeatureProperties>
  info: MunicipioInfo
}

const featuresWithInfo: FeatureWithInfo[] = []

const codNut3ToProvinceId = new Map<string, ProvinciaId>()

for (const feature of municipioFeatures.features) {
  const metadata = findMetadataForFeature(feature)
  if (!metadata || !metadata.provinciaId || !metadata.comunidadId) continue

  const provinciaId = metadata.provinciaId
  const comunidadId = metadata.comunidadId
  const featureId = String(feature.properties?.NATCODE ?? feature.id ?? metadata.COD_INE ?? '')
  if (!featureId) continue

  ;(feature as any).id = featureId

  const superficieKm2 = typeof metadata.SUPERFICIE === 'number' ? metadata.SUPERFICIE / 100 : undefined
  const densidadHabKm2 =
    typeof metadata.POBLACION_MUNI === 'number' && typeof superficieKm2 === 'number' && superficieKm2 > 0
      ? metadata.POBLACION_MUNI / superficieKm2
      : undefined

  if (feature.properties?.CODNUT3 && !codNut3ToProvinceId.has(feature.properties.CODNUT3)) {
    codNut3ToProvinceId.set(feature.properties.CODNUT3, provinciaId)
  }

  const info: MunicipioInfo = {
    id: featureId,
    nombre: metadata.NOMBRE_ACTUAL,
    provincia: provinciaId,
    comunidad: comunidadId,
    poblacion: metadata.POBLACION_MUNI,
    superficieKm2,
    altitud: metadata.ALTITUD,
    descripcion: undefined,
    coordenadas:
      typeof metadata.LATITUD_ETRS89 === 'number' && typeof metadata.LONGITUD_ETRS89 === 'number'
        ? {
            lat: metadata.LATITUD_ETRS89,
            lon: metadata.LONGITUD_ETRS89
          }
        : undefined,
    capital:
      metadata.CAPITAL && metadata.CAPITAL !== metadata.NOMBRE_ACTUAL
        ? {
            id: metadata.COD_INE_CAPITAL ?? '',
            nombre: metadata.CAPITAL,
            tipo: 'capital',
            poblacion: metadata.POBLACION_CAPITAL,
            altitud: metadata.ALTITUD,
            coordenadas:
              typeof metadata.LATITUD_ETRS89 === 'number' &&
              typeof metadata.LONGITUD_ETRS89 === 'number'
                ? {
                    lat: metadata.LATITUD_ETRS89,
                    lon: metadata.LONGITUD_ETRS89
                  }
                : undefined
          }
        : undefined,
    densidadHabKm2
  }

  featuresWithInfo.push({ feature, info })
}

export const spanishMunicipioFeatures: Feature<Geometry, Record<string, unknown>>[] =
  featuresWithInfo.map(({ feature }) => feature)

export const spanishMunicipiosInfo: MunicipioInfo[] = featuresWithInfo.map(({ info }) => info)

export const spanishMunicipiosById = new Map<string, MunicipioInfo>(
  spanishMunicipiosInfo.map((info) => [info.id, info])
)

export const provincesByCommunity = provinceIdsByCommunity
export const provinceById = new Map(provincias.map((prov) => [prov.id, prov]))
