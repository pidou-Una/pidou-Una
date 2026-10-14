import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, CSSProperties, DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowDownToLine,
  AlertCircle,
  Check,
  ChevronRight,
  GitFork,
  Grid3X3,
  ImageIcon,
  Info,
  LoaderCircle,
  MoonStar,
  Palette,
  Sparkles,
  UploadCloud,
} from 'lucide-react'
import { Mascot } from './components/Mascot'
import { PixelPreview } from './components/PixelPreview'
import { exportPatternAsPng } from './utils/exportPattern'
import { pixelateImage } from './utils/pixelate'
import type { PixelPattern } from './utils/pixelate'

type Notice = { id: number; message: string } | null
type PreviewMeta = { name: string; size: number; width: number; height: number }

const MAX_FILE_SIZE = 10 * 1024 * 1024
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadSectionRef = useRef<HTMLDivElement>(null)
  const previewSectionRef = useRef<HTMLElement>(null)
  const readerRef = useRef<FileReader | null>(null)
  const dragDepthRef = useRef(0)
  const [fileName, setFileName] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewMeta, setPreviewMeta] = useState<PreviewMeta | null>(null)
  const [uploadError, setUploadError] = useState('')
  const [isReading, setIsReading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [gridSize, setGridSize] = useState(50)
  const [activeTab, setActiveTab] = useState<'original' | 'pattern'>('pattern')
  const [pixelPattern, setPixelPattern] = useState<PixelPattern | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCodes, setShowCodes] = useState(false)
  const [useDithering, setUseDithering] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [notice, setNotice] = useState<Notice>(null)

  useEffect(() => () => {
    if (readerRef.current?.readyState === FileReader.LOADING) readerRef.current.abort()
  }, [])

  const showNotice = (message: string) => {
    const id = Date.now()
    setNotice({ id, message })
    window.setTimeout(() => setNotice((current) => (current?.id === id ? null : current)), 2600)
  }

  const showUploadError = (message: string) => {
    setUploadError(message)
    setIsReading(false)
  }

  const acceptFile = (file?: File) => {
    if (!file) return
    setUploadError('')

    if (file.size > MAX_FILE_SIZE) {
      showUploadError('图片超过 10MB，请压缩后再试。建议使用清晰但体积较小的图片。')
      return
    }

    if (file.size === 0) {
      showUploadError('这张图片没有可读取的内容，请换一张图片重试。')
      return
    }

    const extensionMatches = /\.(jpe?g|png)$/i.test(file.name)
    if (!SUPPORTED_IMAGE_TYPES.has(file.type) && !(file.type === '' && extensionMatches)) {
      showUploadError('暂时只支持 JPG 和 PNG 图片，请重新选择正确的文件格式。')
      return
    }

    if (readerRef.current?.readyState === FileReader.LOADING) readerRef.current.abort()
    setIsReading(true)
    const reader = new FileReader()
    readerRef.current = reader

    reader.onerror = () => showUploadError('图片读取失败，文件可能已损坏或无法访问，请重新选择。')
    reader.onabort = () => setIsReading(false)
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        showUploadError('图片读取失败，请换一张 JPG 或 PNG 图片重试。')
        return
      }

      const image = new Image()
      image.onload = () => {
        setUploadError('')
        setGenerationError('')
        setPixelPattern(null)
        setFileName(file.name)
        setPreviewUrl(reader.result as string)
        setPreviewMeta({ name: file.name, size: file.size, width: image.naturalWidth, height: image.naturalHeight })
        setIsReading(false)
        setActiveTab('original')
        showNotice('图片上传成功，原图预览已就绪')
      }
      image.onerror = () => showUploadError('无法识别这张图片，文件可能已损坏或扩展名不正确。')
      image.src = reader.result
    }

    try {
      reader.readAsDataURL(file)
    } catch {
      showUploadError('无法读取这张图片，请检查文件后重试。')
    }
  }

  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0])
    event.currentTarget.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    dragDepthRef.current = 0
    setIsDragging(false)
    if (event.dataTransfer.files.length > 1) {
      showUploadError('一次只能上传一张图片，请重新选择。')
      return
    }
    acceptFile(event.dataTransfer.files?.[0])
  }

  const openFilePicker = () => inputRef.current?.click()

  const goToUpload = () => {
    openFilePicker()
    uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const handleGridSizeChange = (nextSize: number) => {
    setGridSize(nextSize)
    setPixelPattern(null)
    setGenerationError('')
  }

  const generatePattern = async () => {
    if (!previewUrl) {
      setActiveTab('original')
      showUploadError('请先上传一张 JPG 或 PNG 图片，再生成拼豆图纸。')
      uploadSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setIsGenerating(true)
    setGenerationError('')
    const requestedSize = gridSize

    try {
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
      const pattern = await pixelateImage(previewUrl, requestedSize, { dithering: useDithering })
      setPixelPattern(pattern)
      setActiveTab('pattern')
      showNotice(`已生成 ${requestedSize} × ${requestedSize} 图纸${useDithering ? '（已启用抖动）' : ''}`)
      if (window.matchMedia('(max-width: 767px)').matches) {
        window.setTimeout(() => previewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80)
      }
    } catch {
      setGenerationError('像素化处理没有成功，请重新上传图片后再试。')
      setActiveTab('pattern')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDitheringChange = () => {
    setUseDithering((current) => !current)
    setPixelPattern(null)
    setGenerationError('')
  }

  const exportPattern = async () => {
    if (!pixelPattern) {
      setActiveTab('pattern')
      showNotice('请先生成拼豆图纸，再导出 PNG')
      return
    }

    setIsExporting(true)
    try {
      const fileName = await exportPatternAsPng(pixelPattern, showCodes)
      showNotice(`已导出 ${fileName}`)
    } catch {
      showNotice('导出失败，请稍后重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden pb-28 text-ink md:pb-10">
      <header className="relative z-20 border-b border-line/80 bg-cream/90 backdrop-blur-lg">
        <nav className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 sm:px-6" aria-label="主导航">
          <a href="#top" className="flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-coral">
            <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[13px] bg-blush shadow-soft">
              <Mascot className="size-9" decorative />
            </span>
            <span className="truncate text-[15px] font-extrabold tracking-tight sm:text-lg">拼豆图纸生成器</span>
          </a>
          <div className="flex items-center gap-1.5">
            <button className="icon-button" type="button" disabled aria-label="GitHub 仓库地址尚未设置" title="GitHub 地址稍后开放">
              <GitFork className="size-5" aria-hidden="true" />
            </button>
            <button className="icon-button relative" type="button" onClick={() => showNotice('暗色模式即将支持')} aria-label="暗色模式即将支持">
              <MoonStar className="size-5" aria-hidden="true" />
              <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-yellow ring-2 ring-cream" />
            </button>
          </div>
        </nav>
      </header>

      <main id="top">
        <section className="relative isolate overflow-hidden px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14">
          <div className="hero-dots absolute inset-0 -z-20 opacity-70" />
          <div className="absolute -right-10 top-8 -z-10 size-44 rounded-full bg-blush/60 blur-3xl sm:right-[10%]" />
          <div className="mx-auto grid max-w-7xl items-center gap-8 lg:grid-cols-[1fr_380px]">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
              <span className="mb-4 inline-flex min-h-8 items-center gap-1.5 rounded-full border border-coral/20 bg-white/75 px-3 text-xs font-bold text-coral shadow-sm">
                <Sparkles className="size-3.5" aria-hidden="true" /> 简单三步，开始拼豆
              </span>
              <h1 className="max-w-3xl text-[clamp(2.35rem,10vw,5.1rem)] font-black leading-[0.98] tracking-[-0.055em] text-ink">
                把喜欢的图片，<br />变成<span className="text-coral">拼豆图纸</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
                上传图片，选择网格大小，即可预览清晰的像素图纸和 MARD 色号用量。
              </p>
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                onClick={goToUpload}
                className="primary-button mt-7 w-full sm:w-auto sm:min-w-44"
              >
                <UploadCloud className="size-5" aria-hidden="true" /> 上传图片
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.94, rotate: 2 }}
              animate={{ opacity: 1, scale: 1, rotate: -1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="relative mx-auto hidden w-full max-w-[360px] lg:block"
              aria-hidden="true"
            >
              <div className="absolute -left-7 top-10 size-16 rotate-12 rounded-[20px] bg-yellow/80 shadow-soft" />
              <div className="absolute -right-4 bottom-12 size-12 rounded-full bg-mint/70 shadow-soft" />
              <div className="rounded-[36px] border-8 border-white/90 bg-blush p-8 shadow-[0_24px_60px_rgba(255,122,107,0.18)]">
                <Mascot kind="bunny" className="w-full drop-shadow-sm" decorative />
              </div>
            </motion.div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[minmax(310px,0.78fr)_minmax(0,1.35fr)] lg:gap-7">
          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            className="space-y-5"
            aria-label="图纸设置"
          >
            <div className="card" ref={uploadSectionRef}>
              <div className="section-heading">
                <span className="step-badge">1</span>
                <div><h2>上传图片</h2><p>支持 JPG、PNG</p></div>
              </div>
              <div
                className={`upload-zone ${isDragging ? 'upload-zone-active' : ''} ${uploadError ? 'upload-zone-error' : ''}`}
                role="button"
                tabIndex={0}
                onClick={openFilePicker}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openFilePicker()
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault()
                  dragDepthRef.current += 1
                  setIsDragging(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  dragDepthRef.current -= 1
                  if (dragDepthRef.current <= 0) {
                    dragDepthRef.current = 0
                    setIsDragging(false)
                  }
                }}
                onDrop={handleDrop}
                aria-label="选择或拖入 JPG、PNG 图片"
              >
                <input ref={inputRef} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={handleInput} />
                <span className="grid size-14 place-items-center rounded-2xl bg-blush text-coral">
                  {isReading ? <LoaderCircle className="size-7 animate-spin" /> : fileName ? <Check className="size-7" /> : <UploadCloud className="size-7" />}
                </span>
                <div className="min-w-0 text-center">
                  <p className="max-w-64 truncate font-extrabold text-ink">{isReading ? '正在读取图片…' : fileName || '点击或拖入图片'}</p>
                  <p className="mt-1 text-sm text-muted">JPG、PNG · 最大 10MB</p>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {uploadError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    role="alert"
                    className="upload-error"
                  >
                    <AlertCircle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                    <div><strong className="block">上传没有成功</strong><p className="mt-0.5 text-sm leading-5">{uploadError}</p></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="card">
              <div className="section-heading">
                <span className="step-badge">2</span>
                <div><h2>调整图纸</h2><p>设置拼豆网格与色卡</p></div>
              </div>
              <div className="mt-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label htmlFor="grid-size" className="flex items-center gap-2 text-sm font-bold"><Grid3X3 className="size-4 text-coral" />网格尺寸</label>
                  <output htmlFor="grid-size" className="rounded-lg bg-blush px-2.5 py-1 text-sm font-black text-coral">{gridSize} × {gridSize}</output>
                </div>
                <input
                  id="grid-size"
                  className="range-control"
                  type="range"
                  min="16"
                  max="100"
                  step="1"
                  value={gridSize}
                  onChange={(event) => handleGridSizeChange(Number(event.target.value))}
                  disabled={isGenerating}
                  style={{ '--range-progress': `${((gridSize - 16) / (100 - 16)) * 100}%` } as CSSProperties}
                />
                <div className="mt-1.5 flex justify-between text-xs text-muted"><span>16</span><span>100</span></div>
              </div>
              <div className="mt-5 flex min-h-16 items-center justify-between gap-4 rounded-[14px] border border-line bg-cream/65 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">抖动（Dithering）</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted">让相近颜色交错排列，过渡更自然</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useDithering}
                  aria-label="生成图纸时使用 Floyd–Steinberg 抖动"
                  onClick={handleDitheringChange}
                  disabled={isGenerating}
                  className={`relative h-11 w-[58px] shrink-0 rounded-full border transition-colors disabled:opacity-60 ${useDithering ? 'border-coral bg-coral' : 'border-line bg-[#E9DED7]'}`}
                >
                  <span
                    className={`absolute left-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full bg-cream shadow-sm transition-transform ${useDithering ? 'translate-x-[18px]' : 'translate-x-0'}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
              <div className="mt-6">
                <p className="mb-3 flex items-center gap-2 text-sm font-bold"><Palette className="size-4 text-coral" />色卡选择</p>
                <button type="button" className="palette-choice" aria-pressed="true">
                  <span className="flex -space-x-1.5" aria-hidden="true">
                    {['#FF7A6B', '#FFD166', '#4ECDC4', '#FFB9C6'].map((color) => <span key={color} className="size-7 rounded-full border-2 border-white" style={{ backgroundColor: color }} />)}
                  </span>
                  <span className="min-w-0 flex-1 text-left"><strong className="block text-sm">MARD 221 色</strong><span className="text-xs text-muted">221 色占位数据</span></span>
                  <span className="grid size-6 place-items-center rounded-full bg-mint text-white"><Check className="size-3.5" /></span>
                </button>
                <div role="note" className="mt-3 flex items-start gap-2.5 rounded-xl border border-line bg-cream/70 px-3 py-2.5 text-sm leading-5 text-muted">
                  <Info className="mt-0.5 size-4 shrink-0 text-coral/75" aria-hidden="true" />
                  <p><strong className="font-bold text-ink/75">占位色卡提示：</strong>颜色仅供参考，请以实物色卡为准。</p>
                </div>
              </div>
              <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={generatePattern} disabled={isGenerating} className="primary-button mt-6 hidden w-full disabled:cursor-wait disabled:opacity-70 md:flex">
                {isGenerating ? <LoaderCircle className="size-5 animate-spin" /> : <Sparkles className="size-5" />}{isGenerating ? '正在生成…' : '生成拼豆图纸'}
              </motion.button>
            </div>
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.1 }}
            className="card min-w-0"
            aria-labelledby="preview-title"
            ref={previewSectionRef}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="eyebrow">预览结果</p><h2 id="preview-title" className="mt-1 text-xl font-black">{activeTab === 'original' ? '原图预览' : '你的拼豆图纸'}</h2></div>
              <span className="inline-flex min-h-8 items-center rounded-full bg-mint/15 px-3 text-xs font-extrabold text-[#168D84]">
                {activeTab === 'pattern' ? pixelPattern ? `${pixelPattern.size} × ${pixelPattern.size} 已生成` : '等待生成' : previewUrl ? '原图已就绪' : '等待上传'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 rounded-xl bg-[#F7EDE8] p-1" role="tablist" aria-label="预览类型">
              {([
                ['original', '原图', ImageIcon],
                ['pattern', '拼豆图纸', Grid3X3],
              ] as const).map(([value, label, Icon]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === value}
                  onClick={() => setActiveTab(value)}
                  className={`tab-button ${activeTab === value ? 'tab-button-active' : ''}`}
                >
                  <Icon className="size-4" />{label}
                </button>
              ))}
            </div>

            {activeTab === 'pattern' && (
              <div className="mt-3 flex min-h-14 items-center justify-between gap-4 rounded-xl border border-line bg-cream/60 px-3 py-2.5 sm:px-4">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">显示色号</p>
                  <p className="mt-0.5 text-xs text-muted">默认隐藏，打开后显示色号末 3 位</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showCodes}
                  aria-label="在图纸格子中显示色号"
                  onClick={() => setShowCodes((current) => !current)}
                  className={`relative h-11 w-[58px] shrink-0 rounded-full border transition-colors ${showCodes ? 'border-coral bg-coral' : 'border-line bg-[#E9DED7]'}`}
                >
                  <span
                    className={`absolute left-1.5 top-1/2 size-8 -translate-y-1/2 rounded-full bg-cream shadow-sm transition-transform ${showCodes ? 'translate-x-[18px]' : 'translate-x-0'}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
            )}

            <div className="mt-5 rounded-[22px] border border-line bg-[#FFF4F5] p-3 sm:p-5">
              {activeTab === 'pattern' && pixelPattern ? (
                <PixelPreview cells={pixelPattern.cells} size={pixelPattern.size} showCodes={showCodes} />
              ) : activeTab === 'pattern' ? (
                <div className="grid aspect-square max-h-[520px] min-h-[280px] place-items-center rounded-[18px] border border-dashed border-coral/30 bg-cream p-8 text-center">
                  <div>
                    {isGenerating ? <LoaderCircle className="mx-auto size-12 animate-spin text-coral" /> : <Grid3X3 className="mx-auto size-12 text-coral/70" />}
                    <p className="mt-4 font-extrabold">{isGenerating ? '正在计算每个格子的平均颜色…' : '还没有生成拼豆图纸'}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">上传图片并选择网格尺寸，然后点击“生成拼豆图纸”</p>
                    {generationError && <p role="alert" className="mt-4 rounded-xl bg-danger/8 px-3 py-2 text-sm font-bold text-danger">{generationError}</p>}
                  </div>
                </div>
              ) : previewUrl && previewMeta ? (
                <figure className="overflow-hidden rounded-[18px] border border-line bg-cream shadow-sm">
                  <div className="flex min-h-[280px] max-h-[520px] items-center justify-center bg-[linear-gradient(45deg,#fff9f2_25%,#fffdf9_25%,#fffdf9_50%,#fff9f2_50%,#fff9f2_75%,#fffdf9_75%)] bg-[length:24px_24px] p-2 sm:p-4">
                    <img src={previewUrl} alt={`已上传图片：${previewMeta.name}`} className="max-h-[488px] w-full rounded-xl object-contain" />
                  </div>
                  <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white/80 px-3 py-3 text-xs sm:px-4">
                    <span className="max-w-[70%] truncate font-extrabold text-ink">{previewMeta.name}</span>
                    <span className="text-muted">{previewMeta.width} × {previewMeta.height} · {(previewMeta.size / 1024 / 1024).toFixed(2)}MB</span>
                  </figcaption>
                </figure>
              ) : (
                <div className="grid aspect-square max-h-[430px] min-h-[280px] place-items-center rounded-[18px] border border-dashed border-coral/30 bg-cream p-8 text-center">
                  <div><Mascot className="mx-auto w-32" /><p className="mt-3 font-extrabold">还没有选择原图</p><p className="mt-1 text-sm text-muted">上传 JPG 或 PNG 后会在这里显示真实预览</p></div>
                </div>
              )}
            </div>

            <div className="mt-7 flex flex-wrap items-end justify-between gap-3">
              <div><p className="eyebrow">MARD 221 色 · 占位数据</p><h3 className="mt-1 text-lg font-black">色号统计</h3></div>
              <span className="text-sm font-bold text-muted">{pixelPattern ? `共 ${pixelPattern.cells.length} 颗` : '生成后显示'}</span>
            </div>
            <div className="mt-3 overflow-hidden rounded-[16px] border border-line">
              <div className="grid grid-cols-[32px_minmax(72px,.9fr)_minmax(82px,1fr)_48px] items-center gap-2 bg-[#FAF0EC] px-3 py-2.5 text-[11px] font-bold text-muted sm:grid-cols-[40px_1fr_1.2fr_70px] sm:px-4 sm:text-xs">
                <span>色块</span><span>MARD 色号</span><span>颜色名称</span><span className="text-right">数量</span>
              </div>
              {pixelPattern ? (
                <ul className="max-h-[340px] divide-y divide-line overflow-y-auto" aria-label="MARD 占位色号统计">
                  {pixelPattern.stats.map((color) => (
                    <li key={color.code} className="grid min-h-14 grid-cols-[32px_minmax(72px,.9fr)_minmax(82px,1fr)_48px] items-center gap-2 bg-white/70 px-3 py-2.5 text-xs sm:grid-cols-[40px_1fr_1.2fr_70px] sm:px-4 sm:text-sm">
                      <span className="size-7 rounded-lg border border-black/8 shadow-sm" style={{ backgroundColor: color.hex }} aria-label={`颜色 ${color.hex}`} />
                      <strong className="truncate">{color.code}</strong>
                      <span className="truncate text-muted">{color.name}</span>
                      <span className="text-right font-extrabold">{color.count} 颗</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bg-white/60 px-4 py-8 text-center text-sm text-muted">生成拼豆图纸后，这里会统计实际使用的占位色号。</div>
              )}
            </div>

            <button type="button" onClick={exportPattern} disabled={isExporting} className="secondary-button mt-5 hidden w-full disabled:cursor-wait disabled:opacity-65 md:flex">
              {isExporting ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowDownToLine className="size-5" />}{isExporting ? '正在导出…' : '导出图纸'}<ChevronRight className="ml-auto size-4" />
            </button>
          </motion.section>
        </section>
      </main>

      <footer className="mx-auto mt-9 max-w-7xl px-4 text-center text-xs text-muted sm:px-6">
        <p>为每一颗拼豆，找到刚刚好的位置 <span aria-hidden="true">♡</span></p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-cream/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-10px_30px_rgba(43,45,66,0.08)] backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[1.3fr_1fr] gap-2.5">
          <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={generatePattern} disabled={isGenerating} className="primary-button disabled:cursor-wait disabled:opacity-70">
            {isGenerating ? <LoaderCircle className="size-5 animate-spin" /> : <Sparkles className="size-5" />}{isGenerating ? '生成中…' : '生成图纸'}
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.98 }} onClick={exportPattern} disabled={isExporting} className="secondary-button disabled:cursor-wait disabled:opacity-65">
            {isExporting ? <LoaderCircle className="size-5 animate-spin" /> : <ArrowDownToLine className="size-5" />}{isExporting ? '导出中…' : '导出'}
          </motion.button>
        </div>
      </div>

      <AnimatePresence>
        {notice && (
          <motion.div
            key={notice.id}
            initial={{ opacity: 0, y: 12, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 8, x: '-50%' }}
            role="status"
            className="fixed bottom-24 left-1/2 z-50 w-[calc(100%-32px)] max-w-md rounded-2xl bg-ink px-4 py-3 text-center text-sm font-bold text-cream shadow-2xl md:bottom-8"
          >
            {notice.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
