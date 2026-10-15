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
  dithering?: boolean
  removeBackground?: boolean
  outline?: boolean
}

type RgbColor = {
  red: number
  green: number
  blue: number
}

type PreparedMardColor = MardColor & {
  lab: LabColor
}

const SAMPLE_LIMIT = 1024

const preparedPalette: PreparedMardColor[] = mard221.map(
  (color) => ({
    ...color,
    lab: hexToLab(color.hex),
  }),
)

const matchCache = new Map<
  string,
  Omit<QuantizedPixel, 'averageHex'>
>()

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

/**
 * 判断一个网格平均色是否属于高亮、低饱和的白色背景。
 */
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
 * 从画布四周开始做四方向连通搜索。
 *
 * 只有与边缘连通的白色、高亮、低饱和区域会被识别为背景，
 * 避免把人物内部独立存在的白色区域全部误删。
 */
function createBackgroundMask(
  colors: Float64Array,
  size: number,
) {
  const mask = new Uint8Array(size * size)
  const visited = new Uint8Array(size * size)
  const queue: number[] = []

  const enqueue = (index: number) => {
    if (visited[index]) return

    visited[index] = 1

    const offset = index * 3

    const red = colors[offset]
    const green = colors[offset + 1]
    const blue = colors[offset + 2]

    if (
      isWhiteBackgroundCandidate(
        red,
        green,
        blue,
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
    // 顶边
    enqueue(position)

    // 底边
    enqueue((size - 1) * size + position)

    // 左边
    enqueue(position * size)

    // 右边
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
 * 查找主体与空白背景接触的最外圈。
 *
 * 使用八邻域检测，使斜线和圆弧轮廓也能够连续。
 */
function createOutlineMask(
  backgroundMask: Uint8Array,
  size: number,
) {
  const mask = new Uint8Array(size * size)

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x

      // 背景格本身不参与描边。
      if (backgroundMask[index]) {
        continue
      }

      let touchesBackground = false

      for (
        let offsetY = -1;
        offsetY <= 1 && !touchesBackground;
        offsetY += 1
      ) {
        for (
          let offsetX = -1;
          offsetX <= 1;
          offsetX += 1
        ) {
          if (
            offsetX === 0 &&
            offsetY === 0
          ) {
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

          const neighborIndex =
            neighborY * size + neighborX

          if (backgroundMask[neighborIndex]) {
            touchesBackground = true
            break
          }
        }
      }

      if (touchesBackground) {
        mask[index] = 1
      }
    }
  }

  return mask
}

/**
 * 使用 LAB 与 CIEDE2000 匹配最接近的模拟 MARD 颜色。
 *
 * CIEDE2000 始终优先；
 * 仅当计算结果不是有效数字时，才回退到 LAB 欧氏距离。
 */
function matchMardColor(
  averageHex: string,
): QuantizedPixel {
  const cached = matchCache.get(averageHex)

  if (cached) {
    return {
      averageHex,
      ...cached,
    }
  }

  const sourceLab = hexToLab(averageHex)

  let best = preparedPalette[0]
  let bestDelta = Number.POSITIVE_INFINITY
  let bestEuclidean = Number.POSITIVE_INFINITY

  for (const candidate of preparedPalette) {
    const calculatedDelta = deltaE2000(
      sourceLab,
      candidate.lab,
    )

    const delta = Number.isFinite(
      calculatedDelta,
    )
      ? calculatedDelta
      : labEuclidean(
          sourceLab,
          candidate.lab,
        )

    const euclidean = labEuclidean(
      sourceLab,
      candidate.lab,
    )

    if (
      delta < bestDelta ||
      (
        Math.abs(delta - bestDelta) < 1e-9 &&
        euclidean < bestEuclidean
      )
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

  matchCache.set(averageHex, match)

  return {
    averageHex,
    ...match,
  }
}

export async function pixelateImage(
  source: string,
  size: number,
  options: PixelateOptions = {},
): Promise<PixelPattern> {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error('INVALID_GRID_SIZE')
  }

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

  /**
   * 每个网格储存三个浮点数：
   * R、G、B。
   */
  const averageColors =
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
        ((gridY + 1) * sampleSize) / size,
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

      let red = 0
      let green = 0
      let blue = 0
      let count = 0

      for (
        let y = startY;
        y < endY;
        y += 1
      ) {
        for (
          let x = startX;
          x < endX;
          x += 1
        ) {
          const offset =
            (y * sampleSize + x) * 4

          red += pixels.data[offset]
          green += pixels.data[offset + 1]
          blue += pixels.data[offset + 2]
          count += 1
        }
      }

      const cellOffset =
        (gridY * size + gridX) * 3

      averageColors[cellOffset] =
        red / count

      averageColors[cellOffset + 1] =
        green / count

      averageColors[cellOffset + 2] =
        blue / count
    }
  }

  /**
   * workingColors 会被 Floyd–Steinberg
   * 误差扩散修改。
   */
  const workingColors =
    new Float64Array(averageColors)

  /**
   * 默认值由调用方控制。
   * UI 中去背景开关应默认开启。
   */
  const backgroundMask =
    options.removeBackground
      ? createBackgroundMask(
          averageColors,
          size,
        )
      : new Uint8Array(size * size)

  /**
   * 描边依赖背景蒙版。
   * UI 中描边开关应默认开启。
   */
  const outlineMask =
    options.outline
      ? createOutlineMask(
          backgroundMask,
          size,
        )
      : new Uint8Array(size * size)

  /**
   * 轮廓统一匹配到一颗接近深灰黑的豆子。
   * 最终仍会得到合法的 MARD-xxx 色号。
   */
  const outlineColor =
    matchMardColor('#302F33')

  const cells: QuantizedPixel[] = []

  const stats = new Map<
    string,
    PatternColorStat
  >()

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

    const targetIndex =
      y * size + x

    // 背景格和轮廓格不接受抖动误差。
    if (
      backgroundMask[targetIndex] ||
      outlineMask[targetIndex]
    ) {
      return
    }

    const targetOffset =
      targetIndex * 3

    workingColors[targetOffset] +=
      red * weight

    workingColors[targetOffset + 1] +=
      green * weight

    workingColors[targetOffset + 2] +=
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
      const cellIndex =
        gridY * size + gridX

      const cellOffset =
        cellIndex * 3

      const averageHex = toHex(
        averageColors[cellOffset],
        averageColors[cellOffset + 1],
        averageColors[cellOffset + 2],
      )

      /**
       * 背景格：
       * - 留白
       * - 没有色号
       * - 不进入统计
       * - 不计入豆子总数
       */
      if (backgroundMask[cellIndex]) {
        cells.push({
          averageHex,
          hex: '#FFFDF8',
          code: '',
          name: '空白（无豆子）',
          deltaE: 0,
          isEmpty: true,
          isOutline: false,
        })

        continue
      }

      /**
       * 主体最外圈：
       * - 统一使用深灰色豆子
       * - 正常计入色号统计
       */
      if (outlineMask[cellIndex]) {
        const match: QuantizedPixel = {
          ...outlineColor,
          averageHex,
          isEmpty: false,
          isOutline: true,
        }

        cells.push(match)

        const existing = stats.get(
          match.code,
        )

        if (existing) {
          existing.count += 1
        } else {
          stats.set(match.code, {
            code: match.code,
            name: '轮廓深灰',
            hex: match.hex,
            count: 1,
          })
        }

        continue
      }

      const inputRed = clampChannel(
        workingColors[cellOffset],
      )

      const inputGreen = clampChannel(
        workingColors[cellOffset + 1],
      )

      const inputBlue = clampChannel(
        workingColors[cellOffset + 2],
      )

      const matched = matchMardColor(
        toHex(
          inputRed,
          inputGreen,
          inputBlue,
        ),
      )

      const match: QuantizedPixel = {
        ...matched,
        averageHex,
        isEmpty: false,
        isOutline: false,
      }

      cells.push(match)

      const existing = stats.get(
        match.code,
      )

      if (existing) {
        existing.count += 1
      } else {
        stats.set(match.code, {
          code: match.code,
          name: match.name,
          hex: match.hex,
          count: 1,
        })
      }

      /**
       * Floyd–Steinberg 抖动：
       *
       * 右侧：7 / 16
       * 左下：3 / 16
       * 下方：5 / 16
       * 右下：1 / 16
       */
      if (options.dithering) {
        const matchedRgb =
          hexToRgb(match.hex)

        const errorRed =
          inputRed - matchedRgb.red

        const errorGreen =
          inputGreen - matchedRgb.green

        const errorBlue =
          inputBlue - matchedRgb.blue

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

  canvas.width = 1
  canvas.height = 1

  const beadCount = cells.reduce(
    (total, cell) =>
      total + (cell.isEmpty ? 0 : 1),
    0,
  )

  const emptyCount = cells.reduce(
    (total, cell) =>
      total + (cell.isEmpty ? 1 : 0),
    0,
  )

  return {
    size,
    cells,
    stats: [...stats.values()].sort(
      (left, right) =>
        right.count - left.count ||
        left.code.localeCompare(
          right.code,
        ),
    ),
    beadCount,
    emptyCount,
  }
}
