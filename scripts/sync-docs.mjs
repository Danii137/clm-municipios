import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const distDir = resolve(root, 'dist')
const docsDir = resolve(root, 'docs')

if (!existsSync(distDir)) {
  console.error('dist directory not found, run npm run build first')
  process.exit(1)
}

if (existsSync(docsDir)) {
  rmSync(docsDir, { recursive: true, force: true })
}

cpSync(distDir, docsDir, { recursive: true })
