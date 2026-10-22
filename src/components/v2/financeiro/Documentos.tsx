/* Repositório de documentos (arquivo real, conferência, substituição). Usado no perfil, na ficha da pessoa, no contrato e no fornecedor. */
import { useState } from 'react'
import { Badge, Button, Card, CardHead, EmptyState, Field, TD, TH, Tabela } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { Modal } from '@/components/Modal'
import { Aguardar } from '@/components/v2/estados'
import { api, ErroApi, executar, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { useTem } from '@/data/v2/acesso'
import { BadgeDocumento, CampoArquivo, LinkArquivo, useMotivo } from './comum'
import { CATEGORIAS_DOCUMENTO, ROTULO_CATEGORIA_DOC } from '@/domain/v2/financeiro'
import { dataBR } from '@/lib/fmt'

export interface DocLinha {
  id: string; categoria: string; titulo: string; pessoaId: string | null; pessoaNome: string | null; fornecedorNome: string | null; contratoNumero: string | null
  emitidoEm: string | null; validade: string | null; status: string; conferidoPor: string | null; motivoRejeicao: string | null; temArquivo: boolean; legado: boolean
  enviadoPor: string | null; enviadoPorId: string | null; criadoEm: string
}

const CATEGORIAS_ENVIO = CATEGORIAS_DOCUMENTO.filter((c) => c !== 'nota_fiscal' && c !== 'comprovante_pagamento')
const hoje = () => new Date().toISOString().slice(0, 10)

export function ListaDocumentos({ filtro, vinculo, podeEnviar, titulo = 'Documentos', mostrarTitular }: {
  filtro: string; vinculo: { pessoaId?: string; contratoId?: string; fornecedorId?: string }; podeEnviar: boolean; titulo?: string; mostrarTitular?: boolean
}) {
  const r = useApi<{ itens: DocLinha[]; total: number }>(`financeiro/documentos?${filtro}&por=100`)
  const confereFin = useTem('fin:conferir')
  const confereDocs = useTem('documentos:gerenciar')
  const conferir = confereFin || confereDocs
  const [envio, setEnvio] = useState<{ substitui?: DocLinha } | null>(null)
  const motivo = useMotivo()
  const decidir = async (d: DocLinha, decisao: 'valido' | 'rejeitado') => {
    const m = decisao === 'rejeitado' ? await motivo.pedir('Recusar documento', 'A pessoa será avisada para enviar outro arquivo.', 'Recusar') : null
    if (decisao === 'rejeitado' && !m) return
    if (await executar(() => api.post(`financeiro/documentos/${d.id}/conferir`, { decisao, motivo: m ?? undefined }), decisao === 'valido' ? 'Documento validado.' : 'Documento recusado.')) r.recarregar()
  }
  return (
    <Card>
      <CardHead title={titulo} sub="Arquivos privados: só a pessoa titular, quem gere o contrato (documentos contratuais) e a equipe de conferência acessam."
        action={podeEnviar && <Button size="sm" icon="Upload" onClick={() => setEnvio({})}>Enviar documento</Button>} />
      <Aguardar r={r} vazio={(d) => d.total ? null : <EmptyState icon="FolderOpen" title="Nenhum documento" />}>
        {(d) => (
          <Tabela minWidth={760}>
            <thead><tr><th className={TH}>Documento</th>{mostrarTitular && <th className={TH}>Titular</th>}<th className={TH}>Emissão / validade</th><th className={TH}>Situação</th><th className={TH}><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{d.itens.map((x) => {
              const vencido = x.validade && x.validade < hoje() && x.status !== 'substituido'
              return (
                <tr key={x.id}>
                  <td className={TD}><div className="font-semibold">{x.titulo}</div><div className="text-[11.5px] text-muted">{ROTULO_CATEGORIA_DOC[x.categoria as keyof typeof ROTULO_CATEGORIA_DOC] ?? x.categoria}{x.contratoNumero ? ` · contrato ${x.contratoNumero}` : ''}{x.enviadoPor ? ` · enviado por ${x.enviadoPor}` : ''}</div></td>
                  {mostrarTitular && <td className={TD}>{x.pessoaNome ?? x.fornecedorNome ?? '—'}</td>}
                  <td className={TD}>{dataBR(x.emitidoEm)}{x.validade && <div className={vencido ? 'text-danger text-[12px] font-semibold' : 'text-[12px] text-muted'}>válido até {dataBR(x.validade)}</div>}</td>
                  <td className={TD}><div className="flex flex-col items-start gap-1"><BadgeDocumento valor={x.status} />{vencido && <Badge tone="danger">Vencido</Badge>}{x.legado && <Badge>Cadastro antigo · sem arquivo</Badge>}
                    {x.motivoRejeicao && <span className="text-[11.5px] text-danger">{x.motivoRejeicao}</span>}</div></td>
                  <td className={TD}><div className="flex flex-wrap gap-2 items-center justify-end">
                    {x.temArquivo && <LinkArquivo rota={`financeiro/documentos/${x.id}/arquivo`}>Abrir</LinkArquivo>}
                    {conferir && x.status === 'pendente' && x.temArquivo && <><Button size="sm" variant="soft" onClick={() => decidir(x, 'valido')}>Validar</Button><Button size="sm" variant="ghost" onClick={() => decidir(x, 'rejeitado')}>Recusar</Button></>}
                    {podeEnviar && x.status !== 'substituido' && <Button size="sm" variant="subtle" icon="RefreshCw" onClick={() => setEnvio({ substitui: x })}>Substituir</Button>}
                  </div></td>
                </tr>
              )
            })}</tbody>
          </Tabela>
        )}
      </Aguardar>
      <ModalEnvio aberto={!!envio} substitui={envio?.substitui} vinculo={vinculo} fechar={() => setEnvio(null)} pronto={() => { setEnvio(null); r.recarregar() }} />
      {motivo.modal}
    </Card>
  )
}

function ModalEnvio({ aberto, fechar, pronto, vinculo, substitui }: { aberto: boolean; fechar: () => void; pronto: () => void; vinculo: { pessoaId?: string; contratoId?: string; fornecedorId?: string }; substitui?: DocLinha }) {
  const [f, setF] = useState({ categoria: 'cadastral', titulo: '', emitidoEm: '', validade: '' })
  const [arq, setArq] = useState<{ nome: string; base64: string } | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const salvar = async () => {
    setEnviando(true)
    try {
      await api.post('financeiro/documentos', {
        ...vinculo, ...f, categoria: substitui?.categoria ?? f.categoria, titulo: f.titulo || substitui?.titulo, substituiId: substitui?.id, arquivo: arq,
      })
      toast(substitui ? 'Nova versão enviada. A anterior ficou no histórico como substituída.' : 'Documento enviado para conferência.')
      setF({ categoria: 'cadastral', titulo: '', emitidoEm: '', validade: '' }); setArq(null); setErros({}); pronto()
    } catch (e) { setErros((e as ErroApi).campos ?? {}); toast((e as ErroApi).message, 'danger') } finally { setEnviando(false) }
  }
  return (
    <Modal open={aberto} onClose={fechar} title={substitui ? `Substituir: ${substitui.titulo}` : 'Enviar documento'}
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button disabled={!arq || enviando} onClick={salvar}>{enviando ? 'Enviando…' : 'Enviar'}</Button></>}>
      {!substitui && <Field label="Categoria"><Dropdown aria-label="Categoria" className="w-full" value={f.categoria} onChange={(e) => setF({ ...f, categoria: e.target.value })}>
        {CATEGORIAS_ENVIO.map((c) => <option key={c} value={c}>{ROTULO_CATEGORIA_DOC[c]}</option>)}</Dropdown></Field>}
      <Field label="Título" required={!substitui} erro={erros['título']} htmlFor="doc-tit"><input id="doc-tit" className="input" value={f.titulo} placeholder={substitui?.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Emissão" htmlFor="doc-em" erro={erros['data de emissão']}><input id="doc-em" type="date" className="input" value={f.emitidoEm} onChange={(e) => setF({ ...f, emitidoEm: e.target.value })} /></Field>
        <Field label="Validade" hint="Se houver (certidões, por ex.)." htmlFor="doc-val" erro={erros.validade}><input id="doc-val" type="date" className="input" value={f.validade} onChange={(e) => setF({ ...f, validade: e.target.value })} /></Field>
      </div>
      <CampoArquivo id="doc-arq" rotulo="Arquivo" obrigatorio valor={arq} onChange={setArq} />
    </Modal>
  )
}
