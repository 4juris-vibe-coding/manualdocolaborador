/* Estado do organograma: carga (parcial ou completa), ramos sob demanda, expansão e busca. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, qs, useApi } from '@/data/v2/api'
import type { CartaoPessoa, NoUI, PosicaoVagaDto, ResultadoBusca, VisaoOrg } from './tipos'

export interface FiltrosOrg { setor: string; unidade: string; gestor: string }
export const SEM_FILTRO: FiltrosOrg = { setor: '', unidade: '', gestor: '' }

export function useOrganograma(filtros: FiltrosOrg) {
  const rota = `organograma${qs({ setor: filtros.setor, unidade: filtros.unidade, gestor: filtros.gestor })}`
  const base = useApi<VisaoOrg>(rota)
  const [extras, setExtras] = useState<Record<string, CartaoPessoa>>({})
  const [carregandoRamo, setCarregandoRamo] = useState<Set<string>>(new Set())
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const iniciado = useRef('')

  // Ao trocar de visão/filtro, recomeça: raízes e seus filhos abertos (2 níveis de profundidade abertos).
  useEffect(() => {
    if (!base.dados || iniciado.current === rota + base.dados.itens.length) return
    iniciado.current = rota + base.dados.itens.length
    setExtras({})
    const aberto = new Set<string>()
    const porId = new Map(base.dados.itens.map((p) => [p.id, p]))
    const filhos = new Map<string, string[]>()
    for (const p of base.dados.itens) if (p.gestorId) (filhos.get(p.gestorId) ?? filhos.set(p.gestorId, []).get(p.gestorId)!).push(p.id)
    const abrir = (id: string, nivel: number) => { if (nivel >= 2) return; aberto.add(id); (filhos.get(id) ?? []).forEach((f) => porId.has(f) && abrir(f, nivel + 1)) }
    base.dados.raizes.forEach((r) => abrir(r, 0))
    setExpandidos(aberto)
  }, [base.dados, rota])

  const pessoas = useMemo(() => {
    const m = new Map<string, CartaoPessoa>()
    base.dados?.itens.forEach((p) => m.set(p.id, p))
    Object.values(extras).forEach((p) => m.set(p.id, p))
    return m
  }, [base.dados, extras])

  const filhosDe = useMemo(() => {
    const m = new Map<string, string[]>()
    for (const p of pessoas.values()) if (p.gestorId && pessoas.has(p.gestorId)) (m.get(p.gestorId) ?? m.set(p.gestorId, []).get(p.gestorId)!).push(p.id)
    m.forEach((v) => v.sort((a, b) => pessoas.get(a)!.nome.localeCompare(pessoas.get(b)!.nome, 'pt-BR')))
    return m
  }, [pessoas])

  const vagasPorGestor = useMemo(() => {
    const m = new Map<string, PosicaoVagaDto[]>()
    for (const v of base.dados?.posicoesVagas ?? []) if (v.gestorId) (m.get(v.gestorId) ?? m.set(v.gestorId, []).get(v.gestorId)!).push(v)
    return m
  }, [base.dados])
  const vagasSemGestor = useMemo(() => (base.dados?.posicoesVagas ?? []).filter((v) => !v.gestorId), [base.dados])

  const raizes = useMemo(() => base.dados?.raizes.filter((r) => pessoas.has(r)) ?? [], [base.dados, pessoas])

  /** Filhos que o servidor ainda não entregou (estruturas grandes). */
  const faltaCarregar = useCallback((id: string) => {
    const p = pessoas.get(id)
    return !!p && (filhosDe.get(id)?.length ?? 0) < p.filhosNaVisao
  }, [pessoas, filhosDe])

  const carregarRamo = useCallback(async (id: string) => {
    setCarregandoRamo((s) => new Set(s).add(id))
    try {
      const r = await api.get<{ itens: CartaoPessoa[] }>(`organograma/ramo/${id}?profundidade=1`)
      setExtras((e) => ({ ...e, ...Object.fromEntries(r.itens.map((p) => [p.id, p])) }))
    } finally {
      setCarregandoRamo((s) => { const n = new Set(s); n.delete(id); return n })
    }
  }, [])

  const alternar = useCallback(async (id: string) => {
    if (expandidos.has(id)) { setExpandidos((s) => { const n = new Set(s); n.delete(id); return n }); return }
    if (faltaCarregar(id)) await carregarRamo(id).catch(() => undefined)
    setExpandidos((s) => new Set(s).add(id))
  }, [expandidos, faltaCarregar, carregarRamo])

  /** Abre o caminho de gestores até a pessoa, carregando ramos que faltem. */
  const revelar = useCallback(async (caminho: string[]) => {
    for (const id of caminho) {
      if (faltaCarregar(id) || !pessoas.has(id)) await carregarRamo(id).catch(() => undefined)
    }
    setExpandidos((s) => { const n = new Set(s); caminho.forEach((c) => n.add(c)); return n })
  }, [faltaCarregar, pessoas, carregarRamo])

  const expandirTudo = useCallback(() => setExpandidos(new Set([...pessoas.keys()])), [pessoas])
  const recolherTudo = useCallback(() => setExpandidos(new Set()), [])

  /** Árvore visível (respeita o recolhimento), com posições vagas como folhas do gestor. */
  const visiveis = useMemo(() => {
    const out: { no: NoUI; nivel: number; paiChave: string | null }[] = []
    const visitar = (id: string, nivel: number, pai: string | null) => {
      const p = pessoas.get(id)
      if (!p) return
      out.push({ no: { tipo: 'pessoa', chave: id, pessoa: p }, nivel, paiChave: pai })
      if (!expandidos.has(id)) return
      for (const f of filhosDe.get(id) ?? []) visitar(f, nivel + 1, id)
      for (const v of vagasPorGestor.get(id) ?? []) out.push({ no: { tipo: 'vaga', chave: `vaga:${v.vagaId}`, vaga: v, gestorId: id }, nivel: nivel + 1, paiChave: id })
    }
    raizes.forEach((r) => visitar(r, 0, null))
    return out
  }, [pessoas, expandidos, filhosDe, vagasPorGestor, raizes])

  return {
    base, pessoas, filhosDe, raizes, expandidos, alternar, revelar, expandirTudo, recolherTudo, visiveis,
    vagasPorGestor, vagasSemGestor, carregandoRamo, faltaCarregar,
    recarregar: () => { setExtras({}); base.recarregar() },
  }
}

/** Busca no servidor (inclui quem ainda não foi carregado), com atraso para não consultar a cada tecla. */
export function useBusca(texto: string) {
  const [resultados, setResultados] = useState<ResultadoBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  useEffect(() => {
    if (texto.trim().length < 2) { setResultados([]); return }
    setBuscando(true)
    const t = setTimeout(() => {
      api.get<{ itens: ResultadoBusca[] }>(`organograma/busca${qs({ q: texto.trim() })}`)
        .then((r) => setResultados(r.itens)).catch(() => setResultados([])).finally(() => setBuscando(false))
    }, 250)
    return () => clearTimeout(t)
  }, [texto])
  return { resultados, buscando }
}
