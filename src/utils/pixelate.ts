import { mard221 } from '../data/mard221.js'
import { deltaE2000, hexToLab, labEuclidean } from './color'
import type { MardColor } from '../data/mard221.js'
import type { LabColor } from './color'

export type QuantizedPixel = {
  averageHex: string
  hex: string
  code: string
  name: string
  deltaE: number
}

export type PatternColorStat = {
  code: string
  name: string
  hex: string
  count: number
}

export type PixelPattern = {
  size: number
  cells: QuantizedPixel[]
  stats: PatternColorStat[]
}

export type PixelateOptions = {
  dithering?: boolean
}

type RgbColor = {
  red: number
  green: number
  blue: number
}

type PreparedMardColor = MardColor & { lab: LabColor }

const SAMPLE_LIMIT = 1024
const preparedPalette: PreparedMardColor[] = mard221.map((color) => ({ ...color, lab: hexToLab(color.hex) }))
const matchCache = new Map<string, Omit<QuantizedPixel, 'averageHex'>>()

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'))
    image.src = source
  })
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value))
}

function toHex(red: number, green: number, blue: number) {
  return `#${[red, green, blue].map((value) => Math.round(clampChannel(value)).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

function hexToRgb(hex: string): RgbColor {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function matchMardColor(averageHex: string): QuantizedPixel {
  const cached = matchCache.get(averageHex)
  if (cached) return { averageHex, ...cached }

  const sourceLab = hexToLab(averageHex)
  let best = preparedPalette[0]
  let bestDelta = Number.POSITIVE_INFINITY
  let bestEuclidean = Number.POSITIVE_INFINITY

  for (const candidate of preparedPalette) {
    const calculatedDelta = deltaE2000(sourceLab, candidate.lab)
    const delta = Number.isFinite(calculatedDelta) ? calculatedDelta : labEuclidean(sourceLab, candidate.lab)
    const euclidean = labEuclidean(sourceLab, candidate.lab)
    if (delta < bestDelta || (Math.abs(delta - bestDelta) < 1e-9 && euclidean < bestEuclidean)) {
      best = candidate
      bestDelta = delta
      bestEuclidean = euclidean
    }
  }

  const match = { hex: best.hex, code: best.code, name: best.name, deltaE: bestDelta }
  matchCache.set(averageHex, match)
  return { averageHex, ...match }
}

export async function pixelateImage(source: string, size: number, options: PixelateOptions = {}): Promise<PixelPattern> {
  if (!Number.isInteger(size) || size < 1) throw new Error('INVALID_GRID_SIZE')

  const image = await loadImage(source)
  const sampleSize = Math.max(size, Math.min(SAMPLE_LIMIT, Math.max(image.naturalWidth, image.naturalHeight)))
  const canvas = document.createElement('canvas')
  canvas.width = sampleSize
  canvas.height = sampleSize

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('CANVAS_UNAVAILABLE')

  context.fillStyle = '#FFF9F2'
  context.fillRect(0, 0, sampleSize, sampleSize)
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, 0, 0, sampleSize, sampleSize)

  let pixels: ImageData
  try {
    pixels = context.getImageData(0, 0, sampleSize, sampleSize)
  } catch {
    throw new Error('PIXEL_READ_FAILED')
  }

  const averageColors = new Float64Array(size * size * 3)
  for (let gridY = 0; gridY < size; gridY += 1) {
    const startY = Math.floor((gridY * sampleSize) / size)
    const endY = Math.max(startY + 1, Math.floor(((gridY + 1) * sampleSize) / size))

    for (let gridX = 0; gridX < size; gridX += 1) {
      const startX = Math.floor((gridX * sampleSize) / size)
      const endX = Math.max(startX + 1, Math.floor(((gridX + 1) * sampleSize) / size))
      let red = 0
      let green = 0
      let blue = 0
      let count = 0

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const offset = (y * sampleSize + x) * 4
          red += pixels.data[offset]
          green += pixels.data[offset + 1]
          blue += pixels.data[offset + 2]
          count += 1
        }
      }

      const cellOffset = (gridY * size + gridX) * 3
      averageColors[cellOffset] = red / count
      averageColors[cellOffset + 1] = green / count
      averageColors[cellOffset + 2] = blue / count
    }
  }

  const workingColors = new Float64Array(averageColors)
  const cells: QuantizedPixel[] = []
  const stats = new Map<string, PatternColorStat>()
  const spreadError = (x: number, y: number, red: number, green: number, blue: number, weight: number) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return
    const targetOffset = (y * size + x) * 3
    workingColors[targetOffset] += red * weight
    workingColors[targetOffset + 1] += green * weight
    workingColors[targetOffset + 2] += blue * weight
  }

  for (let gridY = 0; gridY < size; gridY += 1) {
    for (let gridX = 0; gridX < size; gridX += 1) {
      const cellIndex = gridY * size + gridX
      const cellOffset = cellIndex * 3
      const averageHex = toHex(averageColors[cellOffset], averageColors[cellOffset + 1], averageColors[cellOffset + 2])
      const inputRed = clampChannel(workingColors[cellOffset])
      const inputGreen = clampChannel(workingColors[cellOffset + 1])
      const inputBlue = clampChannel(workingColors[cellOffset + 2])
      const matched = matchMardColor(toHex(inputRed, inputGreen, inputBlue))
      const match = { ...matched, averageHex }
      cells.push(match)
      const existing = stats.get(match.code)
      if (existing) existing.count += 1
      else stats.set(match.code, { code: match.code, name: match.name, hex: match.hex, count: 1 })

      if (options.dithering) {
        const matchedRgb = hexToRgb(match.hex)
        const errorRed = inputRed - matchedRgb.red
        const errorGreen = inputGreen - matchedRgb.green
        const errorBlue = inputBlue - matchedRgb.blue
        spreadError(gridX + 1, gridY, errorRed, errorGreen, errorBlue, 7 / 16)
        spreadError(gridX - 1, gridY + 1, errorRed, errorGreen, errorBlue, 3 / 16)
        spreadError(gridX, gridY + 1, errorRed, errorGreen, errorBlue, 5 / 16)
        spreadError(gridX + 1, gridY + 1, errorRed, errorGreen, errorBlue, 1 / 16)
      }
    }
  }

  canvas.width = 1
  canvas.height = 1
  return {
    size,
    cells,
    stats: [...stats.values()].sort((left, right) => right.count - left.count || left.code.localeCompare(right.code)),
  }
}
