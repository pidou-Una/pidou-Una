import type { PixelPattern } from './pixelate'

function textColor(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  return red * 0.299 + green * 0.587 + blue * 0.114 > 158 ? '#332B36' : '#FFF9F2'
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('PNG_ENCODING_FAILED'))
    }, 'image/png')
  })
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.min(radius, width / 2, height / 2)

  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

export async function exportPatternAsPng(pattern: PixelPattern, showCodes: boolean) {
  const cellSize = Math.max(20, Math.min(36, Math.floor(2400 / pattern.size)))
  const gridPixels = pattern.size * cellSize + 1
  const margin = 48
  const columnGap = 16
  const rowGap = 14
  const cardHeight = 70
  const columns = gridPixels >= 1600 ? 5 : gridPixels >= 1100 ? 4 : 3
  const rows = Math.max(1, Math.ceil(pattern.stats.length / columns))
  const statisticsHeaderHeight = 116
  const statisticsHeight = statisticsHeaderHeight + rows * cardHeight + Math.max(0, rows - 1) * rowGap + 48
  const canvas = document.createElement('canvas')
  canvas.width = gridPixels
  canvas.height = gridPixels + statisticsHeight

  const context = canvas.getContext('2d')
  if (!context) throw new Error('CANVAS_UNAVAILABLE')

  context.imageSmoothingEnabled = false
  context.fillStyle = '#B8ABA4'
  context.fillRect(0, 0, gridPixels, gridPixels)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = `800 ${Math.max(8, Math.floor(cellSize * 0.3))}px Inter, "Noto Sans SC", sans-serif`

  pattern.cells.forEach((cell, index) => {
    const column = index % pattern.size
    const row = Math.floor(index / pattern.size)
    const x = column * cellSize + 1
    const y = row * cellSize + 1
    context.fillStyle = cell.hex
    context.fillRect(x, y, cellSize - 1, cellSize - 1)

    if (showCodes) {
      context.fillStyle = textColor(cell.hex)
      context.fillText(cell.code.slice(-3), x + (cellSize - 1) / 2, y + (cellSize - 1) / 2)
    }
  })

  const statisticsTop = gridPixels
  context.fillStyle = '#FFF9F2'
  context.fillRect(0, statisticsTop, gridPixels, statisticsHeight)

  context.strokeStyle = '#E7DCD2'
  context.lineWidth = 2
  context.beginPath()
  context.moveTo(0, statisticsTop + 1)
  context.lineTo(gridPixels, statisticsTop + 1)
  context.stroke()

  const totalBeads = pattern.stats.reduce((total, color) => total + color.count, 0)

  context.textBaseline = 'alphabetic'
  context.textAlign = 'left'
  context.fillStyle = '#2B2D42'
  context.font = '900 32px Inter, "Noto Sans SC", sans-serif'
  context.fillText('色号与用量统计', margin, statisticsTop + 54)

  context.fillStyle = '#6C757D'
  context.font = '600 20px Inter, "Noto Sans SC", sans-serif'
  context.fillText(
    `MARD 221 模拟色卡 · 共 ${totalBeads} 颗 · ${pattern.stats.length} 种颜色`,
    margin,
    statisticsTop + 86,
  )

  const cardWidth = (gridPixels - margin * 2 - columnGap * (columns - 1)) / columns
  const cardsTop = statisticsTop + statisticsHeaderHeight

  pattern.stats.forEach((color, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const x = margin + column * (cardWidth + columnGap)
    const y = cardsTop + row * (cardHeight + rowGap)

    roundedRect(context, x, y, cardWidth, cardHeight, 14)
    context.fillStyle = '#FFFDFC'
    context.fill()
    context.strokeStyle = '#E8DED6'
    context.lineWidth = 1.5
    context.stroke()

    const swatchSize = 38
    const swatchX = x + 16
    const swatchY = y + (cardHeight - swatchSize) / 2

    roundedRect(context, swatchX, swatchY, swatchSize, swatchSize, 8)
    context.fillStyle = color.hex
    context.fill()
    context.strokeStyle = 'rgba(43, 45, 66, 0.14)'
    context.lineWidth = 1
    context.stroke()

    context.textAlign = 'left'
    context.textBaseline = 'alphabetic'
    context.fillStyle = '#2B2D42'
    context.font = '800 18px Inter, "Noto Sans SC", sans-serif'
    context.fillText(color.code, swatchX + swatchSize + 13, y + 30)

    context.fillStyle = '#6C757D'
    context.font = '700 16px Inter, "Noto Sans SC", sans-serif'
    context.fillText(`${color.count} 颗`, swatchX + swatchSize + 13, y + 53)
  })

  const blob = await canvasToBlob(canvas)
  const fileName = `拼豆图纸-${pattern.size}x${pattern.size}${showCodes ? '-含色号' : ''}.png`
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
  canvas.width = 1
  canvas.height = 1
  return fileName
}
