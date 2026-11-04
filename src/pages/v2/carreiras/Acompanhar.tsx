import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, Field, Icon } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { Contenedor, PortalLayout, useMeta } from '@/components/v2/carreiras/PortalLayout'
import { api, ErroApi } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { toast } from '@/components/toast'
import { dataBR } from '@/lib/fmt'
import { TarefasCandidato } from '@/components/v2/carreiras/TarefasCandidato'

type SituacaoEtapa = 'concluida' | 'atual' | 'futura' | 'encerrada' | 'nao_realizada'
interface Status {
  vaga: string; slug?: string; situacao: string; descricao: string; recebidaEm: string; atualizadoEm: string; podeDesistir: boolean
  encerrada?: boolean; etapaAtual?: string | null; linhaDoTempo?: { nome: string; situacao: SituacaoEtapa; desde: string | null }[]
}

export default function Acompanhar() {
  useMeta('Acompanhar candidatura · 4JURIS Carreiras', 'Consulte o andamento da sua candidatura com o código de acompanhamento.')
  const [sp] = useSearchParams()
  const loc = useLocation()
  const navigate = useNavigate()
  const inicial = (loc.state as { codigo?: string } | null)?.codigo ?? sp.get('codigo') ?? ''
  const [codigo, setCodigo] = useState(inicial)
  const [res, setRes] = useState<Status | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [desistir, setDesistir] = useState(false)
  const auto = useRef(false)

  async function consultar(c = codigo) {
    if (!c.trim()) { setErro('Informe o código de acompanhamento.'); return }
    setCarregando(true); setErro(''); setRes(null)
    try { setRes(await api.post<Status>('publico/candidaturas/acompanhar', { token: c.trim() })) }
    catch (e) { setErro(e instanceof ErroApi ? e.message : 'Não foi possível consultar agora.') }
    finally { setCarregando(false) }
  }
  useEffect(() => {
    if (auto.current || !inicial || !MODO_API) return
    auto.current = true
    // O código não fica na barra de endereço nem no histórico (evita vazar por links, prints ou referer).
    if (sp.get('codigo') || loc.state) navigate('/carreiras/acompanhar', { replace: true, state: null })
    void consultar(inicial)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <PortalLayout>
      <Contenedor className="py-8 sm:py-10" largura="max-w-2xl">
        <h1 className="text-[26px] font-extrabold tracking-tight mb-1">Acompanhar candidatura</h1>
        <p className="text-[14px] text-[#58636e] mb-6">Digite o código que você recebeu ao enviar a candidatura.</p>
        <Card className="p-5 sm:p-6">
          <form onSubmit={(e) => { e.preventDefault(); void consultar() }} className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1"><Field label="Código de acompanhamento" erro={erro} htmlFor="ac-cod"><input id="ac-cod" className="input font-mono" autoComplete="off" autoCapitalize="none" spellCheck={false} value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-invalid={!!erro} /></Field></div>
            <Button type="submit" icon="Search" className="sm:mb-4" disabled={carregando || !MODO_API}>{carregando ? 'Consultando…' : 'Consultar'}</Button>
          </form>
        </Card>
        {res && (
          <div aria-live="polite" className="mt-5 space-y-5">
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[12px] font-bold uppercase tracking-wide text-[#58636e]">Vaga</div>
                  {res.slug ? <Link to={`/carreiras/${res.slug}`} className="font-bold text-[17px] hover:text-brand">{res.vaga}</Link> : <div className="font-bold text-[17px]">{res.vaga}</div>}
                </div>
                <Badge tone={res.encerrada ? 'neutral' : 'brand'} dot>{res.situacao}</Badge>
              </div>
              <p className="text-[14px] text-[#3d4b56] mt-3">{res.descricao}</p>
              {res.etapaAtual && <p className="text-[14px] mt-2">Você está na etapa <b>{res.etapaAtual}</b>.</p>}
              <p className="text-[12px] text-[#58636e] mt-3">Recebida em {dataBR(res.recebidaEm)} · Atualizada em {dataBR(res.atualizadoEm)}</p>
            </Card>

            {!!res.linhaDoTempo?.length && (
              <Card className="p-5 sm:p-6">
                <h2 className="text-[15px] font-bold mb-4">Etapas do processo</h2>
                <ol className="relative">
                  {res.linhaDoTempo.map((e, i) => {
                    const ultimo = i === res.linhaDoTempo!.length - 1
                    const cor = e.situacao === 'concluida' ? 'bg-[#0b7a52] text-white' : e.situacao === 'atual' ? 'bg-brand text-white ring-4 ring-[#c9d5fb]' : e.situacao === 'encerrada' ? 'bg-[#58636e] text-white' : 'bg-white border-2 border-[#d3d9df] text-[#58636e]'
                    return (
                      <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                        {!ultimo && <span className={`absolute left-[13px] top-7 bottom-0 w-0.5 ${e.situacao === 'concluida' ? 'bg-[#0b7a52]' : 'bg-[#e4e8ed]'}`} aria-hidden />}
                        <span className={`relative z-[1] grid place-items-center h-7 w-7 rounded-full text-[12px] font-bold shrink-0 ${cor}`} aria-hidden>
                          {e.situacao === 'concluida' ? <Icon name="Check" className="h-4 w-4" /> : i + 1}
                        </span>
                        <div className="pt-0.5">
                          <div className={`text-[14px] ${e.situacao === 'atual' ? 'font-bold' : e.situacao === 'futura' || e.situacao === 'nao_realizada' ? 'text-[#58636e]' : 'font-semibold'}`}>{e.nome}</div>
                          <div className="text-[12px] text-[#58636e]">
                            {e.situacao === 'concluida' ? `Concluída${e.desde ? ` · desde ${dataBR(e.desde)}` : ''}` : e.situacao === 'atual' ? `Etapa atual${e.desde ? ` · desde ${dataBR(e.desde)}` : ''}` : e.situacao === 'encerrada' ? 'Processo encerrado nesta etapa' : e.situacao === 'nao_realizada' ? 'Não realizada' : 'Próxima etapa'}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              </Card>
            )}

            {/* Questionários e documentos da etapa atual (só o que o RH liberou para o candidato). */}
            {!res.encerrada && <TarefasCandidato codigo={codigo.trim()} />}

            {res.podeDesistir && <div className="text-right"><Button variant="ghost" onClick={() => setDesistir(true)}>Desistir desta candidatura</Button></div>}
          </div>
        )}
        <Callout tone="neutral" icon="ShieldCheck" className="mt-5">Mostramos só a situação da sua candidatura e as etapas da vaga. Comentários internos, avaliações e informações de outros candidatos nunca aparecem aqui. Guarde o código: ele é pessoal.</Callout>
      </Contenedor>
      <ConfirmModal open={desistir} onClose={() => setDesistir(false)} titulo="Desistir da candidatura?" confirmar="Sim, desistir" texto="Seu processo nesta vaga será encerrado. Para participar novamente, será preciso enviar nova candidatura."
        onConfirm={async () => {
          setDesistir(false)
          try { await api.post('publico/candidaturas/desistir', { token: codigo.trim() }); toast('Candidatura encerrada a seu pedido.'); void consultar() }
          catch (e) { toast(e instanceof ErroApi ? e.message : 'Não foi possível concluir.', 'danger') }
        }} />
    </PortalLayout>
  )
}
