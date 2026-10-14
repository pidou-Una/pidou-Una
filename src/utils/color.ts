export type LabColor = {
  l: number
  a: number
  b: number
}

const degreesToRadians = (degrees: number) => (degrees * Math.PI) / 180
const radiansToDegrees = (radians: number) => (radians * 180) / Math.PI

export function hexToLab(hex: string): LabColor {
  const normalized = hex.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(normalized)) throw new Error('INVALID_HEX_COLOR')

  const channels = [0, 2, 4].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255)
  const [red, green, blue] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ))

  const x = ((red * 0.4124564 + green * 0.3575761 + blue * 0.1804375) * 100) / 95.047
  const y = ((red * 0.2126729 + green * 0.7151522 + blue * 0.072175) * 100) / 100
  const z = ((red * 0.0193339 + green * 0.119192 + blue * 0.9503041) * 100) / 108.883
  const transform = (value: number) => (
    value > 216 / 24389 ? Math.cbrt(value) : ((24389 / 27) * value + 16) / 116
  )
  const fx = transform(x)
  const fy = transform(y)
  const fz = transform(z)

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  }
}

export function labEuclidean(left: LabColor, right: LabColor) {
  return Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b)
}

export function deltaE2000(left: LabColor, right: LabColor) {
  const c1 = Math.hypot(left.a, left.b)
  const c2 = Math.hypot(right.a, right.b)
  const cAverage = (c1 + c2) / 2
  const cAverage7 = cAverage ** 7
  const g = 0.5 * (1 - Math.sqrt(cAverage7 / (cAverage7 + 25 ** 7)))
  const a1Prime = (1 + g) * left.a
  const a2Prime = (1 + g) * right.a
  const c1Prime = Math.hypot(a1Prime, left.b)
  const c2Prime = Math.hypot(a2Prime, right.b)
  const hue = (a: number, b: number) => {
    const degrees = radiansToDegrees(Math.atan2(b, a))
    return degrees >= 0 ? degrees : degrees + 360
  }
  const h1Prime = c1Prime === 0 ? 0 : hue(a1Prime, left.b)
  const h2Prime = c2Prime === 0 ? 0 : hue(a2Prime, right.b)
  const deltaLPrime = right.l - left.l
  const deltaCPrime = c2Prime - c1Prime
  const rawHueDifference = h2Prime - h1Prime
  const deltaHuePrime = c1Prime * c2Prime === 0 ? 0
    : Math.abs(rawHueDifference) <= 180 ? rawHueDifference
      : rawHueDifference > 180 ? rawHueDifference - 360
        : rawHueDifference + 360
  const deltaHPrime = 2 * Math.sqrt(c1Prime * c2Prime) * Math.sin(degreesToRadians(deltaHuePrime / 2))
  const lAverage = (left.l + right.l) / 2
  const cPrimeAverage = (c1Prime + c2Prime) / 2
  const huePrimeAverage = c1Prime * c2Prime === 0 ? h1Prime + h2Prime
    : Math.abs(h1Prime - h2Prime) <= 180 ? (h1Prime + h2Prime) / 2
      : h1Prime + h2Prime < 360 ? (h1Prime + h2Prime + 360) / 2
        : (h1Prime + h2Prime - 360) / 2
  const t = 1
    - 0.17 * Math.cos(degreesToRadians(huePrimeAverage - 30))
    + 0.24 * Math.cos(degreesToRadians(2 * huePrimeAverage))
    + 0.32 * Math.cos(degreesToRadians(3 * huePrimeAverage + 6))
    - 0.2 * Math.cos(degreesToRadians(4 * huePrimeAverage - 63))
  const lOffset = (lAverage - 50) ** 2
  const sL = 1 + (0.015 * lOffset) / Math.sqrt(20 + lOffset)
  const sC = 1 + 0.045 * cPrimeAverage
  const sH = 1 + 0.015 * cPrimeAverage * t
  const deltaTheta = 30 * Math.exp(-(((huePrimeAverage - 275) / 25) ** 2))
  const cPrimeAverage7 = cPrimeAverage ** 7
  const rC = 2 * Math.sqrt(cPrimeAverage7 / (cPrimeAverage7 + 25 ** 7))
  const rT = -rC * Math.sin(degreesToRadians(2 * deltaTheta))
  const lTerm = deltaLPrime / sL
  const cTerm = deltaCPrime / sC
  const hTerm = deltaHPrime / sH

  return Math.sqrt(lTerm ** 2 + cTerm ** 2 + hTerm ** 2 + rT * cTerm * hTerm)
}
