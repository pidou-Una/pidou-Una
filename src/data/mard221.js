/**
 * TODO: 这不是 MARD 官方真实色卡数据。
 * 当前 221 个 HEX 颜色仅用于模拟常见实体拼豆的感知色域，
 * 后续必须替换为经过核验的官方色号、颜色名称和真实 HEX 数据。
 */

function hexToRgb(hex) {
  return {
    red: Number.parseInt(hex.slice(1, 3), 16),
    green: Number.parseInt(hex.slice(3, 5), 16),
    blue: Number.parseInt(hex.slice(5, 7), 16),
  }
}

function toHex(value) {
  return Math.round(Math.max(0, Math.min(255, value)))
    .toString(16)
    .padStart(2, '0')
}

function mixHex(startHex, endHex, ratio) {
  const start = hexToRgb(startHex)
  const end = hexToRgb(endHex)

  return `#${toHex(start.red + (end.red - start.red) * ratio)}${toHex(
    start.green + (end.green - start.green) * ratio,
  )}${toHex(start.blue + (end.blue - start.blue) * ratio)}`.toUpperCase()
}

function createFamily(count, anchors) {
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0 : index / (count - 1)
    const position = progress * (anchors.length - 1)
    const segment = Math.min(anchors.length - 2, Math.floor(position))
    const ratio = position - segment

    return mixHex(anchors[segment], anchors[segment + 1], ratio)
  })
}

/**
 * 共 221 色：
 * 奶油白、粉色、肤色、浅棕、深棕、暖灰、冷灰和深色占主体；
 * 少量低饱和黄、绿、蓝、紫用于保留图像层次。
 */
const families = [
  { count: 20, anchors: ['#FFFDF8', '#FAF7F0', '#F3EDE3', '#E8DFD2', '#D8CEC0'] },
  { count: 38, anchors: ['#FDEEF1', '#F8DDE4', '#EFC5CF', '#DEA6B4', '#C77D8F', '#A85E70'] },
  { count: 32, anchors: ['#FBEBDD', '#F4D8C2', '#E8BFA1', '#D5A07C', '#B77F5C', '#906047'] },
  { count: 26, anchors: ['#EBDAC5', '#D9BC99', '#BF966E', '#A77751', '#82583E'] },
  { count: 22, anchors: ['#AE8A70', '#8D6952', '#704F3E', '#50392F', '#30241F'] },
  { count: 22, anchors: ['#ECE7E0', '#D8D1C9', '#BFB6AD', '#9D958D', '#77706A'] },
  { count: 20, anchors: ['#E8EAEA', '#D3D7D8', '#B7BEBF', '#929B9E', '#697579', '#465155'] },
  { count: 12, anchors: ['#514C4D', '#403C3D', '#302D2E', '#211F20', '#121112'] },
  { count: 9, anchors: ['#F7EABD', '#E9D797', '#D4BD6F', '#B59B4E'] },
  { count: 8, anchors: ['#E0E8D9', '#C3D2B8', '#98B092', '#6E8C70'] },
  { count: 8, anchors: ['#DCE8EC', '#BCD1DA', '#91B1C0', '#668DA2'] },
  { count: 4, anchors: ['#E9E0EA', '#D0BDD2', '#AA8FAC', '#806A82'] },
]

const simulatedColors = families.flatMap(({ count, anchors }) => createFamily(count, anchors))

export const mard221 = Object.freeze(simulatedColors.map((hex, index) => {
  const number = String(index + 1).padStart(3, '0')

  return Object.freeze({
    code: `MARD-${number}`,
    name: `占位色${number}（模拟真实色系）`,
    hex,
  })
}))
