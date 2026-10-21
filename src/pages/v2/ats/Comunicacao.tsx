import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, Button, EmptyState, Tabs, Field, Callout } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { TEXTAREA, useTitulo } from '@/components/v2/ats/comuns'
import { api, executar, qs, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { ROTULO_STATUS_COMUNICACAO } from '@/domain/v2/ats'
import { dataHoraBR } from '@/lib/fmt'

export default function Comunicacao() {
  useTitulo('Comunicação com candidatos · 4JURIS Pessoas')
  const [aba, setAba] = useState('pendentes')
  return (
    <SoComBanco>
      <PageHeader title="Comunicação com candidatos" subtitle="Mensagens enviadas, pendentes e modelos editáveis." />
      <Tabs active={aba} onChange={setAba} tabs={[{ key: 'pendentes', label: 'Pendências' }, { key: 'todas', label: 'Histórico' }, { key: 'modelos', label: 'Modelos' }]} />
      {aba === 'modelos' ? <Modelos /> : <Mensagens soPendentes={aba === 'pendentes'} />}
    </SoComBanco>
  )
}

function Mensagens({ soPendentes }: { soPendentes: boolean }) {
  const [pagina, setPagina] = useState(1)
  const r = useApi<{ itens: any[]; total: number; por: number; pendentes: number }>(`ats/comunicacoes${qs({ pagina })}`)
  const itens = (r.dados?.itens ?? []).filter((m) => !soPendentes || m.status !== 'enviada')
  async function reenviar(m: any) {
    const res = await executar(() => api.post(`ats/comunicacoes/${m.id}/enviar`))
    if (res?.status === 'enviada') toast('Mensagem enviada.')
    else if (res?.status === 'nao_configurado') toast('Não enviada: o e-mail não está configurado no servidor (RESEND_API_KEY).', 'info')
    else if (res) toast(`Falha no envio: ${res.erro ?? 'erro desconhecido'}.`, 'danger')
    r.recarregar()
  }
  return (
    <>
      {r.dados && r.dados.pendentes > 0 && soPendentes && (
        <Callout tone="warning" icon="MailWarning" className="mb-4">
          Há {r.dados.pendentes} mensagem(ns) que <b>não foram enviadas</b>. “E-mail não configurado” significa que o servidor ainda não tem as credenciais do provedor (variável <code>RESEND_API_KEY</code>); nada foi entregue ao candidato.
        </Callout>
      )}
      <Aguardar r={r} vazio={() => itens.length === 0 ? <Card><EmptyState icon="MailCheck" title={soPendentes ? 'Nenhuma pendência' : 'Nenhuma mensagem registrada'} desc="Mensagens são criadas a partir do perfil de cada candidato." /></Card> : null}>
        {(d) => (
          <Card>
            <ul>
              {itens.map((m) => (
                <li key={m.id} className="px-5 py-4 border-b border-line last:border-0 flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-ink">{m.assunto}</div>
                    <div className="text-[12.5px] text-muted">{m.candidatoNome ?? '—'} · {m.vagaTitulo ?? '—'} · {dataHoraBR(m.criadoEm)}</div>
                    {m.erro && <div className="text-[12.5px] text-danger mt-1">{m.erro}</div>}
                    {m.candidaturaId && <Link className="text-[12.5px] text-brand" to={`/recrutamento/candidatos/${m.candidaturaId}`}>Abrir candidato</Link>}
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge mapa={ROTULO_STATUS_COMUNICACAO} valor={m.status} />
                    {m.status !== 'enviada' && <Button size="sm" variant="soft" onClick={() => reenviar(m)}>Tentar enviar</Button>}
                  </div>
                </li>
              ))}
            </ul>
            <Paginacao pagina={pagina} por={d.por} total={d.total} onPagina={setPagina} />
          </Card>
        )}
      </Aguardar>
    </>
  )
}

function Modelos() {
  const r = useApi<{ itens: any[] }>('ats/templates')
  const [edit, setEdit] = useState<any | null>(null)
  const [f, setF] = useState({ assunto: '', corpo: '' })
  return (
    <>
      <Callout tone="neutral" icon="Info" className="mb-4">Variáveis disponíveis: <code>{'{{nome}}'}</code>, <code>{'{{vaga}}'}</code>, <code>{'{{etapa}}'}</code>, <code>{'{{empresa}}'}</code>, <code>{'{{data_entrevista}}'}</code>, <code>{'{{local_entrevista}}'}</code>, <code>{'{{link_acompanhamento}}'}</code>.</Callout>
      <Aguardar r={r}>
        {(d) => (
          <div className="grid md:grid-cols-2 gap-4">
            {d.itens.map((t) => (
              <Card key={t.chave} className="p-5">
                <h3 className="font-bold text-ink">{t.nome}</h3>
                <p className="text-[12.5px] text-muted mt-1">Assunto: {t.assunto}</p>
                <p className="text-[13px] text-ink-2 mt-3 whitespace-pre-wrap line-clamp-5">{t.corpo}</p>
                <Button size="sm" variant="ghost" className="mt-3" icon="Pencil" onClick={() => { setEdit(t); setF({ assunto: t.assunto, corpo: t.corpo }) }}>Editar</Button>
              </Card>
            ))}
          </div>
        )}
      </Aguardar>
      {edit && (
        <Modal open onClose={() => setEdit(null)} wide title={`Editar: ${edit.nome}`}
          footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={async () => { if (await executar(() => api.put(`ats/templates/${edit.chave}`, f), 'Modelo salvo.')) { setEdit(null); r.recarregar() } }}>Salvar</Button></>}>
          <Field label="Assunto" htmlFor="tp-a"><input id="tp-a" className="input" value={f.assunto} onChange={(e) => setF({ ...f, assunto: e.target.value })} /></Field>
          <Field label="Mensagem" htmlFor="tp-c"><textarea id="tp-c" className={`${TEXTAREA} min-h-[220px]`} value={f.corpo} onChange={(e) => setF({ ...f, corpo: e.target.value })} /></Field>
        </Modal>
      )}
    </>
  )
}
