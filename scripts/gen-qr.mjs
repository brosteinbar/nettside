// Generates the Brostein table QR code as a static SVG (+ high-res PNG).
// The code encodes a single fixed URL pointing at our own domain — no redirect
// service, so it never expires. Re-run with `npm run gen:qr`.
//
// Optional override:  node scripts/gen-qr.mjs "https://brosteinbar.no/#/meny"

import QRCode from 'qrcode'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.argv[2] || 'https://brosteinbar.no/#/qr'

const options = {
  errorCorrectionLevel: 'H', // highest — survives scuffs/spills, leaves room for a center logo
  margin: 4,                 // quiet zone in modules (min for reliable scanning)
  color: {
    dark: '#0a0908',         // --fg  (near-black modules)
    light: '#ede8de',        // --bg  (off-white background)
  },
}

const root = resolve(fileURLToPath(import.meta.url), '../..')
const outDir = resolve(root, 'qr')
await mkdir(outDir, { recursive: true })

const svgPath = resolve(outDir, 'brostein-qr.svg')
const pngPath = resolve(outDir, 'brostein-qr.png')

const svg = await QRCode.toString(url, { ...options, type: 'svg' })
await writeFile(svgPath, svg, 'utf8')
await QRCode.toFile(pngPath, url, { ...options, width: 2000 })

console.log(`QR generated for: ${url}`)
console.log(`  SVG: ${svgPath}`)
console.log(`  PNG: ${pngPath} (2000px)`)
