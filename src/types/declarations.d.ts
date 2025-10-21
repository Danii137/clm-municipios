import type { Topology } from 'topojson-specification'

declare module '*.topojson' {
  const value: Topology
  export default value
}

declare module '*.topo.json' {
  const value: Topology
  export default value
}

declare module '*.csv?raw' {
  const content: string
  export default content
}
