import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Treinamento } from '@/lib/types'
import { PageHeader, Card, Badge, Button, Icon, EmptyState, Field, Toggle } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'

export default function Conteudos() {
  const s = useStore()
  const me = s.realUser()
  const podeGerenciar = s.pode('onboarding:gerenciar')
  const [cat, setCat] = useState('Todas')
  const [concluir, setConcluir] = useState<Treinamento | null>(null)
  const [remover, setRemover] = useState<Treinamento | null>(null)
  const [form, setForm] = useState<{ aberto: boolean; t?: Treinamento }>({ aberto: false })
  const meus = new Map(s.progressoConteudos.filter((p) => p.colaboradorId === me.id).map((p) => [p.treinamentoId, p.concluidoEm]))
  const cats = ['Todas', ...new Set(s.treinamentos.map((t) => t.categoria))]
  const lista = s.treinamentos.filter((t) => cat === 'Todas' || t.categoria === cat)

  return (
    <>
      <PageHeader title="Conteúdos & trilhas" subtitle="Materiais de apoio e trilhas de aprendizado abertas à comunidade."
        actions={podeGerenciar && <Button icon="Plus" onClick={() => setForm({ aberto: true })}>Novo conteúdo</Button>} />
      <div className="flex flex-wrap gap-1.5 mb-5" role="group" aria-label="Filtrar por categoria">
        {cats.map((c) => <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)} className={cn('chip', cat === c && 'chip-active')}>{c}</button>)}
      </div>
      {lista.length === 0 ? <Card><EmptyState icon="BookOpen" title="Nenhum conteúdo nesta categoria" /></Card> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {lista.map((t) => {
            const feito = meus.get(t.id)
            return (
              <Card key={t.id} className="p-5 flex flex-col">
                <div className="flex items-start justify-between gap-2">
                  <span className={cn('h-11 w-11 rounded-xl flex items-center justify-center', feito ? 'bg-success-soft text-success' : 'bg-brand-50 text-brand')}><Icon name={feito ? 'BookOpenCheck' : 'BookOpen'} className="h-5 w-5" /></span>
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    <Badge tone="neutral">{t.categoria}</Badge>
                    {t.recomendado && <Badge tone="brand">Recomendado na integração</Badge>}
                  </div>
                </div>
                <h3 className="text-[15.5px] font-bold text-ink mt-4">{t.titulo}</h3>
                <p className="text-[13px] text-muted mt-1 flex-1">{t.descricao}</p>
                <div className="text-[12px] text-muted mt-3">{t.duracaoMin} min · {t.modulos} módulos</div>
                <div className="flex items-center gap-2 mt-4">
                  {feito ? <Badge tone="success" dot>Concluído em {fmtDate(feito)}</Badge>
                    : <Button size="sm" variant="soft" icon="CheckCircle2" onClick={() => setConcluir(t)}>Marcar como concluído</Button>}
                  {t.link && <a href={t.link} target="_blank" rel="noreferrer noopener" className="text-[12.5px] font-semibold text-brand ml-auto">Abrir material</a>}
                  {podeGerenciar && <span className="ml-auto flex gap-1"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label={`Editar ${t.titulo}`} onClick={() => setForm({ aberto: true, t })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover ${t.titulo}`} onClick={() => setRemover(t)} /></span>}
                </div>
              </Card>
            )
          })}
        </div>
      )}
      <p className="text-[12px] text-muted mt-6">Os conteúdos são de acesso voluntário. A conclusão é declarada por você e gera pontos uma única vez por conteúdo.</p>

      <ConfirmModal open={!!concluir} onClose={() => setConcluir(null)} perigo={false} titulo="Concluiu este conteúdo?" confirmar="Sim, concluí"
        texto={concluir ? `Confirme que você concluiu "${concluir.titulo}".` : ''}
        onConfirm={() => { if (concluir && feedback(s.concluirConteudo(concluir.id), 'Conteúdo concluído! 🎓')) setConcluir(null) }} />
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover conteúdo?" confirmar="Remover" texto={remover ? `"${remover.titulo}" sai da lista e o registro de conclusão das pessoas também.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerConteudo(remover.id), 'Conteúdo removido.')) setRemover(null) }} />
      {form.aberto && <ConteudoForm t={form.t} onClose={() => setForm({ aberto: false })} />}
    </>
  )
}

function ConteudoForm({ t, onClose }: { t?: Treinamento; onClose: () => void }) {
  const s = useStore()
  const [recomendado, setRecomendado] = useState(t?.recomendado ?? false)
  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const r = s.salvarConteudo({ titulo: d.titulo.trim(), descricao: d.descricao.trim(), categoria: d.categoria.trim() || 'Geral', duracaoMin: Number(d.duracao) || 0, modulos: Number(d.modulos) || 1, recomendado, link: d.link.trim() || undefined }, t?.id)
    if (feedback(r, t ? 'Conteúdo atualizado.' : 'Conteúdo publicado.')) onClose()
  }
  return (
    <Modal open onClose={onClose} title={t ? 'Editar conteúdo' : 'Novo conteúdo'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" type="submit" form="ctForm">Salvar</Button></>}>
      <form id="ctForm" onSubmit={salvar}>
        <Field label="Título" required htmlFor="ct-t"><input id="ct-t" name="titulo" className="input" defaultValue={t?.titulo} required /></Field>
        <Field label="Descrição" htmlFor="ct-d"><textarea id="ct-d" name="descricao" rows={2} className="input !h-auto py-2.5" defaultValue={t?.descricao} /></Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Categoria" htmlFor="ct-c"><input id="ct-c" name="categoria" className="input" defaultValue={t?.categoria ?? 'Cultura'} /></Field>
          <Field label="Duração (min)" htmlFor="ct-du"><input id="ct-du" name="duracao" type="number" min={0} className="input" defaultValue={t?.duracaoMin ?? 30} /></Field>
          <Field label="Módulos" htmlFor="ct-m"><input id="ct-m" name="modulos" type="number" min={1} className="input" defaultValue={t?.modulos ?? 1} /></Field>
        </div>
        <Field label="Link do material (opcional)" htmlFor="ct-l"><input id="ct-l" name="link" type="url" className="input" defaultValue={t?.link} placeholder="https://" /></Field>
        <Toggle checked={recomendado} onChange={setRecomendado} label="Recomendar na integração inicial" />
      </form>
    </Modal>
  )
}
