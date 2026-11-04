/* ============================================================
   ATS · documentos da candidatura agrupados por etapa.
   Internos por padrão; o RH escolhe o que o candidato pode ver
   (e baixar pelo portal). Download sempre por rota autenticada.
   ============================================================ */
import { useEffect, useRef, useState } from 'react'
import { Badge, Button, Callout, Card, EmptyState, Field, Toggle, classesBotao } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { Dropdown } from '@/components/Dropdown'
import { Aguardar } from '@/components/v2/estados'
import { api, executar, lerBase64, useApi } from '@/data/v2/api'
import { dataHoraBR } from '@/lib/fmt'

const CATEGORIAS: Record<string, string> = { documento: 'Documento', comprovante: 'Comprovante', certificado: 'Certificado', avaliacao: 'Avaliação', contrato: 'Contrato', outro: 'Outro' }
const LIMITE_BYTES = 3 * 1024 * 1024
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`

export function DocumentosPorEtapa({ candidaturaId }: { candidaturaId: string }) {
  const r = useApi<any>(`ats/candidaturas/${candidaturaId}/documentos`)
  const [excluir, setExcluir] = useState<any | null>(null)
  return (
    <Aguardar r={r}>
      {(d) => {
        const grupos = [...d.etapas.map((e: any) => ({ ...e, docs: d.documentos.filter((x: any) => x.etapaId === e.id) })),
          { id: null, nome: 'Sem etapa', ordem: 999, solicitaDocumentos: false, docs: d.documentos.filter((x: any) => !x.etapaId || !d.etapas.some((e: any) => e.id === x.etapaId)) }]
          .filter((g) => g.docs.length > 0 || g.id === d.etapaAtualId)
        return (
          <div className="space-y-5">
            {d.permissoes.gerenciar && <Envio candidaturaId={candidaturaId} etapas={d.etapas} etapaAtualId={d.etapaAtualId} onEnviado={r.recarregar} />}
            {grupos.length === 0 && <Card><EmptyState icon="FolderOpen" title="Nenhum documento" desc="Arquivos anexados pelo RH ou enviados pelo candidato aparecem aqui, por etapa." /></Card>}
            {grupos.map((g) => (
              <Card key={g.id ?? 'sem'} className="p-5">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <h3 className="font-bold text-ink text-[14px]">{g.id ? `${g.ordem}. ${g.nome}` : g.nome}</h3>
                  {g.id && g.id === d.etapaAtualId && <Badge tone="brand">Etapa atual</Badge>}
                  {g.solicitaDocumentos && <Badge tone="gold">Solicita documentos do candidato</Badge>}
                </div>
                {g.solicitaDocumentos && g.instrucaoDocumentos && <p className="text-[12.5px] text-muted mb-2">Instrução ao candidato: {g.instrucaoDocumentos}</p>}
                {g.docs.length === 0 ? <p className="text-[13px] text-muted">Nenhum arquivo nesta etapa.</p> : (
                  <ul className="divide-y divide-line">
                    {g.docs.map((x: any) => (
                      <li key={x.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold text-ink truncate">{x.nome}</div>
                          <div className="text-[12px] text-muted">
                            {CATEGORIAS[x.categoria] ?? x.categoria} · {x.enviadoPor === 'candidato' ? 'Enviado pelo candidato' : `RH: ${x.colaboradorNome ?? '—'}`} · {dataHoraBR(x.criadoEm)} · {kb(x.tamanho)}
                          </div>
                          {x.observacao && <div className="text-[12px] text-ink-2 mt-0.5">{x.observacao}</div>}
                          <div className="mt-1">{x.visivelCandidato ? <Badge tone="success">Visível ao candidato</Badge> : <Badge tone="neutral">Interno</Badge>}</div>
                        </div>
                        <div className="flex gap-1.5 flex-wrap items-center">
                          <a className={classesBotao('ghost', 'sm')} href={api.url(`ats/candidaturas/${candidaturaId}/documentos/${x.id}/arquivo`)} aria-label={`Baixar ${x.nome}`}>Baixar</a>
                          {d.permissoes.gerenciar && (
                            <>
                              <Button size="sm" variant="ghost" icon={x.visivelCandidato ? 'EyeOff' : 'Eye'} onClick={async () => {
                                if (await executar(() => api.patch(`ats/candidaturas/${candidaturaId}/documentos/${x.id}`, { visivelCandidato: !x.visivelCandidato }), x.visivelCandidato ? 'Agora é interno.' : 'Agora o candidato pode ver.')) r.recarregar()
                              }}>{x.visivelCandidato ? 'Tornar interno' : 'Mostrar ao candidato'}</Button>
                              <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Excluir ${x.nome}`} onClick={() => setExcluir(x)} />
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
            <ConfirmModal open={!!excluir} onClose={() => setExcluir(null)} titulo="Excluir documento?" confirmar="Excluir" texto={`O arquivo "${excluir?.nome ?? ''}" será removido definitivamente.`}
              onConfirm={async () => { const x = excluir; setExcluir(null); if (await executar(() => api.del(`ats/candidaturas/${candidaturaId}/documentos/${x.id}`), 'Documento excluído.')) r.recarregar() }} />
          </div>
        )
      }}
    </Aguardar>
  )
}

function Envio({ candidaturaId, etapas, etapaAtualId, onEnviado }: { candidaturaId: string; etapas: any[]; etapaAtualId: string | null; onEnviado: () => void }) {
  const [etapaId, setEtapaId] = useState(etapaAtualId ?? '')
  const [categoria, setCategoria] = useState('documento')
  const [visivel, setVisivel] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => setEtapaId(etapaAtualId ?? ''), [etapaAtualId])

  async function enviar() {
    if (!arquivo) { setErro('Escolha um arquivo.'); return }
    if (arquivo.size > LIMITE_BYTES) { setErro('Arquivo maior que 3 MB.'); return }
    setEnviando(true); setErro('')
    const ok = await executar(async () => api.post(`ats/candidaturas/${candidaturaId}/documentos`, {
      etapaId: etapaId || null, categoria, visivelCandidato: visivel, observacao: observacao.trim() || undefined, arquivo: await lerBase64(arquivo),
    }), 'Documento anexado.')
    setEnviando(false)
    if (ok) { setArquivo(null); setObservacao(''); setVisivel(false); if (input.current) input.current.value = ''; onEnviado() }
  }

  return (
    <Card className="p-5">
      <div className="font-bold text-ink text-[14px] mb-3">Anexar documento</div>
      <form onSubmit={(e) => { e.preventDefault(); void enviar() }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Etapa" htmlFor="doc-etapa">
            <Dropdown id="doc-etapa" className="input" value={etapaId} onChange={(e) => setEtapaId(e.target.value)}>
              <option value="">Sem etapa</option>
              {etapas.map((e) => <option key={e.id} value={e.id}>{e.ordem}. {e.nome}</option>)}
            </Dropdown>
          </Field>
          <Field label="Categoria" htmlFor="doc-cat">
            <Dropdown id="doc-cat" className="input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
              {Object.entries(CATEGORIAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Dropdown>
          </Field>
        </div>
        <Field label="Arquivo" htmlFor="doc-arq" erro={erro} hint="PDF, DOC, DOCX, ODT, PNG ou JPG · até 3 MB">
          <input id="doc-arq" ref={input} type="file" className="block w-full text-[13px]" accept=".pdf,.doc,.docx,.odt,.png,.jpg,.jpeg" onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErro('') }} />
        </Field>
        <Field label="Observação (interna)" htmlFor="doc-obs"><input id="doc-obs" className="input" maxLength={500} value={observacao} onChange={(e) => setObservacao(e.target.value)} /></Field>
        <div className="mb-3"><Toggle checked={visivel} onChange={setVisivel} label="Visível ao candidato no portal" /></div>
        {visivel && <Callout tone="warning" icon="Eye" className="mb-3">O candidato poderá baixar este arquivo com o código de acompanhamento.</Callout>}
        <Button type="submit" icon="Upload" disabled={enviando || !arquivo}>{enviando ? 'Enviando…' : 'Anexar'}</Button>
      </form>
    </Card>
  )
}
