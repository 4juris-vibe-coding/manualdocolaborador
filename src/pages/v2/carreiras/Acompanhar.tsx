import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Callout, Card, Field } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { Contenedor, PortalLayout, useMeta } from '@/components/v2/carreiras/PortalLayout'
import { api, ErroApi } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { toast } from '@/components/toast'
import { dataBR } from '@/lib/fmt'

interface Status { vaga: string; situacao: string; descricao: string; recebidaEm: string; atualizadoEm: string; podeDesistir: boolean }

export default function Acompanhar() {
  useMeta('Acompanhar candidatura · 4JURIS Carreiras', 'Consulte o andamento da sua candidatura com o código de acompanhamento.')
  const [sp] = useSearchParams()
  const [codigo, setCodigo] = useState(sp.get('codigo') ?? '')
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
  useEffect(() => { if (!auto.current && sp.get('codigo') && MODO_API) { auto.current = true; void consultar(sp.get('codigo')!) } }) // eslint-disable-line

  return (
    <PortalLayout>
      <Contenedor className="py-8" largura="max-w-xl">
        <h1 className="text-[24px] font-extrabold tracking-tight text-ink mb-1">Acompanhar candidatura</h1>
        <p className="text-[13.5px] text-muted mb-6">Digite o código que você recebeu ao enviar a candidatura.</p>
        <Card className="p-5 sm:p-6">
          <form onSubmit={(e) => { e.preventDefault(); void consultar() }}>
            <Field label="Código de acompanhamento" erro={erro} htmlFor="ac-cod"><input id="ac-cod" className="input" autoComplete="off" value={codigo} onChange={(e) => setCodigo(e.target.value)} aria-invalid={!!erro} /></Field>
            <Button type="submit" disabled={carregando || !MODO_API}>{carregando ? 'Consultando…' : 'Consultar'}</Button>
          </form>
        </Card>
        {res && (
          <div aria-live="polite"><Card className="p-5 sm:p-6 mt-5">
            <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Vaga</div>
            <div className="font-bold text-ink text-[17px]">{res.vaga}</div>
            <div className="mt-4 text-[12px] font-bold uppercase tracking-wide text-muted">Situação</div>
            <div className="font-bold text-brand text-[18px]">{res.situacao}</div>
            <p className="text-[14px] text-ink-2 mt-1">{res.descricao}</p>
            <p className="text-[12px] text-muted mt-4">Recebida em {dataBR(res.recebidaEm)} · Atualizada em {dataBR(res.atualizadoEm)}</p>
            {res.podeDesistir && <Button className="mt-4" variant="ghost" onClick={() => setDesistir(true)}>Desistir desta candidatura</Button>}
          </Card></div>
        )}
        <Callout tone="neutral" icon="ShieldCheck" className="mt-5">Por segurança, mostramos apenas a situação geral. Não exibimos avaliações nem informações de outros candidatos.</Callout>
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
