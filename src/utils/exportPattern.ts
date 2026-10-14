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

export async function exportPatternAsPng(pattern: PixelPattern, showCodes: boolean) {
  const cellSize = Math.max(20, Math.min(36, Math.floor(2400 / pattern.size)))
  const canvasSize = pattern.size * cellSize + 1
  const canvas = document.createElement('canvas')
  canvas.width = canvasSize
  canvas.height = canvasSize

  const context = canvas.getContext('2d')
  if (!context) throw new Error('CANVAS_UNAVAILABLE')

  context.imageSmoothingEnabled = false
  context.fillStyle = '#B8ABA4'
  context.fillRect(0, 0, canvasSize, canvasSize)
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
