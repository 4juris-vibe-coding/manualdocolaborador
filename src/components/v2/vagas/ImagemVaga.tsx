/* Imagem de capa da vaga: envio, pré-visualização e remoção. Aparece no portal quando a vaga é publicada. */
import { useRef, useState } from 'react'
import { Button, Field } from '@/components/ui'
import { api, executar, lerBase64 } from '@/data/v2/api'

const LIMITE = 3 * 1024 * 1024

export function ImagemVaga({ vagaId, editavel, temInicial }: { vagaId: string; editavel: boolean; temInicial?: boolean }) {
  const entrada = useRef<HTMLInputElement>(null)
  const [tem, setTem] = useState(!!temInicial)
  const [versao, setVersao] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')

  async function enviar(f: File | undefined) {
    setErro('')
    if (!f) return
    if (!/^image\/(png|jpeg)$/.test(f.type)) return setErro('Use uma imagem PNG ou JPG.')
    if (f.size > LIMITE) return setErro('A imagem deve ter no máximo 3 MB.')
    setOcupado(true)
    const arquivo = await lerBase64(f).catch(() => null)
    const r = arquivo && (await executar(() => api.put(`vagas/${vagaId}/imagem`, { arquivo }), 'Imagem salva.'))
    setOcupado(false)
    if (r) { setTem(true); setVersao((v) => v + 1) }
    if (entrada.current) entrada.current.value = ''
  }
  async function remover() {
    setOcupado(true)
    const r = await executar(() => api.del(`vagas/${vagaId}/imagem`), 'Imagem removida.')
    setOcupado(false)
    if (r) { setTem(false); setVersao((v) => v + 1) }
  }

  return (
    <Field label="Imagem de capa (opcional)" hint="PNG ou JPG, até 3 MB. Aparece no portal de carreiras quando a vaga estiver publicada." erro={erro}>
      <div className="flex flex-wrap items-center gap-4">
        {tem ? (
          <img src={`${api.url(`vagas/${vagaId}/imagem`)}?v=${versao}`} alt="Imagem de capa da vaga" className="h-28 w-48 rounded-xl object-cover border border-line bg-winter" onError={() => setTem(false)} />
        ) : (
          <div className="h-28 w-48 rounded-xl border border-dashed border-line-strong bg-surface-2 flex items-center justify-center text-[12.5px] text-muted">Sem imagem</div>
        )}
        {editavel && (
          <div className="flex flex-wrap gap-2">
            <input ref={entrada} type="file" accept="image/png,image/jpeg" className="sr-only" id={`img-${vagaId}`} onChange={(e) => void enviar(e.target.files?.[0])} />
            <Button variant="ghost" icon="ImagePlus" disabled={ocupado} onClick={() => entrada.current?.click()}>{tem ? 'Trocar imagem' : 'Enviar imagem'}</Button>
            {tem && <Button variant="subtle" icon="Trash2" disabled={ocupado} onClick={() => void remover()}>Remover</Button>}
          </div>
        )}
      </div>
    </Field>
  )
}
