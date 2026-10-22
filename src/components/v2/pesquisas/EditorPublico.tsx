/* Definição do público: critérios combinados + contagem estimada vinda do servidor (mesma regra da publicação). */
import { useEffect, useMemo, useState } from 'react'
import { Callout, Card, Toggle } from '@/components/ui'
import { SeletorPessoas } from '@/components/inputs'
import { api } from '@/data/v2/api'
import { useStore } from '@/lib/store'
import type { CriteriosPublico } from '@/domain/v2/pesquisaTipos'

interface Estimativa { total: number; jaConvidados: number; novos: number; porArea: { setorId: string; area: string; n: number }[]; regra: string }

function Lista({ titulo, itens, marcados, onChange, desabilitado }: { titulo: string; itens: { id: string; nome: string }[]; marcados: string[]; onChange: (ids: string[]) => void; desabilitado?: boolean }) {
  return (
    <fieldset disabled={desabilitado} className="border border-line rounded-xl p-3 min-w-0">
      <legend className="text-[12px] font-bold uppercase tracking-wide text-muted px-1">{titulo}</legend>
      {itens.length === 0 ? <p className="text-[12.5px] text-muted">Nenhum cadastrado.</p> : (
        <ul className="max-h-40 overflow-y-auto space-y-0.5">
          {itens.map((i) => (
            <li key={i.id}><label className="flex items-center gap-2 text-[13.5px] py-1 cursor-pointer">
              <input type="checkbox" className="accent-[rgb(var(--c-brand))]" checked={marcados.includes(i.id)} onChange={() => onChange(marcados.includes(i.id) ? marcados.filter((x) => x !== i.id) : [...marcados, i.id])} />
              <span className="truncate">{i.nome}</span></label></li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

export function EditorPublico({ pesquisaId, publico, onChange, desabilitado }: { pesquisaId: string; publico: CriteriosPublico; onChange: (c: CriteriosPublico) => void; desabilitado?: boolean }) {
  const setores = useStore((s) => s.setores)
  const unidades = useStore((s) => s.unidades)
  const cargos = useStore((s) => s.cargos)
  const pessoas = useStore((s) => s.colaboradores)
  const [est, setEst] = useState<Estimativa>()
  const [erro, setErro] = useState<string>()
  const gestores = useMemo(() => {
    const ids = new Set(pessoas.map((p) => p.responsavelId).filter(Boolean) as string[])
    return pessoas.filter((p) => ids.has(p.id)).map((p) => ({ id: p.id, nome: p.nomeSocial || p.nome }))
  }, [pessoas])
  const ativas = useMemo(() => pessoas.filter((p) => p.status !== 'encerrado'), [pessoas])
  const set = (patch: Partial<CriteriosPublico>) => onChange({ ...publico, ...patch })

  const chave = JSON.stringify(publico)
  useEffect(() => {
    let vivo = true
    const t = setTimeout(() => {
      api.post<Estimativa>(`pesquisas/${pesquisaId}/elegiveis`, { publico })
        .then((d) => { if (vivo) { setEst(d); setErro(undefined) } })
        .catch((e) => { if (vivo) setErro(e.message) })
    }, 350)
    return () => { vivo = false; clearTimeout(t) }
  }, [chave, pesquisaId])

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <Toggle checked={!!publico.todos} onChange={(v) => set({ todos: v || undefined })} label="Todas as pessoas ativas" disabled={desabilitado} />
        <p className="text-[12.5px] text-muted mt-2">Desligue para combinar critérios. Entre critérios diferentes vale “e” (ex.: área Jurídico <b>e</b> cargo Advogado); dentro de cada critério vale “ou”.</p>
        {!publico.todos && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 mt-4">
            <Lista titulo="Unidades" itens={unidades.map((u) => ({ id: u.id, nome: u.nome }))} marcados={publico.unidadeIds ?? []} onChange={(v) => set({ unidadeIds: v })} desabilitado={desabilitado} />
            <Lista titulo="Áreas / equipes" itens={setores.map((s) => ({ id: s.id, nome: s.nome }))} marcados={publico.setorIds ?? []} onChange={(v) => set({ setorIds: v })} desabilitado={desabilitado} />
            <Lista titulo="Gestor imediato (equipe)" itens={gestores} marcados={publico.gestorIds ?? []} onChange={(v) => set({ gestorIds: v })} desabilitado={desabilitado} />
            <Lista titulo="Funções / cargos" itens={cargos.map((c) => ({ id: c.id, nome: c.nome }))} marcados={publico.cargoIds ?? []} onChange={(v) => set({ cargoIds: v })} desabilitado={desabilitado} />
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-[14px] font-bold text-ink mb-1">Incluir pessoas específicas</h3>
          <p className="text-[12.5px] text-muted mb-3">São somadas ao público acima.</p>
          <SeletorPessoas pessoas={ativas} selecionadas={publico.pessoaIds ?? []} onChange={(v) => set({ pessoaIds: v })} />
        </Card>
        <Card className="p-5">
          <h3 className="text-[14px] font-bold text-ink mb-1">Excluir pessoas</h3>
          <p className="text-[12.5px] text-muted mb-3">Sempre retiradas do público.</p>
          <SeletorPessoas pessoas={ativas} selecionadas={publico.excluirIds ?? []} onChange={(v) => set({ excluirIds: v })} />
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="text-[14px] font-bold text-ink mb-2">Público elegível agora</h3>
        {erro ? <p className="text-[13px] text-danger">{erro}</p> : !est ? <p className="text-[13px] text-muted">Calculando…</p> : (
          <>
            <div className="text-[30px] font-extrabold text-ink leading-none">{est.total} <span className="text-[14px] font-medium text-muted">{est.total === 1 ? 'pessoa' : 'pessoas'}</span></div>
            {est.jaConvidados > 0 && <p className="text-[12.5px] text-muted mt-1">{est.jaConvidados} já convidadas · {est.novos} ainda sem convite</p>}
            {est.porArea.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{est.porArea.map((a) => <li key={a.setorId} className="text-[12px] rounded-full bg-winter px-2.5 py-1 text-ink-2">{a.area}: <b>{a.n}</b></li>)}</ul>}
            {est.total === 0 && <Callout tone="warning" icon="AlertTriangle" className="mt-3">Nenhuma pessoa elegível: marque “Todas as pessoas ativas” ou escolha critérios.</Callout>}
            <p className="text-[11.5px] text-muted mt-3">{est.regra} A elegibilidade é recalculada até o fechamento; quem entrar depois só recebe convite quando o RH usar “Convidar novos”.</p>
          </>
        )}
      </Card>
    </div>
  )
}
