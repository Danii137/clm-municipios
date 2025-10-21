const DEFAULT_SEPARATOR = '-'

const normalizeValue = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/gi, (match) => (match === 'Ñ' ? 'n' : 'n'))
    .toLowerCase()

export const slugify = (value: string, separator = DEFAULT_SEPARATOR) =>
  normalizeValue(value)
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`${separator}{2,}`, 'g'), separator)
    .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '')
