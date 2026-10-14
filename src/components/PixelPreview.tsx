import type { CSSProperties } from 'react'
import type { QuantizedPixel } from '../utils/pixelate'

type PixelPreviewProps = {
  cells: QuantizedPixel[]
  size: number
  showCodes: boolean
}

function labelColor(hex: string) {
  const red = Number.parseInt(hex.slice(1, 3), 16)
  const green = Number.parseInt(hex.slice(3, 5), 16)
  const blue = Number.parseInt(hex.slice(5, 7), 16)
  return red * 0.299 + green * 0.587 + blue * 0.114 > 158 ? '#3F3340' : '#FFF9F2'
}

export function PixelPreview({ cells, size, showCodes }: PixelPreviewProps) {
  const labelSize = `${Math.max(2, Math.min(7, 140 / size))}px`

  return (
    <figure className="mx-auto w-full max-w-[540px]">
      <div className="rounded-[24px] border border-[#E8DDD4] bg-[#FFFCF8] p-3 shadow-[0_14px_36px_rgba(43,45,66,0.09)] sm:p-5">
        <div className="overflow-hidden rounded-[14px] border-2 border-white bg-white shadow-inner">
          <div
            className="pixel-grid grid aspect-square w-full bg-[#BDAFA8] p-px"
            style={{ '--grid-size': size } as CSSProperties}
            aria-label={`MARD 占位色匹配图纸，共 ${size} 乘 ${size} 格`}
            role="img"
            data-pixel-grid-size={size}
            data-show-codes={showCodes}
          >
            {cells.map((cell, index) => (
              <span
                key={`${index}-${cell.code}`}
                className="grid min-h-0 min-w-0 place-items-center overflow-hidden font-black leading-none"
                style={{ backgroundColor: cell.hex, color: labelColor(cell.hex), fontSize: labelSize }}
                aria-label={`第 ${index + 1} 格：${cell.code}，${cell.name}`}
                title={`${cell.code} · ${cell.name}`}
                data-pixel-color={cell.hex}
                data-mard-code={cell.code}
              >
                {showCodes ? cell.code.slice(-3) : null}
              </span>
            ))}
          </div>
        </div>
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-bold text-muted">
        <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-mint" aria-hidden="true" />{size} × {size} 网格 · 共 {cells.length} 颗拼豆</span>
        <span>{showCodes ? '格内数字为 MARD 色号后 3 位' : '色号已隐藏，悬停色块可查看'}</span>
      </figcaption>
    </figure>
  )
}
