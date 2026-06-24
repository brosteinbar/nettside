// Generates the Brostein table QR code as a static SVG with the 'B' mark in the
// centre. The code encodes a single fixed URL on our own domain — no redirect
// service, so it never expires. Re-run with `npm run gen:qr`.
//
// Optional override:  node scripts/gen-qr.mjs "https://brosteinbar.no/#/meny"

import QRCode from 'qrcode'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const url = process.argv[2] || 'https://brosteinbar.no/#/qr'

const FG = '#0a0908' // --fg  (near-black)
const BG = '#ede8de' // --bg  (off-white)

// Fraction of the code's width the logo medallion may span. Error-correction
// level H tolerates ~30% loss; we stay well under that for safe scanning.
const LOGO_FRACTION = 0.15

const options = {
  errorCorrectionLevel: 'H', // highest — gives the headroom to cover the centre
  margin: 4,                 // quiet zone in modules (min for reliable scanning)
  color: { dark: FG, light: BG },
}

const root = resolve(fileURLToPath(import.meta.url), '../..')
const outDir = resolve(root, 'qr')
await mkdir(outDir, { recursive: true })

// 1. Base QR as SVG, and its canvas size N (modules + 2*margin) from the viewBox.
const qrSvg = await QRCode.toString(url, { ...options, type: 'svg' })
const N = Number(qrSvg.match(/viewBox="0 0 ([\d.]+)/)[1])

// 2. Pull the 'B' mark's intrinsic size + path (avoid matching id="...").
const logoRaw = await readFile(resolve(root, 'resources/img/B_svart.svg'), 'utf8')
const [, vbW, vbH] = logoRaw.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number)
const logoPath = logoRaw.match(/<path\b[^>]*?\sd="([^"]+)"/)[1]

// 3. Centre a knockout medallion (background colour) + the mark on top.
const logoH = N * LOGO_FRACTION
const logoW = logoH * (vbW / vbH)
const pad = N * 0.015
const boxW = logoW + pad * 2
const boxH = logoH + pad * 2
const cx = N / 2
const cy = N / 2
const f = n => n.toFixed(3)

const overlay =
  `<rect x="${f(cx - boxW / 2)}" y="${f(cy - boxH / 2)}" width="${f(boxW)}" height="${f(boxH)}" ` +
  `rx="${f(boxW * 0.18)}" fill="${BG}"/>` +
  `<svg x="${f(cx - logoW / 2)}" y="${f(cy - logoH / 2)}" width="${f(logoW)}" height="${f(logoH)}" ` +
  `viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet">` +
  `<path fill="${FG}" fill-rule="evenodd" d="${logoPath}"/></svg>`

const finalSvg = qrSvg.replace('</svg>', overlay + '</svg>')

const svgPath = resolve(outDir, 'brostein-qr.svg')
await writeFile(svgPath, finalSvg, 'utf8')

const coverage = ((boxW * boxH) / (N * N) * 100).toFixed(1)
console.log(`QR generated for: ${url}`)
console.log(`  SVG (with B logo): ${svgPath}`)
console.log(`  canvas: ${N} modules incl. quiet zone · medallion covers ~${coverage}% of full area`)
