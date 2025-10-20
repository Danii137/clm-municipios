import topoData from './clm-municipios.topo.json' with { type: 'json' }
import { feature } from 'topojson-client'
import type { FeatureCollection, Feature, Geometry } from 'geojson'
import type { MunicipioInfo, ProvinciaId } from '../types/municipio'
import { metadataPorNombre, buildMunicipioKey } from './municipioMetadata'

const topology = topoData as any

const objectKey = Object.keys(topology.objects).find((key) => key.includes('municipal'))

if (!objectKey) {
  throw new Error('No se encontró el objeto municipal en el TopoJSON de CLM')
}

const geoResult = feature(topology, topology.objects[objectKey])

const isFeatureCollection = (
  value: unknown
): value is FeatureCollection<Geometry, Record<string, unknown>> => {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { features?: unknown }).features)
  )
}

if (!isFeatureCollection(geoResult)) {
  throw new Error('El objeto TopoJSON no contiene geometrías municipales')
}

const collection = geoResult as FeatureCollection<Geometry, Record<string, unknown>>

const provinceByNuts3: Record<string, ProvinciaId> = {
  ES421: 'albacete',
  ES422: 'ciudad-real',
  ES423: 'cuenca',
  ES424: 'guadalajara',
  ES425: 'toledo'
}

type FeatureWithInfo = {
  feature: Feature<Geometry, Record<string, unknown>>
  info: MunicipioInfo
}

const features: FeatureWithInfo[] = collection.features.map((feat) => {
  const id = String(feat.id ?? feat.properties?.NATCODE ?? '')
  const nombre = String(feat.properties?.NAMEUNIT ?? id)
  const nuts3 = String(feat.properties?.CODNUT3 ?? '')
  const provincia = provinceByNuts3[nuts3] ?? 'toledo'

  const metadata = metadataPorNombre.get(buildMunicipioKey(provincia, nombre))

  const capitalSummary = metadata?.capital
    ? `Capital: ${metadata.capital.nombre}${
        metadata.capital.poblacion
          ? ` (${metadata.capital.poblacion.toLocaleString('es-ES')} hab.)`
          : ''
      }`
    : undefined

  const info: MunicipioInfo = {
    id,
    nombre: metadata?.nombre ?? nombre,
    provincia,
    poblacion: metadata?.poblacion,
    superficieKm2: metadata?.superficieKm2,
    altitud: metadata?.altitud,
    descripcion: capitalSummary,
    coordenadas: metadata?.coordenadas,
    capital: metadata?.capital,
    entidades: metadata?.entidades
  }

  return {
    feature: feat,
    info
  }
})

export const clmMunicipioFeatures: Feature<Geometry, Record<string, unknown>>[] = features.map(
  ({ feature }) => feature
)

export const clmMunicipiosInfo: MunicipioInfo[] = features.map(({ info }) => info)

export const clmMunicipiosById = new Map<string, MunicipioInfo>(
  clmMunicipiosInfo.map((info) => [info.id, info])
)
