/* Formulário de período de indisponibilidade (descanso combinado). */
import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import type { PeriodoIndisponibilidade } from '@/lib/types'
import { Modal } from '@/components/Modal'
import { Button, Field, Callout } from '@/components/ui'
import { feedback } from '@/components/toast'
import { validarPeriodo, sobreposicoesNaArea } from '@/domain/disponibilidade'
import { diasEntre, hojeISO, somarDias } from '@/domain/datas'
import { Dropdown } from '@/components/Dropdown'

export function PeriodoForm({ open, onClose, editar }: { open: boolean; onClose: () => void; editar?: PeriodoIndisponibilidade | null }) {
  const s = useStore()
  const me = s.realUser()
  const hoje = hojeISO()
  const politica = s.config.disponibilidade
  const [f, setF] = useState(() => ({
    inicio: editar?.inicio ?? somarDias(hoje, politica.antecedenciaSugeridaDias),
    fim: editar?.fim ?? somarDias(hoje, politica.antecedenciaSugeridaDias + 4),
    mensagemEquipe: editar?.mensagemEquipe ?? '',
    observacaoPrivada: editar?.observacaoPrivada ?? '',
    contatoContinuidadeId: editar?.contatoContinuidadeId ?? '',
    planoContinuidade: editar?.planoContinuidade ?? '',
  }))
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }))

  const colegas = s.colaboradores.filter((c) => c.status !== 'encerrado' && c.id !== me.id).sort((a, b) =>
    (a.setorId === me.setorId ? 0 : 1) - (b.setorId === me.setorId ? 0 : 1) || a.nome.localeCompare(b.nome))

  const validacao = useMemo(() => validarPeriodo(f, me.id, s.periodos, politica, hoje, editar?.id), [f, me.id, s.periodos, politica, hoje, editar?.id])
  const sobreposicoes = useMemo(() => f.inicio && f.fim && f.fim >= f.inicio
    ? sobreposicoesNaArea(f.inicio, f.fim, me.id, me.setorId, s.periodos, (id) => s.pessoa(id)?.setorId) : [], [f.inicio, f.fim, me.id, me.setorId, s])
  const dias = f.inicio && f.fim && f.fim >= f.inicio ? diasEntre(f.inicio, f.fim) + 1 : 0

  const salvar = (e: React.FormEvent) => {
    e.preventDefault()
    const r = s.registrarPeriodo({
      inicio: f.inicio, fim: f.fim,
      mensagemEquipe: f.mensagemEquipe.trim() || undefined,
      observacaoPrivada: f.observacaoPrivada.trim() || undefined,
      contatoContinuidadeId: f.contatoContinuidadeId || undefined,
      planoContinuidade: f.planoContinuidade.trim() || undefined,
    }, editar?.id)
    if (feedback(r, editar ? 'Período atualizado.' : 'Período registrado. A liderança da sua área foi avisada.')) onClose()
  }

  return (
    <Modal open={open} onClose={onClose} wide title={editar ? 'Editar período' : 'Registrar período de indisponibilidade'}
      subtitle="Informe quando você não estará disponível para os projetos. Não há saldo de dias nem aprovação hierárquica."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" type="submit" form="periodoForm" disabled={validacao.erros.length > 0}>{editar ? 'Salvar alterações' : 'Registrar período'}</Button></>}>
      <form id="periodoForm" onSubmit={salvar} noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Início" required htmlFor="p-ini"><input id="p-ini" type="date" className="input" value={f.inicio} onChange={(e) => set({ inicio: e.target.value })} required /></Field>
          <Field label="Fim" required htmlFor="p-fim" hint={dias ? `${dias} dia(s) corrido(s)` : undefined}><input id="p-fim" type="date" className="input" value={f.fim} min={f.inicio} onChange={(e) => set({ fim: e.target.value })} required /></Field>
        </div>

        {validacao.erros.length > 0 && <Callout tone="danger" icon="AlertCircle" className="mb-4">{validacao.erros[0]}</Callout>}
        {validacao.avisos.map((a) => <Callout key={a} tone="warning" icon="Clock" className="mb-4">{a}</Callout>)}
        {sobreposicoes.length > 0 && (
          <Callout tone="warning" icon="Users" className="mb-4">
            {sobreposicoes.length} pessoa(s) da sua área também estarão indisponíveis em parte dessas datas: {sobreposicoes.map((p) => s.nomeDe(p.colaboradorId).split(' ')[0]).join(', ')}.
            Isso não impede o registro — só ajuda a coordenar as entregas.
          </Callout>
        )}

        <Field label="Mensagem para a equipe" htmlFor="p-msg" hint={`Visível para a sua área e lideranças. ${f.mensagemEquipe.length}/280`}>
          <input id="p-msg" className="input" maxLength={280} value={f.mensagemEquipe} onChange={(e) => set({ mensagemEquipe: e.target.value })} placeholder="Ex.: Em descanso. Assuntos urgentes com a Ana." />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Contato para continuidade (opcional)" htmlFor="p-contato">
            <Dropdown id="p-contato" className="input" value={f.contatoContinuidadeId} onChange={(e) => set({ contatoContinuidadeId: e.target.value })}>
              <option value="">Ninguém específico</option>
              {colegas.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.setorId === me.setorId ? ' · sua área' : ''}</option>)}
            </Dropdown>
          </Field>
          <Field label="Plano de continuidade (opcional)" htmlFor="p-plano" hint="Como as entregas seguem durante o período.">
            <input id="p-plano" className="input" value={f.planoContinuidade} onChange={(e) => set({ planoContinuidade: e.target.value })} placeholder="Ex.: Entregas antecipadas para o dia 10." />
          </Field>
        </div>
        <Field label="Observação privada (opcional)" htmlFor="p-obs" hint="Visível somente para você e para o RH. Não informe dados de saúde ou outros dados sensíveis.">
          <textarea id="p-obs" className="input !h-auto py-2.5" rows={2} maxLength={500} value={f.observacaoPrivada} onChange={(e) => set({ observacaoPrivada: e.target.value })} />
        </Field>
        {editar && (editar.inicio !== f.inicio || editar.fim !== f.fim) && editar.status === 'alinhado' && (
          <Callout tone="neutral" icon="RefreshCw" className="mb-2">Ao mudar as datas, o alinhamento de continuidade anterior é desfeito e a liderança é avisada novamente.</Callout>
        )}
      </form>
    </Modal>
  )
}
