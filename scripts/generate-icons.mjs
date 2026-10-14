import { mkdirSync, createWriteStream } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PNG } from 'pngjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'public', 'icons')
mkdirSync(output, { recursive: true })

const colors = {
  cream: [255, 249, 242, 255],
  blush: [255, 227, 232, 255],
  pink: [239, 143, 165, 255],
  white: [255, 253, 252, 255],
  ink: [93, 72, 81, 255],
  yellow: [255, 209, 102, 255],
  coral: [255, 122, 107, 255],
  mint: [78, 205, 196, 255],
}

const grid = [
  '0000000000000000',
  '0000000000000000',
  '0011000000011000',
  '0011111111111000',
  '0112222222221100',
  '0122222222555100',
  '1222222222555510',
  '1223222223555510',
  '1223222222355510',
  '1222224422222210',
  '1222224422222210',
  '0122222222222100',
  '0112226622221100',
  '0011122222111000',
  '0001111111100000',
  '0000000000000000',
]

const lookup = { '0': colors.blush, '1': colors.pink, '2': colors.white, '3': colors.ink, '4': colors.yellow, '5': colors.coral, '6': colors.mint }

function fill(png, x, y, width, height, color) {
  for (let yy = y; yy < y + height; yy += 1) {
    for (let xx = x; xx < x + width; xx += 1) {
      if (xx < 0 || yy < 0 || xx >= png.width || yy >= png.height) continue
      const index = (png.width * yy + xx) << 2
      png.data[index] = color[0]
      png.data[index + 1] = color[1]
      png.data[index + 2] = color[2]
      png.data[index + 3] = color[3]
    }
  }
}

function roundedSquare(png, inset, radius, color) {
  const size = png.width - inset * 2
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = Math.max(radius - x, 0, x - (size - radius - 1))
      const dy = Math.max(radius - y, 0, y - (size - radius - 1))
      if (dx * dx + dy * dy <= radius * radius) fill(png, inset + x, inset + y, 1, 1, color)
    }
  }
}

function makeIcon(size, file, maskable = false) {
  const png = new PNG({ width: size, height: size })
  fill(png, 0, 0, size, size, colors.cream)
  const outerInset = maskable ? 0 : Math.round(size * 0.055)
  roundedSquare(png, outerInset, Math.round(size * 0.22), colors.blush)
  const artSize = Math.round(size * (maskable ? 0.64 : 0.76))
  const cell = Math.floor(artSize / 16)
  const actualSize = cell * 16
  const start = Math.round((size - actualSize) / 2)
  grid.forEach((row, y) => {
    ;[...row].forEach((key, x) => fill(png, start + x * cell, start + y * cell, cell, cell, lookup[key]))
  })
  png.pack().pipe(createWriteStream(resolve(output, file)))
}

makeIcon(192, 'pwa-192x192.png')
makeIcon(512, 'pwa-512x512.png')
makeIcon(512, 'pwa-maskable-512x512.png', true)
makeIcon(180, 'apple-touch-icon.png')
