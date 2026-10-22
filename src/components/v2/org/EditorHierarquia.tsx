/* ============================================================
   Montar a hierarquia: define, para cada pessoa, a quem ela responde.
   - Nada é gravado até clicar em "Salvar hierarquia".
   - A sugestão usa SÓ a liderança cadastrada da área (gestor da área) e o topo
     escolhido; é um ponto de partida que você revisa, nunca uma dedução silenciosa.
   - Cada troca passa pela mesma validação do servidor (sem ciclos, sem gestor inativo).
   - O topo (CEO) é gravado no cadastro: fica sem superior e não é encaixado
     abaixo do líder da própria área.
   ============================================================ */
import { useMemo, useState } from 'react'
import { Avatar, Button, Callout, Card, CardHead, SearchBox, Select } from '@/components/ui'
import { useStore } from '@/lib/store'
import { useSync } from '@/data/sync'
import { toast } from '@/components/toast'
import { validarMudancaGestor } from '@/domain/v2/organograma'

async function aguardarGravacao(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 900))
  for (let i = 0; i < 60; i++) {
    const s = useSync.getState()
    if (!s.salvando) return !s.erro
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

export function EditorHierarquia({ onSalvo }: { onSalvo: () => void }) {
  const colaboradores = useStore((s) => s.colaboradores)
  const setores = useStore((s) => s.setores)
  const cargoNome = useStore((s) => s.cargoNome)
  const salvarPessoa = useStore((s) => s.salvarPessoa)
  const ativos = useMemo(() => colaboradores.filter((c) => c.status !== 'encerrado'), [colaboradores])
  const [mudancas, setMudancas] = useState<Record<string, string>>({}) // id → gestorId ('' = sem gestor / topo)
  const topoSalvo = useMemo(() => colaboradores.find((c) => c.topoOrganizacao && c.status !== 'encerrado')?.id ?? '', [colaboradores])
  const [topo, setTopo] = useState(topoSalvo)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState(false)

  const atual = (id: string) => (id === topo ? '' : id in mudancas ? mudancas[id] : colaboradores.find((c) => c.id === id)?.responsavelId ?? '')
  const efetivas = useMemo(() => colaboradores.map((c) => ({ id: c.id, nome: c.nome, status: c.status, responsavelId: atual(c.id) || null, setorId: c.setorId })), [colaboradores, mudancas, topo]) // eslint-disable-line react-hooks/exhaustive-deps

  const erroDe = (id: string): string | null => {
    const g = atual(id)
    if (!g) return null
    const v = validarMudancaGestor(efetivas.map((p) => (p.id === id ? { ...p, responsavelId: null } : p)), id, g)
    return v.erros[0] ?? null
  }
  const erros = ativos.filter((c) => erroDe(c.id)).length
  const topoMudou = topo !== topoSalvo
  const pendentesTotal = Object.keys(mudancas).filter((id) => id !== topo && (mudancas[id] || '') !== (colaboradores.find((c) => c.id === id)?.responsavelId ?? '')).length + (topoMudou ? 1 : 0)
  const semGestor = ativos.filter((c) => !atual(c.id)).length

  const definir = (id: string, g: string) => setMudancas((m) => ({ ...m, [id]: g }))

  function sugerir() {
    const novas: Record<string, string> = { ...mudancas }
    const atualDe = (id: string) => (id in novas ? novas[id] : colaboradores.find((c) => c.id === id)?.responsavelId ?? '')
    let n = 0
    for (const c of ativos) {
      if (atualDe(c.id) || c.id === topo) continue
      const gestorArea = setores.find((s) => s.id === c.setorId)?.gestorId ?? null
      const alvo = gestorArea && gestorArea !== c.id ? gestorArea : topo && topo !== c.id ? topo : ''
      if (!alvo) continue
      // Evita sugerir algo que criaria ciclo.
      const teste = colaboradores.map((p) => ({ id: p.id, nome: p.nome, status: p.status, responsavelId: (p.id === c.id ? '' : atualDe(p.id)) || null, setorId: p.setorId }))
      if (validarMudancaGestor(teste, c.id, alvo).erros.length) continue
      novas[c.id] = alvo
      n++
    }
    setMudancas(novas)
    toast(n ? `${n} sugestões preenchidas. Revise e clique em Salvar hierarquia.` : 'Nada a sugerir com os dados cadastrados.', 'info')
  }

  async function salvar() {
    if (erros) return toast('Corrija os itens em vermelho antes de salvar.', 'danger')
    setSalvando(true)
    try {
      // Aplica em ordem que nunca cria ciclo: valida cada passo contra o estado já aplicado.
      let aplicadas = 0
      const gravar = (id: string, patch: { responsavelId?: string; topoOrganizacao?: boolean }) => {
        const atualStore = useStore.getState().pessoa(id)
        if (!atualStore) return
        const { id: _id, ...resto } = atualStore
        const r = salvarPessoa({ ...resto, ...patch }, id)
        if (!r.ok) { toast(`${atualStore.nome}: ${r.erro}`, 'danger'); return }
        aplicadas++
      }
      // Primeiro o topo: sai de baixo de qualquer gestor, para as demais trocas não formarem ciclo com ele.
      if (topoMudou || (topo && useStore.getState().pessoa(topo)?.responsavelId)) {
        for (const c of colaboradores) if (c.topoOrganizacao && c.id !== topo) gravar(c.id, { topoOrganizacao: false })
        if (topo) gravar(topo, { topoOrganizacao: true, responsavelId: undefined })
      }
      const fila = Object.entries(mudancas).filter(([id, g]) => id !== topo && g !== (colaboradores.find((c) => c.id === id)?.responsavelId ?? ''))
      for (const [id, g] of fila) gravar(id, { responsavelId: g || undefined })
      const gravou = await aguardarGravacao()
      toast(gravou ? `Hierarquia salva (${aplicadas} alterações).` : 'Alterado na tela, mas ainda não gravado no servidor. Mantenha a página aberta.', gravou ? 'success' : 'info')
      setMudancas({})
      onSalvo()
    } finally { setSalvando(false) }
  }

  const t = busca.trim().toLowerCase()
  const linhas = ativos.filter((c) => !t || c.nome.toLowerCase().includes(t)).sort((a, b) => a.nome.localeCompare(b.nome))

  return (
    <div className="space-y-5">
      <Callout tone="brand" icon="Network">
        Escolha o <b>topo da organização</b> (CEO) e, para cada pessoa, <b>a quem ela responde</b>. As linhas do organograma são desenhadas a partir disso. Nada é salvo até você confirmar.
      </Callout>
      <Card>
        <CardHead title="Topo e sugestão" sub={`${semGestor} pessoa(s) ainda sem gestor definido`} />
        <div className="p-5 flex flex-wrap items-end gap-4">
          <div className="min-w-[240px]">
            <label className="label" htmlFor="topo">Topo da organização (CEO)</label>
            <Select id="topo" label="Topo da organização" value={topo} onChange={setTopo} className="w-full">
              <option value="">Selecione…</option>
              {ativos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </Select>
          </div>
          <Button variant="soft" icon="Wand2" onClick={sugerir}>Sugerir pela liderança das áreas</Button>
          <p className="text-[12px] text-muted max-w-md">A sugestão liga cada pessoa ao gestor cadastrado da própria área e os gestores ao topo. É só um rascunho para você ajustar.</p>
        </div>
      </Card>

      <Card>
        <CardHead title="Quem responde a quem" sub={`${ativos.length} pessoas ativas`} action={<SearchBox value={busca} onChange={setBusca} placeholder="Buscar pessoa…" label="Buscar pessoa" />} />
        <ul className="divide-y divide-line">
          {linhas.map((c) => {
            const e = erroDe(c.id)
            return (
              <li key={c.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-3 min-w-[220px] flex-1">
                  <Avatar nome={c.nome} cor={c.avatarCor} size="sm" />
                  <div className="min-w-0"><div className="font-semibold text-ink text-[14px] truncate">{c.nome}</div><div className="text-[12px] text-muted truncate">{cargoNome(c.cargoId)}</div></div>
                </div>
                <div className="w-full sm:w-72">
                  <Select label={`Gestor imediato de ${c.nome}`} value={atual(c.id)} onChange={(v) => definir(c.id, v)} className="w-full" disabled={c.id === topo}>
                    <option value="">{c.id === topo ? 'Topo da organização (CEO)' : 'Ninguém (sem gestor definido)'}</option>
                    {ativos.filter((g) => g.id !== c.id).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
                  </Select>
                  {e && <p role="alert" className="text-[11.5px] text-danger mt-1">{e}</p>}
                </div>
              </li>
            )
          })}
          {linhas.length === 0 && <li className="p-6 text-center text-muted text-[13px]">Nenhuma pessoa encontrada.</li>}
        </ul>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <div className="card px-4 py-3 flex items-center gap-3 shadow-md">
          <span className="text-[12.5px] text-muted">{pendentesTotal ? `${pendentesTotal} alteração(ões) não salvas` : 'Sem alterações'}</span>
          <Button variant="ghost" disabled={!pendentesTotal || salvando} onClick={() => { setMudancas({}); setTopo(topoSalvo) }}>Descartar</Button>
          <Button icon="Save" disabled={!pendentesTotal || salvando || erros > 0} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar hierarquia'}</Button>
        </div>
      </div>
    </div>
  )
}
