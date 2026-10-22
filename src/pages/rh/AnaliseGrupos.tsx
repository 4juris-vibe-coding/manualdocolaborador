import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Colaborador } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Avatar, EmptyState, Select, Callout, Icon } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { SeletorPessoas } from '@/components/inputs'
import { BarrasDisc } from '@/components/charts'
import { feedback } from '@/components/toast'
import { hojeISO, diasEntre } from '@/domain/datas'
import { CATEGORIAS_DISC } from '@/domain/perfil'
import { competenciasDe, notaPonderada } from '@/domain/avaliacoes'

const GRUPOS = { alto: { titulo: 'Grupo de destaque', icon: 'TrendingUp', cor: '#0f9d6b' }, desenvolvimento: { titulo: 'Grupo em desenvolvimento', icon: 'Sprout', cor: '#c98a12' } } as const

export default function AnaliseGrupos() {
  const s = useStore()
  const hoje = hojeISO()
  const [area, setArea] = useState('')
  const [funcao, setFuncao] = useState('')
  const [add, setAdd] = useState<'alto' | 'desenvolvimento' | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [analisar, setAnalisar] = useState(false)

  const filtro = (c: Colaborador) => c.status !== 'encerrado' && (!area || c.setorId === area) && (!funcao || c.cargoId === funcao)
  const doGrupo = (g: 'alto' | 'desenvolvimento') => s.classificacoesGrupo.filter((x) => x.grupo === g).map((x) => s.pessoa(x.colaboradorId)).filter((c): c is Colaborador => !!c && filtro(c))
  const semGrupo = s.colaboradores.filter((c) => filtro(c) && !s.classificacoesGrupo.some((x) => x.colaboradorId === c.id))

  const resumo = (pessoas: Colaborador[]) => {
    const anos = pessoas.map((p) => diasEntre(p.dataEntrada, hoje) / 365.25)
    const perfis = pessoas.filter((p) => p.perfil?.consentimento).map((p) => p.perfil!.disc)
    const notas = pessoas.flatMap((p) => {
      const comps = competenciasDe(p, s.competencias, 'desempenho')
      return s.respostasAvaliacao.filter((r) => s.participantesCiclo.some((x) => x.id === r.participanteId && x.avaliadoId === p.id && x.avaliadorId !== p.id))
        .map((r) => notaPonderada(r.notas, comps, s.ciclos.find((c) => c.id === r.cicloId)?.niveisEscala ?? 5)).filter((n): n is number => n != null)
    })
    const rec = pessoas.reduce((a, p) => a + s.reconhecimentos.filter((r) => r.paraId === p.id).length, 0)
    return {
      n: pessoas.length,
      tempo: anos.length ? Math.round((anos.reduce((a, b) => a + b, 0) / anos.length) * 10) / 10 : null,
      nota: notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null,
      reconhecimentos: pessoas.length ? Math.round((rec / pessoas.length) * 10) / 10 : 0,
      disc: perfis.length ? CATEGORIAS_DISC.map((d) => ({ rotulo: d.label, valor: Math.round(perfis.reduce((a, x) => a + x[d.chave], 0) / perfis.length), cor: d.cor })) : null,
      comPerfil: perfis.length,
    }
  }

  return (
    <>
      <PageHeader title="Análise de grupos" subtitle="Monte dois grupos de pessoas e compare médias agregadas (tempo de parceria, avaliações, reconhecimento e perfil)."
        actions={<><Button variant="ghost" icon="ArrowLeftRight" onClick={() => feedback(s.inverterGrupos(), 'Grupos invertidos.')}>Inverter grupos</Button><Button icon="BarChart3" onClick={() => setAnalisar(true)}>Analisar</Button></>} />
      <Callout tone="warning" icon="Scale" className="mb-5">O agrupamento é <b>manual</b>, feito pelo RH, e serve para comparar padrões. Não use o resultado como critério automático para decisões sobre contratos.</Callout>
      <div className="flex flex-wrap gap-3 mb-5">
        <Select label="Área" value={area} onChange={setArea}><option value="">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select>
        <Select label="Função" value={funcao} onChange={setFuncao}><option value="">Todas as funções</option>{s.cargos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</Select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(Object.keys(GRUPOS) as ('alto' | 'desenvolvimento')[]).map((g) => {
          const lista = doGrupo(g)
          return (
            <Card key={g}>
              <CardHead title={<span className="flex items-center gap-2"><Icon name={GRUPOS[g].icon} className="h-4 w-4" />{GRUPOS[g].titulo}</span>} sub={`${lista.length} pessoa(s)`} action={<Button size="sm" variant="soft" icon="UserPlus" onClick={() => { setAdd(g); setSel([]) }}>Adicionar</Button>} />
              {lista.length === 0 ? <EmptyState icon="Users" title="Grupo vazio" /> : (
                <ul className="divide-y divide-line">
                  {lista.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                      <Avatar pessoaId={p.id} nome={p.nome} cor={p.avatarCor} size="sm" />
                      <div className="flex-1 min-w-0"><Link to={`/rh/pessoas/${p.id}`} className="text-[13.5px] font-semibold text-ink hover:text-brand">{p.nome}</Link><div className="text-[11.5px] text-muted">{s.cargoNome(p.cargoId)} · {s.setorNome(p.setorId)}</div></div>
                      <Button size="icon-sm" variant="subtle" icon="X" aria-label={`Remover ${p.nome}`} onClick={() => feedback(s.classificarGrupo(p.id, null), 'Removido do grupo.')} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )
        })}
      </div>

      <Modal open={!!add} onClose={() => setAdd(null)} title={add ? `Adicionar ao ${GRUPOS[add].titulo.toLowerCase()}` : ''} subtitle="Pessoas sem grupo, conforme os filtros."
        footer={<><Button variant="ghost" onClick={() => setAdd(null)}>Cancelar</Button><Button icon="Check" disabled={!sel.length} onClick={() => { sel.forEach((id) => s.classificarGrupo(id, add!)); feedback({ ok: true }, `${sel.length} pessoa(s) adicionada(s).`); setAdd(null) }}>Adicionar {sel.length || ''}</Button></>}>
        <SeletorPessoas pessoas={semGrupo} selecionadas={sel} onChange={setSel} />
      </Modal>

      <Modal open={analisar} onClose={() => setAnalisar(false)} wide title="Comparação entre os grupos" subtitle="Médias agregadas; perfis só de quem consentiu."
        footer={<Button onClick={() => setAnalisar(false)}>Fechar</Button>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {(Object.keys(GRUPOS) as ('alto' | 'desenvolvimento')[]).map((g) => {
            const r = resumo(doGrupo(g))
            return (
              <div key={g} className="rounded-2xl border border-line p-4" style={{ borderTop: `4px solid ${GRUPOS[g].cor}` }}>
                <h3 className="text-[15px] font-bold text-ink">{GRUPOS[g].titulo}</h3>
                <dl className="grid grid-cols-2 gap-3 mt-3 text-[12.5px]">
                  <div><dt className="text-muted">Pessoas</dt><dd className="text-[20px] font-extrabold text-ink">{r.n}</dd></div>
                  <div><dt className="text-muted">Tempo médio de parceria</dt><dd className="text-[20px] font-extrabold text-ink">{r.tempo ?? '—'}<span className="text-[12px] font-semibold text-muted"> anos</span></dd></div>
                  <div><dt className="text-muted">Nota média nos ciclos</dt><dd className="text-[20px] font-extrabold text-ink">{r.nota ?? '—'}</dd></div>
                  <div><dt className="text-muted">Reconhecimentos/pessoa</dt><dd className="text-[20px] font-extrabold text-ink">{r.reconhecimentos}</dd></div>
                </dl>
                <h4 className="text-[11px] font-bold uppercase text-muted mt-4 mb-2">Perfil DISC médio ({r.comPerfil} com perfil)</h4>
                {r.disc ? <BarrasDisc valores={r.disc} /> : <p className="text-[12.5px] text-muted">Sem perfis consentidos no grupo.</p>}
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
