import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { CategoriaSugestao, Sugestao } from '@/lib/types'
import { Button, Field, Callout } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { feedback } from '@/components/toast'

export const CATEGORIAS_SUG: CategoriaSugestao[] = ['Processos', 'Cultura', 'Ferramentas', 'Eventos', 'Benefícios', 'Comunicação', 'Outros']
/** Formulário de envio/edição — usado na página e no botão flutuante. */
export function SugestaoForm({ sugestao, onClose }: { sugestao?: Sugestao; onClose: () => void }) {
  const s = useStore()
  const [f, setF] = useState({ titulo: sugestao?.titulo ?? '', descricao: sugestao?.descricao ?? '', categoria: (sugestao?.categoria ?? 'Processos') as CategoriaSugestao })
  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const r = sugestao ? s.editarSugestao(sugestao.id, f) : s.enviarSugestao(f)
    if (feedback(r, sugestao ? 'Sugestão atualizada.' : 'Sugestão enviada de forma anônima. Obrigado por contribuir! 💡')) onClose()
  }
  return (
    <Modal open onClose={onClose} wide title={sugestao ? 'Editar sugestão' : 'Nova sugestão'} subtitle="Ela aparece para todos no quadro, sem o seu nome."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon={sugestao ? 'Check' : 'Send'} type="submit" form="sugForm">{sugestao ? 'Salvar' : 'Enviar anonimamente'}</Button></>}>
      <form id="sugForm" onSubmit={enviar} noValidate>
        <Callout tone="brand" icon="EyeOff" className="mb-4">
          <b>Anônima de verdade:</b> nem o RH nem ninguém vê quem enviou. Você é reconhecido(a) só neste navegador para poder <b>editar ou excluir</b> enquanto estiver aguardando análise.
          Evite citar nomes ou dados pessoais no texto.
        </Callout>
        <Field label="Título" required htmlFor="sg-t" hint={`${f.titulo.length}/100`}><input id="sg-t" className="input" maxLength={100} value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Resumo mensal dos comunicados" /></Field>
        <Field label="Categoria" htmlFor="sg-c"><select id="sg-c" className="input" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value as CategoriaSugestao })}>{CATEGORIAS_SUG.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Descreva a ideia" required htmlFor="sg-d" hint={`${f.descricao.length}/800 · o que muda e que problema isso resolve?`}><textarea id="sg-d" className="input !h-auto py-2.5" rows={5} maxLength={800} value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
      </form>
    </Modal>
  )
}

