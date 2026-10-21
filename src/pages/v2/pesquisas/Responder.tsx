/* Página PÚBLICA do respondente: /responder/:token. Sem menus nem ferramentas administrativas. */
import { useCallback, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Card, EmptyState, Logo } from '@/components/ui'
import { api, ErroApi, useApi } from '@/data/v2/api'
import { Respondente, type DadosResposta, type ResultadoEnvio } from '@/components/v2/pesquisas/Respondente'
import type { Respostas } from '@/domain/v2/pesquisaTipos'

/** Identificador aleatório do navegador, usado só para limitar repetições no link público. */
function marcaDoNavegador(): string {
  try {
    let m = localStorage.getItem('pq-marca')
    if (!m) { m = crypto.randomUUID() + crypto.randomUUID(); localStorage.setItem('pq-marca', m) }
    return m
  } catch { return crypto.randomUUID() + crypto.randomUUID() }
}

function Aviso({ icone, titulo, texto }: { icone: string; titulo: string; texto: string }) {
  return (
    <div className="min-h-screen bg-surface-3">
      <header className="border-b border-line bg-surface"><div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-3"><Logo size={30} /><span className="font-extrabold text-ink tracking-tight">4JURIS</span></div></header>
      <main className="mx-auto max-w-2xl px-4 py-10"><Card><EmptyState icon={icone} title={titulo} desc={texto} /></Card></main>
    </div>
  )
}

export default function Responder() {
  const { token = '' } = useParams()
  const r = useApi<DadosResposta>(`responder/${encodeURIComponent(token)}`)

  const enviar = useCallback(async (respostas: Respostas): Promise<ResultadoEnvio> => {
    try {
      const out = await api.post<{ mensagemFinal?: string }>(`responder/${encodeURIComponent(token)}`, { respostas, marca: marcaDoNavegador() })
      return { ok: true, mensagemFinal: out.mensagemFinal }
    } catch (e) {
      const er = e as ErroApi
      return { ok: false, erro: er.message, campos: er.campos }
    }
  }, [token])

  const progresso = useCallback((respostas: Respostas) => { void api.put(`responder/${encodeURIComponent(token)}/progresso`, { respostas }).catch(() => undefined) }, [token])
  const chaveLocal = useMemo(() => (r.dados?.modo === 'anonima' ? `pq-prog-${r.dados.pesquisaId ?? token.slice(0, 12)}` : undefined), [r.dados?.modo, r.dados?.pesquisaId, token])

  if (r.carregando && !r.dados) return <div className="min-h-screen flex items-center justify-center text-muted text-[14px]" aria-busy="true">Carregando…</div>
  if (r.erro && !r.dados) {
    const e = r.erro
    if (e.status === 0) return <Aviso icone="WifiOff" titulo="Sem conexão" texto={e.message} />
    if (e.status === 410) return <Aviso icone="CheckCircle2" titulo="Link indisponível" texto={e.message} />
    if (e.status === 403) return <Aviso icone="Clock" titulo="Pesquisa indisponível no momento" texto={e.message} />
    if (e.status === 429) return <Aviso icone="Hourglass" titulo="Muitas tentativas" texto="Aguarde alguns minutos e tente novamente." />
    return <Aviso icone="Link2" titulo="Link inválido" texto="Este endereço não corresponde a nenhuma pesquisa ativa. Confira se copiou o link completo ou peça um novo ao RH." />
  }
  if (!r.dados) return null
  return <Respondente dados={r.dados} onEnviar={enviar} onProgresso={progresso} chaveLocal={chaveLocal} />
}
