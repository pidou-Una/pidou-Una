/**
 * TODO: 这不是 MARD 官方真实色卡数据。
 * 当前 221 个 HEX 颜色仅用于模拟常见实体拼豆的低饱和色域，
 * 后续必须替换为经过核验的官方色号、颜色名称和真实 HEX 数据。
 */

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100
  const l = lightness / 100
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const segment = ((hue % 360) + 360) % 360 / 60
  const x = chroma * (1 - Math.abs((segment % 2) - 1))
  const offset = l - chroma / 2
  const channels = segment < 1 ? [chroma, x, 0]
    : segment < 2 ? [x, chroma, 0]
      : segment < 3 ? [0, chroma, x]
        : segment < 4 ? [0, x, chroma]
          : segment < 5 ? [x, 0, chroma]
            : [chroma, 0, x]

  return `#${channels
    .map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase()
}

// 色族数量合计 221。白、粉、肤、棕、灰和深色占主体，少量冷色用于保留图像层次。
const simulatedBeadFamilies = Object.freeze([
  { count: 18, hue: 38, hueSpread: 10, saturation: [3, 15], lightness: [88, 98] },
  { count: 36, hue: 348, hueSpread: 20, saturation: [18, 48], lightness: [48, 91] },
  { count: 32, hue: 22, hueSpread: 14, saturation: [20, 52], lightness: [48, 90] },
  { count: 32, hue: 27, hueSpread: 12, saturation: [16, 46], lightness: [20, 70] },
  { count: 25, hue: 28, hueSpread: 10, saturation: [3, 14], lightness: [27, 84] },
  { count: 20, hue: 210, hueSpread: 16, saturation: [4, 16], lightness: [28, 82] },
  { count: 18, hue: 356, hueSpread: 12, saturation: [34, 58], lightness: [28, 65] },
  { count: 12, hue: 43, hueSpread: 12, saturation: [30, 58], lightness: [48, 78] },
  { count: 10, hue: 148, hueSpread: 24, saturation: [16, 34], lightness: [32, 68] },
  { count: 10, hue: 207, hueSpread: 24, saturation: [18, 38], lightness: [32, 69] },
  { count: 8, hue: 18, hueSpread: 24, saturation: [3, 18], lightness: [8, 25] },
])

function familyHex(family, localIndex) {
  const progress = family.count === 1 ? 0 : localIndex / (family.count - 1)
  const hueBand = (localIndex % 5) / 4 - 0.5
  const saturationBand = ((localIndex * 3) % 7) / 6
  const hue = family.hue + hueBand * family.hueSpread
  const saturation = family.saturation[0] + saturationBand * (family.saturation[1] - family.saturation[0])
  const lightness = family.lightness[1] - progress * (family.lightness[1] - family.lightness[0])
  return hslToHex(hue, saturation, lightness)
}

const simulatedHexColors = simulatedBeadFamilies.flatMap((family) => (
  Array.from({ length: family.count }, (_, localIndex) => familyHex(family, localIndex))
))

export const mard221 = Object.freeze(simulatedHexColors.map((hex, index) => {
  const number = String(index + 1).padStart(3, '0')
  return Object.freeze({
    code: `MARD-${number}`,
    name: `占位色${number}（模拟真实色系）`,
    hex,
  })
}))
