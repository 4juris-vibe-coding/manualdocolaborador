/* Foto de perfil: avatar com botão de troca e editor com recorte circular (arrastar, zoom e girar).
   O recorte sai do navegador já pronto (JPEG 384×384); o servidor só valida e guarda. */
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Avatar, Button, Icon } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { MODO_API } from '@/data/config'
import { ErroApi } from '@/data/v2/api'
import { enviarFoto, removerFoto, useUrlFoto } from '@/data/v2/fotos'
import { cn } from '@/lib/utils'

const VISOR = 280        // lado do visor de recorte (px de tela)
const SAIDA = 384        // lado da imagem gravada
const ZOOM_MAX = 4
const LIMITE_ORIGINAL = 15 * 1024 * 1024

interface Pessoa { id: string; nome: string; avatarCor?: string }

/** Avatar grande com o botão de câmera para quem pode alterar a foto (a própria pessoa ou o RH). */
export function FotoPerfil({ pessoa, podeEditar, className }: { pessoa: Pessoa; podeEditar: boolean; className?: string }) {
  const [aberto, setAberto] = useState(false)
  const editar = podeEditar && MODO_API
  return (
    <div className={cn('relative shrink-0', className)}>
      <Avatar pessoaId={pessoa.id} nome={pessoa.nome} cor={pessoa.avatarCor} size="xl" />
      {editar && <>
        <button type="button" onClick={() => setAberto(true)} aria-label="Alterar foto de perfil" title="Alterar foto"
          className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-brand text-white border-2 border-surface flex items-center justify-center shadow-sm hover:bg-brand-700 outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
          <Icon name="Camera" className="h-4 w-4" />
        </button>
        <FotoModal pessoa={pessoa} open={aberto} onClose={() => setAberto(false)} />
      </>}
    </div>
  )
}

function FotoModal({ pessoa, open, onClose }: { pessoa: Pessoa; open: boolean; onClose: () => void }) {
  const atual = useUrlFoto(pessoa.id)
  const [src, setSrc] = useState<string | null>(null)
  const [nat, setNat] = useState({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [giro, setGiro] = useState(0)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [ocupado, setOcupado] = useState(false)
  const [sobre, setSobre] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  const arquivo = useRef<HTMLInputElement>(null)
  const arraste = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => () => { if (src) URL.revokeObjectURL(src) }, [src])
  useEffect(() => { if (!open) { setSrc(null); setNat({ w: 0, h: 0 }) } }, [open])

  // escala que faz a imagem cobrir o visor; o zoom multiplica a partir dela
  const deitada = giro % 180 !== 0
  const ew = deitada ? nat.h : nat.w, eh = deitada ? nat.w : nat.h
  const escala = ew && eh ? Math.max(VISOR / ew, VISOR / eh) * zoom : 1
  const limitar = (p: { x: number; y: number }, z = zoom, g = giro) => {
    const dl = g % 180 !== 0, w = dl ? nat.h : nat.w, h = dl ? nat.w : nat.h
    if (!w || !h) return p
    const e = Math.max(VISOR / w, VISOR / h) * z
    const mx = Math.max(0, (w * e - VISOR) / 2), my = Math.max(0, (h * e - VISOR) / 2)
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) }
  }
  const mudarZoom = (z: number) => { const n = Math.min(ZOOM_MAX, Math.max(1, z)); setZoom(n); setPos((p) => limitar(p, n)) }

  function escolher(f: File | undefined | null) {
    if (!f) return
    if (!f.type.startsWith('image/')) { toast('Escolha um arquivo de imagem (JPG, PNG ou WEBP).', 'danger'); return }
    if (f.size > LIMITE_ORIGINAL) { toast('Imagem muito grande. Escolha uma de até 15 MB.', 'danger'); return }
    setNat({ w: 0, h: 0 }); setZoom(1); setGiro(0); setPos({ x: 0, y: 0 })
    setSrc(URL.createObjectURL(f))
  }

  function soltarPonteiro(e: ReactPointerEvent) { if (arraste.current?.id === e.pointerId) arraste.current = null }
  function moverPonteiro(e: ReactPointerEvent) {
    const a = arraste.current
    if (!a || a.id !== e.pointerId) return
    setPos(limitar({ x: a.px + e.clientX - a.x, y: a.py + e.clientY - a.y }))
  }

  async function salvar() {
    const el = img.current
    if (!el || !nat.w) return
    const cv = document.createElement('canvas')
    cv.width = cv.height = SAIDA
    const ctx = cv.getContext('2d')!
    const k = SAIDA / VISOR
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, SAIDA, SAIDA)
    ctx.imageSmoothingQuality = 'high'
    ctx.translate(SAIDA / 2 + pos.x * k, SAIDA / 2 + pos.y * k)
    ctx.rotate((giro * Math.PI) / 180)
    ctx.scale(escala * k, escala * k)
    ctx.drawImage(el, -nat.w / 2, -nat.h / 2)
    const blob = await new Promise<Blob | null>((ok) => cv.toBlob(ok, 'image/jpeg', 0.88))
    if (!blob) { toast('Não foi possível preparar a imagem.', 'danger'); return }
    setOcupado(true)
    try { await enviarFoto(pessoa.id, blob); toast('Foto atualizada.'); onClose() }
    catch (e) { toast(e instanceof ErroApi ? e.message : 'Não foi possível salvar a foto.', 'danger') }
    finally { setOcupado(false) }
  }

  async function remover() {
    setOcupado(true)
    try { await removerFoto(pessoa.id); toast('Foto removida.'); onClose() }
    catch (e) { toast(e instanceof ErroApi ? e.message : 'Não foi possível remover a foto.', 'danger') }
    finally { setOcupado(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Foto de perfil" subtitle="Aparece no diretório, no organograma e onde o seu nome for exibido."
      footer={<>
        {atual && !src && <Button variant="danger" icon="Trash2" className="mr-auto" disabled={ocupado} onClick={remover}>Remover foto</Button>}
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        {src && <Button icon="Check" disabled={ocupado || !nat.w} onClick={salvar}>{ocupado ? 'Salvando…' : 'Salvar foto'}</Button>}
      </>}>
      <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { escolher(e.target.files?.[0]); e.target.value = '' }} />
      {!src ? (
        <div onDragOver={(e) => { e.preventDefault(); setSobre(true) }} onDragLeave={() => setSobre(false)}
          onDrop={(e) => { e.preventDefault(); setSobre(false); escolher(e.dataTransfer.files[0]) }}
          className={cn('flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed p-6 text-center transition', sobre ? 'border-brand bg-brand-50' : 'border-line')}>
          <Avatar pessoaId={pessoa.id} nome={pessoa.nome} cor={pessoa.avatarCor} size="xl" className="!h-28 !w-28 !text-[36px]" />
          <p className="text-[13px] text-muted">Arraste uma imagem para cá ou escolha do seu dispositivo. Depois você ajusta o enquadramento.</p>
          <Button icon="Upload" onClick={() => arquivo.current?.click()}>{atual ? 'Trocar foto' : 'Escolher foto'}</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <div role="img" aria-label="Pré-visualização do recorte. Arraste para enquadrar; use as setas do teclado para mover." tabIndex={0}
            className="relative overflow-hidden rounded-2xl bg-midnight touch-none select-none cursor-grab active:cursor-grabbing outline-none focus-visible:ring-2 focus-visible:ring-brand"
            style={{ width: VISOR, height: VISOR }}
            onPointerDown={(e) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); arraste.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: pos.x, py: pos.y } }}
            onPointerMove={moverPonteiro} onPointerUp={soltarPonteiro} onPointerCancel={soltarPonteiro}
            onWheel={(e) => mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
            onKeyDown={(e) => {
              const d = e.shiftKey ? 20 : 5
              const m: Record<string, [number, number]> = { ArrowLeft: [d, 0], ArrowRight: [-d, 0], ArrowUp: [0, d], ArrowDown: [0, -d] }
              if (m[e.key]) { e.preventDefault(); setPos((p) => limitar({ x: p.x + m[e.key][0], y: p.y + m[e.key][1] })) }
              else if (e.key === '+' || e.key === '=') mudarZoom(zoom + 0.1)
              else if (e.key === '-') mudarZoom(zoom - 0.1)
            }}>
            <img ref={img} src={src} alt="" draggable={false}
              onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              onError={() => { toast('Não foi possível abrir esta imagem. Tente JPG ou PNG.', 'danger'); setSrc(null) }}
              className="absolute left-1/2 top-1/2 max-w-none pointer-events-none"
              style={{ width: nat.w || undefined, height: nat.h || undefined, visibility: nat.w ? 'visible' : 'hidden', transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px)) rotate(${giro}deg) scale(${escala})` }} />
            {/* máscara: escurece fora do círculo que vira a foto */}
            <div aria-hidden className="absolute inset-0 pointer-events-none rounded-full" style={{ boxShadow: '0 0 0 9999px rgba(10,19,24,.6)' }} />
            <div aria-hidden className="absolute inset-0 pointer-events-none rounded-full border-2 border-white/80" />
          </div>
          <div className="w-full max-w-[320px] flex items-center gap-3">
            <Icon name="ZoomOut" className="h-4 w-4 text-muted shrink-0" />
            <input type="range" min={1} max={ZOOM_MAX} step={0.01} value={zoom} onChange={(e) => mudarZoom(+e.target.value)} aria-label="Zoom" className="flex-1" style={{ '--p': `${((zoom - 1) / (ZOOM_MAX - 1)) * 100}%` } as React.CSSProperties} />
            <Icon name="ZoomIn" className="h-4 w-4 text-muted shrink-0" />
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button size="sm" variant="ghost" icon="RotateCw" onClick={() => { const g = (giro + 90) % 360; setGiro(g); setPos((p) => limitar(p, zoom, g)) }}>Girar</Button>
            <Button size="sm" variant="ghost" icon="Maximize" onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }) }}>Centralizar</Button>
            <Button size="sm" variant="ghost" icon="ImagePlus" onClick={() => arquivo.current?.click()}>Outra imagem</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
