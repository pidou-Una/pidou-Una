import type { CSSProperties } from 'react'
import type { QuantizedPixel } from '../utils/pixelate'

type PixelPreviewProps = {
  cells: QuantizedPixel[]
  size: number
  showCodes: boolean
  showBoardBorder: boolean
  showMajorGrid: boolean
  showCoordinates: boolean
  beadCount: number
  emptyCount: number
}

function labelColor(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)

  return red * 0.299 + green * 0.587 + blue * 0.114 > 158
    ? '#3F3340'
    : '#FFF9F2'
}

export function PixelPreview({
  cells,
  size,
  showCodes,
  showBoardBorder,
  showMajorGrid,
  showCoordinates,
  beadCount,
  emptyCount,
}: PixelPreviewProps) {
  const labelSize = `${Math.max(
    2,
    Math.min(7, 140 / size),
  )}px`

  const rulerSize = size > 70 ? 15 : 18
  const gridStyle = {
    '--grid-size': size,
  } as CSSProperties

  return (
    <figure className="mx-auto w-full max-w-[540px]">
      <div className="rounded-[24px] border border-[#E8DDD4] bg-[#FFFCF8] p-3 shadow-[0_14px_36px_rgba(43,45,66,0.09)] sm:p-5">
        <div className="overflow-hidden rounded-[14px] border-2 border-white bg-white shadow-inner">
          <div
            className="grid bg-[#FFF9F2]"
            style={{
              gridTemplateColumns: showCoordinates
                ? `${rulerSize}px minmax(0, 1fr)`
                : 'minmax(0, 1fr)',
              gridTemplateRows: showCoordinates
                ? `${rulerSize}px minmax(0, 1fr)`
                : 'minmax(0, 1fr)',
            }}
          >
            {showCoordinates && (
              <span aria-hidden="true" />
            )}

            {showCoordinates && (
              <div
                className="pixel-grid grid min-w-0 text-center font-bold text-[#6E6262]"
                style={gridStyle}
                aria-hidden="true"
              >
                {Array.from(
                  { length: size },
                  (_, index) => (
                    <span
                      key={`top-${index}`}
                      className="grid min-w-0 place-items-center overflow-hidden"
                      style={{
                        fontSize: `${Math.max(
                          3,
                          Math.min(7, 130 / size),
                        )}px`,
                      }}
                    >
                      {index + 1}
                    </span>
                  ),
                )}
              </div>
            )}

            {showCoordinates && (
              <div
                className="grid min-h-0 text-center font-bold text-[#6E6262]"
                style={{
                  gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
                }}
                aria-hidden="true"
              >
                {Array.from(
                  { length: size },
                  (_, index) => (
                    <span
                      key={`left-${index}`}
                      className="grid min-h-0 place-items-center overflow-hidden"
                      style={{
                        fontSize: `${Math.max(
                          3,
                          Math.min(7, 130 / size),
                        )}px`,
                      }}
                    >
                      {index + 1}
                    </span>
                  ),
                )}
              </div>
            )}

            <div
              className={`pixel-grid grid aspect-square w-full bg-[#BDAFA8] p-px ${
                showBoardBorder
                  ? 'outline-[3px] outline-[#332F33]'
                  : ''
              }`}
              style={gridStyle}
              aria-label={`MARD 占位色匹配图纸，共 ${size} 乘 ${size} 格`}
              role="img"
              data-pixel-grid-size={size}
              data-show-codes={showCodes}
            >
              {cells.map((cell, index) => {
                const column = index % size
                const row = Math.floor(index / size)

                const majorRight =
                  showMajorGrid &&
                  (column + 1) % 10 === 0 &&
                  column + 1 < size

                const majorBottom =
                  showMajorGrid &&
                  (row + 1) % 10 === 0 &&
                  row + 1 < size

                return (
                  <span
                    key={`${index}-${cell.code || 'empty'}`}
                    className="grid min-h-0 min-w-0 place-items-center overflow-hidden font-black leading-none"
                    style={{
                      backgroundColor: cell.isEmpty
                        ? '#FFFDF8'
                        : cell.hex,
                      color: cell.isEmpty
                        ? 'transparent'
                        : labelColor(cell.hex),
                      fontSize: labelSize,
                      borderRight: majorRight
                        ? '1px solid #D86161'
                        : undefined,
                      borderBottom: majorBottom
                        ? '1px solid #D86161'
                        : undefined,
                    }}
                    aria-label={
                      cell.isEmpty
                        ? `第 ${index + 1} 格：空白，无豆子`
                        : `第 ${index + 1} 格：${cell.code}，${cell.name}`
                    }
                    title={
                      cell.isEmpty
                        ? '空白（无豆子）'
                        : `${cell.code} · ${cell.name}`
                    }
                    data-pixel-color={cell.hex}
                    data-mard-code={cell.code}
                    data-empty={
                      cell.isEmpty || undefined
                    }
                  >
                    {showCodes && !cell.isEmpty
                      ? cell.code.slice(-3)
                      : null}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold text-muted">
        <span className="inline-flex items-center gap-2">
          <span
            className="size-2 rounded-full bg-mint"
            aria-hidden="true"
          />
          {size} × {size} 网格 · 需 {beadCount} 颗拼豆
        </span>

        {emptyCount > 0 && (
          <span>已留白 {emptyCount} 格</span>
        )}

        <span>
          {showCodes
            ? '格内数字为 MARD 色号后 3 位'
            : '色号已隐藏，悬停色块可查看'}
        </span>
      </figcaption>
    </figure>
  )
}
