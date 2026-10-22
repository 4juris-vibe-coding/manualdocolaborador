/* PDF da vaga: um único template (A4) alimentado pelos dados reais da vaga.
   Usado na prévia interna (gestão da vaga) e na página pública. O arquivo é gerado pelo
   diálogo de impressão do navegador ("Salvar como PDF"), como nas apresentações: texto
   selecionável, acentos corretos e quebras de página controladas por CSS.
   Seções sem conteúdo são omitidas; nada é inventado. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import qrcode from 'qrcode-generator'
import { Button, Callout, Logo } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { ROTULO_MODALIDADE, ROTULO_REGIME_CONTRATACAO } from '@/domain/v2/vagas'
import { dataBR, moeda } from '@/lib/fmt'

const AZUL = '#0033D1'

/** Forma comum do documento; montada a partir da vaga interna ou da resposta pública. */
export interface DadosDocumentoVaga {
  titulo: string
  area?: string | null
  local?: string | null
  modalidade?: string | null
  regime?: string | null
  senioridade?: string | null
  atualizadaEm?: string | null
  sobreEmpresa?: string | null
  oportunidade?: string | null
  objetivo?: string | null
  responsabilidades?: string | null
  atividades?: string | null
  desafios?: string | null
  requisitos: string[]
  diferenciais: string[]
  formacao?: string | null
  experiencia?: string | null
  competencias: string[]
  beneficios: string[]
  jornada?: string | null
  endereco?: string | null
  salario?: string | null
  etapas: string[]
  link?: string | null
  /** Vaga não publicada (ou encerrada): o documento traz um aviso de uso interno. */
  aviso?: string | null
}

const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => String(x ?? '').trim()).filter(Boolean) : [])
const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function faixa(min: unknown, max: unknown, cod = 'BRL', tipo?: string | null): string | null {
  const a = min === null || min === undefined || min === '' ? null : Number(min)
  const b = max === null || max === undefined || max === '' ? null : Number(max)
  if (a === null && b === null) return null
  const t = a !== null && b !== null ? `${moeda(a, cod)} a ${moeda(b, cod)}` : a !== null ? `A partir de ${moeda(a, cod)}` : `Até ${moeda(b, cod)}`
  return tipo ? `${t} (${tipo})` : t
}

function localDe(v: Record<string, any>): string | null {
  return [v.cidade, v.estado].filter(Boolean).join(' / ') || null
}

const STATUS_AVISO: Record<string, string> = {
  rascunho: 'rascunho', em_aprovacao: 'em aprovação', ajustes: 'em ajustes', aprovada: 'aprovada, ainda não publicada', pausada: 'pausada', encerrada: 'encerrada', cancelada: 'cancelada',
}

/** Vaga vinda de GET vagas/:id (interna). Salário só entra se a vaga marcou "divulgar". */
export function documentoDaVagaInterna(v: Record<string, any>, area: string | null, origem = window.location.origin): DadosDocumentoVaga {
  const publicada = v.status === 'publicada'
  return {
    titulo: v.titulo, area, local: localDe(v), modalidade: v.modalidade, regime: v.regimeContratacao, senioridade: txt(v.senioridade),
    atualizadaEm: v.atualizadoEm ?? null,
    sobreEmpresa: txt(v.sobreEmpresa), oportunidade: txt(v.textoPublico) ?? txt(v.resumo), objetivo: txt(v.objetivo),
    responsabilidades: txt(v.responsabilidades), atividades: txt(v.atividades), desafios: txt(v.desafios),
    requisitos: arr(v.requisitosObrigatorios), diferenciais: arr(v.requisitosDesejaveis), formacao: txt(v.formacao), experiencia: txt(v.experiencia),
    competencias: [...arr(v.competenciasTecnicas), ...arr(v.competenciasComportamentais)],
    beneficios: arr(v.beneficios), jornada: txt(v.jornada), endereco: txt(v.endereco),
    salario: v.divulgarSalario ? faixa(v.salarioMin, v.salarioMax, v.moeda, v.tipoRemuneracao) : null,
    etapas: arr(v.etapasProcesso),
    link: publicada ? `${origem}/carreiras/${v.slug}` : null,
    aviso: publicada ? null : `Documento interno — vaga ${STATUS_AVISO[v.status] ?? v.status}. Não divulgar como oportunidade aberta.`,
  }
}

/** Vaga vinda de GET publico/vagas/:slug (só campos públicos). */
export function documentoDaVagaPublica(v: Record<string, any>, origem = window.location.origin): DadosDocumentoVaga {
  return {
    titulo: v.titulo, area: v.area, local: [v.cidade, v.estado].filter(Boolean).join(' / ') || null, modalidade: v.modalidade, regime: v.regimeContratacao, senioridade: txt(v.senioridade),
    atualizadaEm: v.atualizadaEm ?? v.publicadaEm ?? null,
    sobreEmpresa: txt(v.sobreEmpresa), oportunidade: txt(v.descricao) ?? txt(v.resumo), objetivo: null,
    responsabilidades: txt(v.responsabilidades), atividades: txt(v.atividades), desafios: txt(v.desafios),
    requisitos: arr(v.requisitosObrigatorios), diferenciais: arr(v.requisitosDesejaveis), formacao: txt(v.formacao), experiencia: txt(v.experiencia), competencias: [],
    beneficios: arr(v.beneficios), jornada: txt(v.jornada), endereco: txt(v.endereco),
    salario: v.salario ? faixa(v.salario.min, v.salario.max, v.salario.moeda, v.salario.tipo) : null,
    etapas: arr(v.etapasProcesso), link: `${origem}/carreiras/${v.slug}`,
    aviso: v.encerraEm ? `Candidaturas até ${dataBR(v.encerraEm)}.` : null,
  }
}

/** O que falta para o documento ficar completo (mostrado só na prévia administrativa). */
export function pendenciasDocumento(d: DadosDocumentoVaga): string[] {
  const p: string[] = []
  if (!d.oportunidade) p.push('Sobre a oportunidade')
  if (!d.responsabilidades) p.push('Responsabilidades')
  if (!d.requisitos.length) p.push('Requisitos')
  if (!d.area) p.push('Área')
  if (!d.local && !d.endereco && d.modalidade !== 'remoto') p.push('Localização')
  if (!d.jornada) p.push('Jornada / horário')
  if (!d.beneficios.length) p.push('Vantagens e benefícios')
  if (!d.etapas.length) p.push('Etapas do processo seletivo')
  return p
}

/* ---------------- documento ---------------- */

/** QR Code do link de candidatura, desenhado como SVG (nítido em qualquer resolução de impressão). */
export function QrCode({ texto, tamanho = 96 }: { texto: string; tamanho?: number }) {
  const qr = qrcode(0, 'M')
  qr.addData(texto)
  qr.make()
  const n = qr.getModuleCount()
  let d = ''
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${n + 8} ${n + 8}`} shapeRendering="crispEdges" role="img" aria-label="QR Code do link de candidatura">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  )
}

function Secao({ titulo, children, inteira }: { titulo: string; children: ReactNode; inteira?: boolean }) {
  return (
    <section className={inteira ? 'dv-secao dv-inteira' : 'dv-secao'}>
      <h2>{titulo}</h2>
      {children}
    </section>
  )
}
const Paragrafo = ({ t }: { t?: string | null }) => (t ? <p className="dv-texto">{t}</p> : null)
const Itens = ({ itens }: { itens: string[] }) => (itens.length ? <ul className="dv-lista">{itens.map((i, k) => <li key={k}>{i}</li>)}</ul> : null)

export function DocumentoVaga({ d }: { d: DadosDocumentoVaga }) {
  const modalidade = d.modalidade ? (d.modalidade === 'presencial' ? 'Presencial' : ROTULO_MODALIDADE[d.modalidade] ?? d.modalidade) : null
  const regime = d.regime && d.regime !== 'nao_informado' ? ROTULO_REGIME_CONTRATACAO[d.regime] ?? d.regime : null
  const meta = [d.area, d.senioridade, modalidade, d.local].filter(Boolean) as string[]
  const condicoes: [string, string][] = ([
    ['Contratação', regime], ['Modelo de trabalho', modalidade], ['Jornada', d.jornada ?? null], ['Local', d.endereco ?? d.local ?? null], ['Remuneração', d.salario ?? null],
  ] as [string, string | null][]).filter((x): x is [string, string] => !!x[1])
  const temRequisitos = d.requisitos.length || d.diferenciais.length || d.formacao || d.experiencia || d.competencias.length

  return (
    <div className="dv-doc">
      <style>{CSS_DOC}</style>
      <div className="dv-cabecalho">
        <div className="dv-marca">
          <Logo size={38} rounded="rounded-md" />
          <span>4JURIS</span>
          <em>Oportunidade de trabalho</em>
        </div>
        <div className="dv-titulo">
          <div>
            <h1>{d.titulo}</h1>
            {meta.length > 0 && <p className="dv-meta">{meta.join(' · ')}</p>}
            {d.atualizadaEm && <p className="dv-data">Atualizado em {dataBR(d.atualizadaEm)}</p>}
          </div>
          {d.link && <figure className="dv-qr"><QrCode texto={d.link} /><figcaption>Candidate-se</figcaption></figure>}
        </div>
      </div>
      {d.aviso && <p className="dv-aviso">{d.aviso}</p>}

      {d.oportunidade && <Secao titulo="Sobre a oportunidade"><Paragrafo t={d.oportunidade} />{d.objetivo && <><h3>Objetivo da posição</h3><Paragrafo t={d.objetivo} /></>}</Secao>}
      {d.sobreEmpresa && <Secao titulo="Sobre a 4JURIS"><Paragrafo t={d.sobreEmpresa} /></Secao>}
      {(d.responsabilidades || d.atividades) && (
        <Secao titulo="Responsabilidades"><Paragrafo t={d.responsabilidades} />{d.atividades && <><h3>Atividades do dia a dia</h3><Paragrafo t={d.atividades} /></>}</Secao>
      )}
      {d.desafios && <Secao titulo="Desafios da posição"><Paragrafo t={d.desafios} /></Secao>}
      {temRequisitos ? (
        <Secao titulo="Requisitos">
          {d.requisitos.length > 0 && <><h3>Obrigatórios</h3><Itens itens={d.requisitos} /></>}
          {d.diferenciais.length > 0 && <><h3>Diferenciais</h3><Itens itens={d.diferenciais} /></>}
          {d.formacao && <><h3>Formação</h3><Paragrafo t={d.formacao} /></>}
          {d.experiencia && <><h3>Experiência</h3><Paragrafo t={d.experiencia} /></>}
          {d.competencias.length > 0 && <><h3>Competências</h3><Itens itens={d.competencias} /></>}
        </Secao>
      ) : null}
      {(condicoes.length > 0 || d.beneficios.length > 0) && (
        <Secao titulo="Condições e vantagens">
          {condicoes.length > 0 && <dl className="dv-condicoes">{condicoes.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>}
          {d.beneficios.length > 0 && <><h3>Vantagens</h3><Itens itens={d.beneficios} /></>}
        </Secao>
      )}
      {(d.etapas.length > 0 || d.link) && (
        <Secao titulo="Processo seletivo" inteira>
          {d.etapas.length > 0 && <ol className="dv-etapas">{d.etapas.map((e, i) => <li key={i}>{e}</li>)}</ol>}
          {d.link && <p className="dv-texto">Para se candidatar, aponte a câmera do celular para o código no topo do documento ou acesse <b className="dv-link">{d.link}</b> e preencha o formulário. Não é preciso criar conta.</p>}
        </Secao>
      )}
    </div>
  )
}

/* Estilos do documento: valem na tela (prévia) e na impressão. Cores fixas (não seguem o tema escuro). */
const CSS_DOC = `
.dv-doc { background: #fff; color: #1b2733; font-family: inherit; font-size: 10.5pt; line-height: 1.5; width: 100%; max-width: 178mm; margin: 0 auto; }
.dv-doc * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.dv-cabecalho { border-bottom: 3px solid ${AZUL}; padding-bottom: 5mm; margin-bottom: 6mm; }
.dv-marca { display: flex; align-items: center; gap: 8px; margin-bottom: 6mm; }
.dv-marca span { font-weight: 800; letter-spacing: .04em; color: ${AZUL}; font-size: 12pt; }
.dv-marca em { margin-left: auto; font-style: normal; font-size: 8.5pt; color: #6a7681; text-transform: uppercase; letter-spacing: .08em; }
.dv-doc h1 { font-size: 22pt; line-height: 1.15; font-weight: 800; color: #121f2a; margin: 0; overflow-wrap: anywhere; }
.dv-meta { margin: 2.5mm 0 0; color: #3d4b56; font-size: 10.5pt; }
.dv-data { margin: 1mm 0 0; color: #6a7681; font-size: 8.5pt; }
.dv-aviso { border: 1px solid #e7b04a; background: #fff7e6; color: #7a4b00; border-radius: 2mm; padding: 2.5mm 3.5mm; font-size: 9.5pt; margin: 0 0 6mm; }
.dv-secao { margin: 0 0 6mm; }
.dv-inteira { break-inside: avoid; page-break-inside: avoid; }
.dv-secao h2 { font-size: 12.5pt; font-weight: 800; color: ${AZUL}; margin: 0 0 2mm; break-after: avoid; page-break-after: avoid; }
.dv-secao h3 { font-size: 10pt; font-weight: 700; color: #121f2a; margin: 3mm 0 1mm; break-after: avoid; page-break-after: avoid; }
.dv-texto { margin: 0 0 2mm; white-space: pre-line; overflow-wrap: anywhere; orphans: 3; widows: 3; }
.dv-lista, .dv-etapas { margin: 0 0 2mm; padding-left: 5mm; }
.dv-lista li, .dv-etapas li { margin: 0 0 1mm; break-inside: avoid; overflow-wrap: anywhere; }
.dv-condicoes { display: grid; grid-template-columns: 1fr 1fr; gap: 2mm 6mm; margin: 0 0 2mm; }
.dv-condicoes div { break-inside: avoid; }
.dv-condicoes dt { font-size: 8.5pt; text-transform: uppercase; letter-spacing: .05em; color: #6a7681; font-weight: 700; }
.dv-condicoes dd { margin: 0; overflow-wrap: anywhere; }
.dv-link { color: ${AZUL}; overflow-wrap: anywhere; }
.dv-titulo { display: flex; align-items: flex-start; justify-content: space-between; gap: 6mm; }
.dv-titulo > div { min-width: 0; }
.dv-qr { margin: 0; flex-shrink: 0; text-align: center; }
.dv-qr svg { display: block; width: 24mm; height: 24mm; }
.dv-qr figcaption { font-size: 7.5pt; color: #6a7681; text-transform: uppercase; letter-spacing: .06em; margin-top: 1mm; }
`

/* ---------------- impressão ---------------- */

/** Monta o documento fora do app e abre o diálogo de impressão ("Salvar como PDF"). */
export function ImpressaoVaga({ d, onFim }: { d: DadosDocumentoVaga; onFim: () => void }) {
  // Imprime uma única vez por montagem, mesmo que o componente pai renderize de novo.
  const fimRef = useRef(onFim)
  fimRef.current = onFim
  const titulo = useRef(d.titulo).current
  useEffect(() => {
    const estilo = document.createElement('style')
    estilo.textContent = `
      @page { size: A4; margin: 16mm 16mm 18mm; }
      @media print {
        html, body { background: #fff !important; }
        body.imprimindo-vaga > *:not(#vaga-print) { display: none !important; }
        body.imprimindo-vaga #vaga-print { display: block !important; }
      }
      #vaga-print { display: none; }`
    document.head.appendChild(estilo)
    document.body.classList.add('imprimindo-vaga')
    const tituloAntes = document.title
    // O navegador sugere o título da página como nome do arquivo.
    document.title = `Vaga - ${titulo} - 4JURIS`
    const fim = () => fimRef.current()
    window.addEventListener('afterprint', fim)
    const t = setTimeout(() => window.print(), 300)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fim); document.body.classList.remove('imprimindo-vaga'); document.title = tituloAntes; estilo.remove() }
  }, [titulo])
  return createPortal(<div id="vaga-print" aria-hidden><DocumentoVaga d={d} /></div>, document.body)
}

/** Prévia administrativa: mostra o documento, aponta o que falta e gera o PDF. */
export function ModalPdfVaga({ d, open, onClose, onEditar }: { d: DadosDocumentoVaga; open: boolean; onClose: () => void; onEditar?: () => void }) {
  const [imprimir, setImprimir] = useState(false)
  const falta = pendenciasDocumento(d)
  return (
    <>
      <Modal open={open} onClose={onClose} wide title="PDF da vaga" subtitle="Prévia do documento com os dados atuais da vaga. Para atualizar o PDF, edite a vaga e gere de novo."
        footer={<>
          {onEditar && <Button variant="ghost" icon="Pencil" onClick={onEditar}>Editar vaga</Button>}
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <Button icon="Download" onClick={() => setImprimir(true)}>Baixar PDF</Button>
        </>}>
        <div className="space-y-4 pb-2">
          {falta.length > 0 && (
            <Callout tone="neutral" icon="Info">
              <b>Não informado:</b> {falta.join(', ')}. Essas seções ficam fora do PDF até serem preenchidas.
            </Callout>
          )}
          <p className="text-[12.5px] text-muted">No diálogo que abrir, escolha <b>Salvar como PDF</b> como destino.</p>
          <div className="rounded-xl border border-line bg-white p-5 sm:p-8 overflow-x-auto"><DocumentoVaga d={d} /></div>
        </div>
      </Modal>
      {imprimir && <ImpressaoVaga d={d} onFim={() => setImprimir(false)} />}
    </>
  )
}
