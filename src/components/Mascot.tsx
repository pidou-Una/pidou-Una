type MascotProps = {
  kind?: 'cat' | 'bunny'
  className?: string
  decorative?: boolean
}

export function Mascot({ kind = 'cat', className = '', decorative = false }: MascotProps) {
  const bunny = kind === 'bunny'

  return (
    <svg
      viewBox="0 0 120 120"
      className={className}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : bunny ? '原创粉色兔耳像素吉祥物' : '原创粉色猫咪像素吉祥物'}
      shapeRendering="crispEdges"
    >
      {bunny ? (
        <>
          <path fill="#FFB9C6" d="M30 8h18v12H30zM24 20h24v36H24zM72 8h18v12H72zM72 20h24v36H72z" />
          <path fill="#FFF1F4" d="M32 16h8v32h-8zM80 16h8v32h-8z" />
          <path fill="#EF8FA5" d="M18 48h84v12H18zM12 60h96v36H12zM24 96h72v12H24z" />
        </>
      ) : (
        <>
          <path fill="#EF8FA5" d="M18 24h18v12H18zM84 24h18v12H84zM12 36h96v54H12zM24 90h72v18H24z" />
          <path fill="#FFF1F4" d="M24 36h72v12H24z" />
        </>
      )}
      <path fill="#FFFDFC" d="M24 48h72v42H24zM36 42h48v54H36z" />
      <path fill="#5D4851" d="M38 65h8v10h-8zM74 65h8v10h-8z" />
      <path fill="#FFD166" d="M57 75h8v6h-8z" />
      <path fill="#FF7A6B" d="M74 40h12v8H74zM86 34h12v20H86zM98 40h8v8h-8z" />
      <path fill="#4ECDC4" d="M48 92h24v8H48z" />
    </svg>
  )
}
