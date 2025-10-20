declare module '*.topojson' {
  const value: any
  export default value
}

declare module '*.topo.json' {
  const value: any
  export default value
}

declare module '*.csv?raw' {
  const content: string
  export default content
}
