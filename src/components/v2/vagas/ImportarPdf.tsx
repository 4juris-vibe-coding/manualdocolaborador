import { useRef, useState } from 'react'
import { Button } from '@/components/ui'
import { ErroApi, api, lerBase64 } from '@/data/v2/api'
import { toast } from '@/components/toast'
import type { VagaImportada } from '@/domain/v2/vagaImportada'

const LIMITE = 3 * 1024 * 1024

/** Botão "Importar PDF": envia o PDF (vaga, ou o que a `rota` ler), o servidor lê e devolve os campos para preencher o formulário. */
export function BotaoImportarPdf<T = VagaImportada>({ aoImportar, size, variant = 'ghost', rotulo = 'Importar PDF', rota = 'vagas/importar' }: {
  aoImportar: (c: T) => void; size?: 'sm' | 'md'; variant?: 'ghost' | 'primary'; rotulo?: string; rota?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [lendo, setLendo] = useState(false)

  const escolher = async (f: File | undefined) => {
    if (input.current) input.current.value = ''
    if (!f) return
    if (f.type && f.type !== 'application/pdf' && !/\.pdf$/i.test(f.name)) { toast('Envie um arquivo PDF.', 'danger'); return }
    if (f.size > LIMITE) { toast('PDF maior que 3 MB.', 'danger'); return }
    setLendo(true)
    try {
      const d = await api.post(rota, { arquivo: await lerBase64(f) })
      aoImportar(d.campos as T)
    } catch (e) {
      toast(e instanceof ErroApi ? e.message : 'Não foi possível ler o PDF. Tente novamente.', 'danger')
    } finally { setLendo(false) }
  }

  return (
    <>
      <input ref={input} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => void escolher(e.target.files?.[0])} />
      <Button size={size} variant={variant} icon="Upload" disabled={lendo} onClick={() => input.current?.click()}>{lendo ? 'Lendo o PDF…' : rotulo}</Button>
    </>
  )
}
