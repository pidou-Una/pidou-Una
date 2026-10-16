import { mard221 } from '../data/mard221.js'
import {
  deltaE2000,
  hexToLab,
  labEuclidean,
} from './color'
import type { MardColor } from '../data/mard221.js'
import type { LabColor } from './color'

export type QuantizedPixel = {
  averageHex: string
  hex: string
  code: string
  name: string
  deltaE: number
  isEmpty?: boolean
  isOutline?: boolean
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
  beadCount: number
  emptyCount: number
}

export type PixelateOptions = {
  /** 是否启用 Floyd–Steinberg 抖动。 */
  dithering?: boolean

  /** 是否把与画布边缘连通的高亮、低饱和区域标记为空白。 */
  removeBackground?: boolean

  /** 是否使用统一深色为主体勾勒最外圈。 */
  outline?: boolean

  /** 相邻颜色在 CIEDE2000 色差低于此值时合并。 */
  mergeThreshold?: number

  /** 图纸允许使用的最大颜色总数，包含统一描边色。 */
  maxColors?: number
}

type RgbColor = {
  red: number
  green: number
  blue: number
}

type PreparedMardColor = MardColor & {
  lab: LabColor
}

type PaletteMatch = Omit<
  QuantizedPixel,
  'averageHex' | 'isEmpty' | 'isOutline'
>

const SAMPLE_LIMIT = 1024
const DEFAULT_MERGE_THRESHOLD = 5
const DEFAULT_MAX_COLORS = 24

const OUTLINE_COLOR: QuantizedPixel = {
  averageHex: '#2E2B2F',
  hex: '#2E2B2F',
  code: 'MARD-000',
  name: '统一轮廓深灰',
  deltaE: 0,
  isEmpty: false,
  isOutline: true,
}

const preparedPalette: PreparedMardColor[] = mard221.map(
  (color) => ({
    ...color,
    lab: hexToLab(color.hex),
  }),
)

const matchCache = new Map<string, PaletteMatch>()
const labCache = new Map<string, LabColor>()

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()

    image.onload = () => resolve(image)

    image.onerror = () => {
      reject(new Error('IMAGE_DECODE_FAILED'))
    }

    image.src = source
  })
}

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value))
}

function toHex(
  red: number,
  green: number,
  blue: number,
) {
  return `#${[red, green, blue]
    .map((value) =>
      Math.round(clampChannel(value))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`.toUpperCase()
}

function hexToRgb(hex: string): RgbColor {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function getLab(hex: string) {
  const cached = labCache.get(hex)

  if (cached) {
    return cached
  }

  const lab = hexToLab(hex)
  labCache.set(hex, lab)

  return lab
}

function colorDifference(
  leftHex: string,
  rightHex: string,
) {
  const left = getLab(leftHex)
  const right = getLab(rightHex)
  const calculated = deltaE2000(left, right)

  return Number.isFinite(calculated)
    ? calculated
    : labEuclidean(left, right)
}

/**
 * 提取网格主导色，而不是混合网格内的所有像素。
 *
 * 优先使用出现次数最多的精确 RGB。
 * 当照片压缩导致所有颜色都只出现一次时，
 * 使用 5-bit RGB 色桶找出最密集的颜色簇，
 * 并仅对该颜色簇求代表色。
 */
function dominantCellColor(
  pixels: ImageData,
  sampleSize: number,
  startX: number,
  endX: number,
  startY: number,
  endY: number,
): RgbColor {
  const exactCounts = new Map<number, number>()

  const buckets = new Map<
    number,
    {
      count: number
      red: number
      green: number
      blue: number
    }
  >()

  let bestExactKey = 0
  let bestExactCount = 0

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const offset = (y * sampleSize + x) * 4

      const red = pixels.data[offset]
      const green = pixels.data[offset + 1]
      const blue = pixels.data[offset + 2]

      const exactKey =
        (red << 16) |
        (green << 8) |
        blue

      const exactCount =
        (exactCounts.get(exactKey) ?? 0) + 1

      exactCounts.set(exactKey, exactCount)

      if (exactCount > bestExactCount) {
        bestExactCount = exactCount
        bestExactKey = exactKey
      }

      const bucketKey =
        ((red >> 3) << 10) |
        ((green >> 3) << 5) |
        (blue >> 3)

      const bucket = buckets.get(bucketKey)

      if (bucket) {
        bucket.count += 1
        bucket.red += red
        bucket.green += green
        bucket.blue += blue
      } else {
        buckets.set(bucketKey, {
          count: 1,
          red,
          green,
          blue,
        })
      }
    }
  }

  if (bestExactCount > 1) {
    return {
      red: (bestExactKey >> 16) & 255,
      green: (bestExactKey >> 8) & 255,
      blue: bestExactKey & 255,
    }
  }

  let dominantBucket = {
    count: 1,
    red: 255,
    green: 249,
    blue: 242,
  }

  for (const bucket of buckets.values()) {
    if (bucket.count > dominantBucket.count) {
      dominantBucket = bucket
    }
  }

  return {
    red: dominantBucket.red / dominantBucket.count,
    green:
      dominantBucket.green / dominantBucket.count,
    blue: dominantBucket.blue / dominantBucket.count,
  }
}

function isWhiteBackgroundCandidate(
  red: number,
  green: number,
  blue: number,
) {
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)

  const luminance =
    red * 0.2126 +
    green * 0.7152 +
    blue * 0.0722

  return (
    maximum >= 238 &&
    minimum >= 220 &&
    maximum - minimum <= 30 &&
    luminance >= 232
  )
}

/**
 * 仅移除从画布边缘连通进来的亮色、低饱和背景。
 */
function createBackgroundMask(
  colors: Float64Array,
  size: number,
) {
  const mask = new Uint8Array(size * size)
  const visited = new Uint8Array(size * size)
  const queue: number[] = []

  const enqueue = (index: number) => {
    if (visited[index]) {
      return
    }

    visited[index] = 1

    const offset = index * 3

    if (
      isWhiteBackgroundCandidate(
        colors[offset],
        colors[offset + 1],
        colors[offset + 2],
      )
    ) {
      mask[index] = 1
      queue.push(index)
    }
  }

  for (
    let position = 0;
    position < size;
    position += 1
  ) {
    enqueue(position)
    enqueue((size - 1) * size + position)
    enqueue(position * size)
    enqueue(position * size + size - 1)
  }

  for (
    let cursor = 0;
    cursor < queue.length;
    cursor += 1
  ) {
    const index = queue[cursor]
    const x = index % size
    const y = Math.floor(index / size)

    if (x > 0) {
      enqueue(index - 1)
    }

    if (x + 1 < size) {
      enqueue(index + 1)
    }

    if (y > 0) {
      enqueue(index - size)
    }

    if (y + 1 < size) {
      enqueue(index + size)
    }
  }

  return mask
}

/**
 * 使用八邻域把主体与背景接触的最外圈
 * 标记为统一描边。
 */
function createOutlineMask(
  backgroundMask: Uint8Array,
  size: number,
) {
  const mask = new Uint8Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x

      if (backgroundMask[index]) {
        continue
      }

      for (
        let offsetY = -1;
        offsetY <= 1 && !mask[index];
        offsetY += 1
      ) {
        for (
          let offsetX = -1;
          offsetX <= 1;
          offsetX += 1
        ) {
          if (offsetX === 0 && offsetY === 0) {
            continue
          }

          const neighborX = x + offsetX
          const neighborY = y + offsetY

          if (
            neighborX < 0 ||
            neighborX >= size ||
            neighborY < 0 ||
            neighborY >= size
          ) {
            continue
          }

          if (
            backgroundMask[
              neighborY * size + neighborX
            ]
          ) {
            mask[index] = 1
            break
          }
        }
      }
    }
  }

  return mask
}

/**
 * RGB 转 LAB 后优先使用 CIEDE2000 匹配色卡。
 */
function matchMardColor(
  sourceHex: string,
): PaletteMatch {
  const cached = matchCache.get(sourceHex)

  if (cached) {
    return cached
  }

  const sourceLab = getLab(sourceHex)

  let best = preparedPalette[0]
  let bestDelta = Number.POSITIVE_INFINITY
  let bestEuclidean = Number.POSITIVE_INFINITY

  for (const candidate of preparedPalette) {
    const calculated = deltaE2000(
      sourceLab,
      candidate.lab,
    )

    const delta = Number.isFinite(calculated)
      ? calculated
      : labEuclidean(sourceLab, candidate.lab)

    const euclidean = labEuclidean(
      sourceLab,
      candidate.lab,
    )

    if (
      delta < bestDelta ||
      (Math.abs(delta - bestDelta) < 1e-9 &&
        euclidean < bestEuclidean)
    ) {
      best = candidate
      bestDelta = delta
      bestEuclidean = euclidean
    }
  }

  const match = {
    hex: best.hex,
    code: best.code,
    name: best.name,
    deltaE: bestDelta,
  }

  matchCache.set(sourceHex, match)

  return match
}

function normalColorCounts(
  cells: QuantizedPixel[],
) {
  const counts = new Map<string, number>()

  for (const cell of cells) {
    if (cell.isEmpty || cell.isOutline) {
      continue
    }

    counts.set(
      cell.code,
      (counts.get(cell.code) ?? 0) + 1,
    )
  }

  return counts
}

/**
 * 合并相邻且 LAB 色差低于阈值的颜色。
 *
 * 使用并查集连接相邻颜色组，
 * 并始终保留全图使用次数更多的颜色。
 */
function mergeSimilarNeighborColors(
  cells: QuantizedPixel[],
  size: number,
  threshold: number,
) {
  if (threshold <= 0) {
    return cells
  }

  const counts = normalColorCounts(cells)

  const representatives = new Map<
    string,
    QuantizedPixel
  >()

  for (const cell of cells) {
    if (
      !cell.isEmpty &&
      !cell.isOutline &&
      !representatives.has(cell.code)
    ) {
      representatives.set(cell.code, cell)
    }
  }

  const parent = new Map<string, string>()
  const weights = new Map<string, number>()

  for (const [code, count] of counts) {
    parent.set(code, code)
    weights.set(code, count)
  }

  const find = (code: string): string => {
    const current = parent.get(code) ?? code

    if (current === code) {
      return code
    }

    const root = find(current)
    parent.set(code, root)

    return root
  }

  const union = (
    leftCode: string,
    rightCode: string,
  ) => {
    const leftRoot = find(leftCode)
    const rightRoot = find(rightCode)

    if (leftRoot === rightRoot) {
      return
    }

    const leftColor =
      representatives.get(leftRoot)

    const rightColor =
      representatives.get(rightRoot)

    if (
      !leftColor ||
      !rightColor ||
      colorDifference(
        leftColor.hex,
        rightColor.hex,
      ) >= threshold
    ) {
      return
    }

    const leftWeight =
      weights.get(leftRoot) ?? 0

    const rightWeight =
      weights.get(rightRoot) ?? 0

    const winner =
      leftWeight > rightWeight ||
      (leftWeight === rightWeight &&
        leftRoot < rightRoot)
        ? leftRoot
        : rightRoot

    const loser =
      winner === leftRoot
        ? rightRoot
        : leftRoot

    parent.set(loser, winner)

    weights.set(
      winner,
      leftWeight + rightWeight,
    )
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x
      const cell = cells[index]

      if (cell.isEmpty || cell.isOutline) {
        continue
      }

      if (x + 1 < size) {
        const right = cells[index + 1]

        if (
          !right.isEmpty &&
          !right.isOutline
        ) {
          union(cell.code, right.code)
        }
      }

      if (y + 1 < size) {
        const below = cells[index + size]

        if (
          !below.isEmpty &&
          !below.isOutline
        ) {
          union(cell.code, below.code)
        }
      }
    }
  }

  return cells.map((cell) => {
    if (cell.isEmpty || cell.isOutline) {
      return cell
    }

    const target = representatives.get(
      find(cell.code),
    )

    if (!target || target.code === cell.code) {
      return cell
    }

    return {
      ...cell,
      hex: target.hex,
      code: target.code,
      name: target.name,
      deltaE: colorDifference(
        cell.averageHex,
        target.hex,
      ),
    }
  })
}

/**
 * 将普通颜色限制到指定数量。
 * 统一描边色也计入总颜色数。
 */
function limitColorCount(
  cells: QuantizedPixel[],
  requestedMaxColors: number,
) {
  const hasOutline = cells.some(
    (cell) => cell.isOutline,
  )

  const normalLimit = Math.max(
    1,
    requestedMaxColors -
      (hasOutline ? 1 : 0),
  )

  const counts = normalColorCounts(cells)

  if (counts.size <= normalLimit) {
    return cells
  }

  const keptCodes = [...counts.entries()]
    .sort(
      (left, right) =>
        right[1] - left[1] ||
        left[0].localeCompare(right[0]),
    )
    .slice(0, normalLimit)
    .map(([code]) => code)

  const keptSet = new Set(keptCodes)

  const representatives = new Map<
    string,
    QuantizedPixel
  >()

  for (const cell of cells) {
    if (
      !cell.isEmpty &&
      !cell.isOutline &&
      keptSet.has(cell.code) &&
      !representatives.has(cell.code)
    ) {
      representatives.set(cell.code, cell)
    }
  }

  return cells.map((cell) => {
    if (
      cell.isEmpty ||
      cell.isOutline ||
      keptSet.has(cell.code)
    ) {
      return cell
    }

    let closest:
      | QuantizedPixel
      | undefined

    let closestDelta =
      Number.POSITIVE_INFINITY

    for (
      const candidate of representatives.values()
    ) {
      const delta = colorDifference(
        cell.hex,
        candidate.hex,
      )

      if (delta < closestDelta) {
        closest = candidate
        closestDelta = delta
      }
    }

    if (!closest) {
      return cell
    }

    return {
      ...cell,
      hex: closest.hex,
      code: closest.code,
      name: closest.name,
      deltaE: colorDifference(
        cell.averageHex,
        closest.hex,
      ),
    }
  })
}

function createStatistics(
  cells: QuantizedPixel[],
) {
  const stats = new Map<
    string,
    PatternColorStat
  >()

  for (const cell of cells) {
    if (cell.isEmpty) {
      continue
    }

    const existing = stats.get(cell.code)

    if (existing) {
      existing.count += 1
    } else {
      stats.set(cell.code, {
        code: cell.code,
        name: cell.isOutline
          ? OUTLINE_COLOR.name
          : cell.name,
        hex: cell.hex,
        count: 1,
      })
    }
  }

  return [...stats.values()].sort(
    (left, right) =>
      right.count - left.count ||
      left.code.localeCompare(right.code),
  )
}

export async function pixelateImage(
  source: string,
  size: number,
  // 第三个参数与 App.tsx 的调用保持一致；省略时使用安全默认值。
  options: PixelateOptions = {},
): Promise<PixelPattern> {
  if (
    !Number.isInteger(size) ||
    size < 1
  ) {
    throw new Error('INVALID_GRID_SIZE')
  }

  const mergeThreshold = Math.max(
    0,
    Math.min(
      30,
      options.mergeThreshold ??
        DEFAULT_MERGE_THRESHOLD,
    ),
  )

  const maxColors = Math.max(
    1,
    Math.min(
      221,
      Math.round(
        options.maxColors ??
          DEFAULT_MAX_COLORS,
      ),
    ),
  )

  const image = await loadImage(source)

  const sampleSize = Math.max(
    size,
    Math.min(
      SAMPLE_LIMIT,
      Math.max(
        image.naturalWidth,
        image.naturalHeight,
      ),
    ),
  )

  const canvas =
    document.createElement('canvas')

  canvas.width = sampleSize
  canvas.height = sampleSize

  const context = canvas.getContext('2d', {
    willReadFrequently: true,
  })

  if (!context) {
    throw new Error('CANVAS_UNAVAILABLE')
  }

  context.fillStyle = '#FFF9F2'
  context.fillRect(
    0,
    0,
    sampleSize,
    sampleSize,
  )

  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'

  context.drawImage(
    image,
    0,
    0,
    sampleSize,
    sampleSize,
  )

  let pixels: ImageData

  try {
    pixels = context.getImageData(
      0,
      0,
      sampleSize,
      sampleSize,
    )
  } catch {
    throw new Error('PIXEL_READ_FAILED')
  }

  const dominantColors =
    new Float64Array(size * size * 3)

  for (
    let gridY = 0;
    gridY < size;
    gridY += 1
  ) {
    const startY = Math.floor(
      (gridY * sampleSize) / size,
    )

    const endY = Math.max(
      startY + 1,
      Math.floor(
        ((gridY + 1) * sampleSize) /
          size,
      ),
    )

    for (
      let gridX = 0;
      gridX < size;
      gridX += 1
    ) {
      const startX = Math.floor(
        (gridX * sampleSize) / size,
      )

      const endX = Math.max(
        startX + 1,
        Math.floor(
          ((gridX + 1) * sampleSize) /
            size,
        ),
      )

      const dominant = dominantCellColor(
        pixels,
        sampleSize,
        startX,
        endX,
        startY,
        endY,
      )

      const offset =
        (gridY * size + gridX) * 3

      dominantColors[offset] =
        dominant.red

      dominantColors[offset + 1] =
        dominant.green

      dominantColors[offset + 2] =
        dominant.blue
    }
  }

  const workingColors =
    new Float64Array(dominantColors)

  const backgroundMask =
    options.removeBackground
      ? createBackgroundMask(
          dominantColors,
          size,
        )
      : new Uint8Array(size * size)

  const outlineMask = options.outline
    ? createOutlineMask(
        backgroundMask,
        size,
      )
    : new Uint8Array(size * size)

  const cells: QuantizedPixel[] = []

  const spreadError = (
    x: number,
    y: number,
    red: number,
    green: number,
    blue: number,
    weight: number,
  ) => {
    if (
      x < 0 ||
      x >= size ||
      y < 0 ||
      y >= size
    ) {
      return
    }

    const index = y * size + x

    if (
      backgroundMask[index] ||
      outlineMask[index]
    ) {
      return
    }

    const offset = index * 3

    workingColors[offset] +=
      red * weight

    workingColors[offset + 1] +=
      green * weight

    workingColors[offset + 2] +=
      blue * weight
  }

  for (
    let gridY = 0;
    gridY < size;
    gridY += 1
  ) {
    for (
      let gridX = 0;
      gridX < size;
      gridX += 1
    ) {
      const index =
        gridY * size + gridX

      const offset = index * 3

      const dominantHex = toHex(
        dominantColors[offset],
        dominantColors[offset + 1],
        dominantColors[offset + 2],
      )

      if (backgroundMask[index]) {
        cells.push({
          averageHex: dominantHex,
          hex: '#FFFDF8',
          code: '',
          name: '空白（无豆子）',
          deltaE: 0,
          isEmpty: true,
          isOutline: false,
        })

        continue
      }

      if (outlineMask[index]) {
        cells.push({
          ...OUTLINE_COLOR,
          averageHex: dominantHex,
        })

        continue
      }

      const inputRed = clampChannel(
        workingColors[offset],
      )

      const inputGreen = clampChannel(
        workingColors[offset + 1],
      )

      const inputBlue = clampChannel(
        workingColors[offset + 2],
      )

      const inputHex = toHex(
        inputRed,
        inputGreen,
        inputBlue,
      )

      const match =
        matchMardColor(inputHex)

      cells.push({
        ...match,
        averageHex: dominantHex,
        isEmpty: false,
        isOutline: false,
      })

      if (options.dithering) {
        const matched =
          hexToRgb(match.hex)

        const errorRed =
          inputRed - matched.red

        const errorGreen =
          inputGreen - matched.green

        const errorBlue =
          inputBlue - matched.blue

        spreadError(
          gridX + 1,
          gridY,
          errorRed,
          errorGreen,
          errorBlue,
          7 / 16,
        )

        spreadError(
          gridX - 1,
          gridY + 1,
          errorRed,
          errorGreen,
          errorBlue,
          3 / 16,
        )

        spreadError(
          gridX,
          gridY + 1,
          errorRed,
          errorGreen,
          errorBlue,
          5 / 16,
        )

        spreadError(
          gridX + 1,
          gridY + 1,
          errorRed,
          errorGreen,
          errorBlue,
          1 / 16,
        )
      }
    }
  }

  const mergedCells =
    mergeSimilarNeighborColors(
      cells,
      size,
      mergeThreshold,
    )

  const limitedCells = limitColorCount(
    mergedCells,
    maxColors,
  )

  canvas.width = 1
  canvas.height = 1

  const beadCount = limitedCells.reduce(
    (total, cell) =>
      total + (cell.isEmpty ? 0 : 1),
    0,
  )

  const emptyCount =
    limitedCells.length - beadCount

  return {
    size,
    cells: limitedCells,
    stats: createStatistics(limitedCells),
    beadCount,
    emptyCount,
  }
}
