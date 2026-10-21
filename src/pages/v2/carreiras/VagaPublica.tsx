import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, EmptyState, Icon } from '@/components/ui'
import { Contenedor, PortalLayout, useMeta } from '@/components/v2/carreiras/PortalLayout'
import { CarregandoBloco, ErroBloco } from '@/components/v2/estados'
import { useApi } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { toast } from '@/components/toast'
import { dataBR, moeda } from '@/lib/fmt'
import { ROTULO_MODALIDADE } from './Carreiras'

const Lista = ({ itens }: { itens?: string[] }) => (itens?.length ? <ul className="list-disc pl-5 space-y-1 text-[14px] text-ink-2">{itens.map((i) => <li key={i}>{i}</li>)}</ul> : null)
const Bloco = ({ titulo, children }: { titulo: string; children?: React.ReactNode }) => (children ? <section className="mb-6"><h2 className="text-[15px] font-bold text-ink mb-2">{titulo}</h2>{children}</section> : null)
const Texto = ({ t }: { t?: string | null }) => (t ? <p className="text-[14px] text-ink-2 whitespace-pre-wrap leading-relaxed">{t}</p> : null)

export default function VagaPublica() {
  const { slug = '' } = useParams()
  const r = useApi<any>(MODO_API ? `publico/vagas/${slug}` : null)
  const v = r.dados
  useMeta(v ? `${v.titulo} · 4JURIS Carreiras` : 'Vaga · 4JURIS Carreiras', v?.resumo ?? undefined)

  async function compartilhar() {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title: v.titulo, url }); return }
      await navigator.clipboard.writeText(url)
      toast('Link da vaga copiado.')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Não foi possível copiar. Copie o endereço da barra do navegador.', 'danger')
    }
  }

  return (
    <PortalLayout>
      <Contenedor className="py-6 sm:py-8" largura="max-w-4xl">
        <Link to="/carreiras" className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink mb-4">← Todas as vagas</Link>
        {r.carregando && !v ? <CarregandoBloco linhas={3} /> :
          r.erro?.status === 410 ? (
            <Card><EmptyState icon="CircleSlash" title="Esta vaga não recebe mais candidaturas" desc={r.erro.message} action={<Link to="/carreiras" className="text-brand font-semibold text-[13.5px]">Ver outras vagas</Link>} /></Card>
          ) : r.erro?.status === 404 ? (
            <Card><EmptyState icon="SearchX" title="Vaga não encontrada" desc="O link pode estar incorreto ou a vaga já foi encerrada." action={<Link to="/carreiras" className="text-brand font-semibold text-[13.5px]">Ver vagas abertas</Link>} /></Card>
          ) : r.erro ? <ErroBloco mensagem="Não conseguimos carregar esta vaga agora." onTentar={r.recarregar} /> : v && (
            <article>
              <header className="mb-6">
                {v.imagemUrl && <img src={v.imagemUrl} alt="" className="w-full max-h-72 rounded-2xl object-cover mb-5 bg-winter" />}
                <div className="flex flex-wrap gap-2 mb-3">
                  {v.area && <Badge tone="brand">{v.area}</Badge>}<Badge tone="neutral">{v.tipoRotulo}</Badge><Badge tone="neutral">{ROTULO_MODALIDADE[v.modalidade] ?? v.modalidade}</Badge>
                  {v.senioridade && <Badge tone="neutral">{v.senioridade}</Badge>}
                </div>
                <h1 className="text-[26px] sm:text-[32px] font-extrabold tracking-tight text-ink">{v.titulo}</h1>
                <p className="text-[13.5px] text-muted mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {(v.cidade || v.estado) && <span className="inline-flex items-center gap-1"><Icon name="MapPin" className="h-4 w-4" />{[v.cidade, v.estado, v.pais].filter(Boolean).join(', ')}</span>}
                  {v.publicadaEm && <span>Publicada em {dataBR(v.publicadaEm)}</span>}
                  {v.encerraEm && <span>Candidaturas até {dataBR(v.encerraEm)}</span>}
                </p>
                <div className="flex flex-wrap gap-3 mt-5">
                  <Link to={`/carreiras/${v.slug}/candidatar${window.location.search}`}><Button size="lg" icon="Send">Candidatar-me</Button></Link>
                  <Button size="lg" variant="ghost" icon="Share2" onClick={compartilhar}>Compartilhar</Button>
                </div>
              </header>

              <Card className="p-5 sm:p-7">
                {v.salario && (v.salario.min || v.salario.max) && (
                  <Callout tone="brand" icon="Wallet" className="mb-6">Faixa informada: <b>{v.salario.min ? moeda(v.salario.min, v.salario.moeda) : ''}{v.salario.min && v.salario.max ? ' a ' : ''}{v.salario.max ? moeda(v.salario.max, v.salario.moeda) : ''}</b> ({v.salario.tipo ?? 'mensal'}).</Callout>
                )}
                <Bloco titulo="Sobre a vaga"><Texto t={v.descricao || v.resumo} /></Bloco>
                <Bloco titulo="Responsabilidades"><Texto t={v.responsabilidades} /></Bloco>
                <Bloco titulo="Atividades do dia a dia"><Texto t={v.atividades} /></Bloco>
                <Bloco titulo="Requisitos obrigatórios"><Lista itens={v.requisitosObrigatorios} /></Bloco>
                <Bloco titulo="Diferenciais"><Lista itens={v.requisitosDesejaveis} /></Bloco>
                <Bloco titulo="Formação"><Texto t={v.formacao} /></Bloco>
                <Bloco titulo="Experiência"><Texto t={v.experiencia} /></Bloco>
                <Bloco titulo="Idiomas"><Lista itens={v.idiomas} /></Bloco>
                <Bloco titulo="Certificações"><Lista itens={v.certificacoes} /></Bloco>
                <Bloco titulo="Benefícios"><Lista itens={v.beneficios} /></Bloco>
                <Bloco titulo="Viagens"><Texto t={v.viagens} /></Bloco>
                <Bloco titulo="Documentos que poderemos pedir"><Lista itens={v.documentosNecessarios} /></Bloco>
                <div className="pt-4 border-t border-line">
                  <Link to={`/carreiras/${v.slug}/candidatar${window.location.search}`}><Button size="lg" icon="Send">Candidatar-me a esta vaga</Button></Link>
                </div>
              </Card>
            </article>
          )}
      </Contenedor>
    </PortalLayout>
  )
}
