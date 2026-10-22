import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader, Card, Icon, Badge } from '@/components/ui'
import { cn } from '@/lib/utils'

/* ============================================================
   Conteúdo do Manual do Colaborador 4JURIS
   Edite os blocos abaixo para manter o manual atualizado.
   ============================================================ */
interface Bloco { tipo: 'p' | 'lista' | 'destaque' | 'sub'; texto?: string; itens?: string[] }
interface Secao { id: string; icon: string; titulo: string; blocos: Bloco[] }

const SECOES: Secao[] = [
  {
    id: 'cultura', icon: 'Sparkles', titulo: 'Nossa cultura',
    blocos: [
      { tipo: 'p', texto: 'A 4JURIS é um ecossistema de soluções no cenário jurídico. Somos a união entre marketing, tecnologia, educação e comunicação para promover o sucesso em cada jornada jurídica.' },
      { tipo: 'p', texto: 'Aqui, cada pessoa é protagonista. Valorizamos autonomia com responsabilidade, colaboração entre setores e a busca constante por soluções que transformam o mercado.' },
      { tipo: 'destaque', texto: 'Inovação que transforma, soluções que conectam.' },
    ],
  },
  {
    id: 'mvv', icon: 'Target', titulo: 'Missão, visão e valores',
    blocos: [
      { tipo: 'sub', texto: 'Missão' },
      { tipo: 'p', texto: 'Ser a bússola que guia advogados em suas trajetórias profissionais, oferecendo soluções personalizadas e inovadoras em marketing jurídico, impulsionando o crescimento e o sucesso de cada cliente.' },
      { tipo: 'sub', texto: 'Visão' },
      { tipo: 'p', texto: 'Ser reconhecida como a principal referência em tecnologia voltada para o mercado jurídico — a escolha essencial para advogados que almejam crescimento escalável e lucrativo.' },
      { tipo: 'sub', texto: 'Valores' },
      { tipo: 'lista', itens: ['Personalização', 'Excelência', 'Confiança', 'Inovação', 'Ética profissional'] },
    ],
  },
  {
    id: 'conduta', icon: 'ShieldCheck', titulo: 'Código de conduta',
    blocos: [
      { tipo: 'p', texto: 'Esperamos de todos os colaboradores uma postura ética, respeitosa e íntegra em qualquer interação — interna ou com clientes e parceiros.' },
      { tipo: 'lista', itens: [
        'Respeite colegas, clientes e parceiros, sem qualquer forma de discriminação ou assédio.',
        'Mantenha a confidencialidade de informações da empresa e dos clientes.',
        'Aja com honestidade e transparência em decisões e relatórios.',
        'Evite conflitos de interesse e comunique-os quando surgirem.',
        'Cumpra a LGPD e as políticas de proteção de dados da 4JURIS.',
      ] },
      { tipo: 'destaque', texto: 'Em caso de dúvida sobre uma conduta, fale com o RH antes de agir.' },
    ],
  },
  {
    id: 'dresscode', icon: 'Shirt', titulo: 'Dress code',
    blocos: [
      { tipo: 'p', texto: 'Nosso ambiente é moderno e flexível. O padrão é o casual de trabalho (smart casual).' },
      { tipo: 'lista', itens: [
        'Dia a dia: casual confortável e apresentável.',
        'Reuniões com clientes e gravações: visual mais alinhado (smart casual / social).',
        'Eventos e representações da marca: seguir orientação específica do time.',
      ] },
    ],
  },
  {
    id: 'comunicacao', icon: 'MessagesSquare', titulo: 'Política de comunicação',
    blocos: [
      { tipo: 'p', texto: 'Nosso tom de voz é um equilíbrio entre confiança e criatividade. Comunicamos com clareza, autoridade e inspiração — sempre com respeito.' },
      { tipo: 'sub', texto: 'Uso do WhatsApp' },
      { tipo: 'lista', itens: [
        'Assuntos de trabalho nos grupos e conversas oficiais; evite mensagens fora do horário sempre que possível.',
        'Seja objetivo e cordial; para temas longos ou decisões, prefira registrar por e-mail.',
        'Não compartilhe dados sensíveis de clientes por canais não oficiais.',
      ] },
      { tipo: 'sub', texto: 'Uso do e-mail' },
      { tipo: 'lista', itens: [
        'Use o e-mail corporativo para comunicações formais e com clientes.',
        'Responda dentro de prazos razoáveis (idealmente em até 1 dia útil).',
        'Mantenha assinatura padrão e assuntos claros.',
      ] },
    ],
  },
  {
    id: 'horarios', icon: 'Clock', titulo: 'Agendas e reuniões',
    blocos: [
      { tipo: 'p', texto: 'Trabalhamos com foco em resultados e autonomia, conforme o escopo de cada contrato. Combine com a área do projeto os momentos de alinhamento e as janelas de sobreposição que fazem sentido para as entregas.' },
      { tipo: 'lista', itens: [
        'Respeite as janelas de alinhamento combinadas para cada projeto.',
        'Chegue às reuniões no horário e com o material preparado.',
        'Reuniões devem ter objetivo e, sempre que possível, ata ou próximos passos registrados.',
      ] },
    ],
  },
  {
    id: 'regras', icon: 'ClipboardList', titulo: 'Regras internas',
    blocos: [
      { tipo: 'lista', itens: [
        'Emissão de nota fiscal: emita e envie a NF mensal pela Central de Notas Fiscais dentro do prazo.',
        'Reembolsos: solicite pela Central de Reembolsos, sempre com comprovante anexado.',
        'Disponibilidade: registre com antecedência os períodos em que não estará disponível, para a área reorganizar as entregas.',
        'Equipamentos e acessos cedidos: siga o que está previsto no seu contrato e devolva ao encerrar a parceria.',
        'Proteção de dados: siga as diretrizes de LGPD em todos os processos.',
      ] },
    ],
  },
  {
    id: 'boas-praticas', icon: 'ThumbsUp', titulo: 'Boas práticas',
    blocos: [
      { tipo: 'lista', itens: [
        'Compartilhe conhecimento e ajude colegas de outros setores.',
        'Traga ideias — somos "Criadores Visionários", moldamos o futuro do marketing jurídico.',
        'Dê e receba feedback com abertura e respeito.',
        'Celebre conquistas do time e reconheça bons trabalhos.',
        'Busque aprendizado contínuo nas trilhas da Academy 4JURIS.',
      ] },
    ],
  },
]

export default function Manual() {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(SECOES[0].id)
  const refs = useRef<Record<string, HTMLElement | null>>({})

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return SECOES
    return SECOES.filter((s) =>
      s.titulo.toLowerCase().includes(t) ||
      s.blocos.some((b) => (b.texto?.toLowerCase().includes(t)) || b.itens?.some((i) => i.toLowerCase().includes(t))),
    )
  }, [q])

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-25% 0px -60% 0px' },
    )
    Object.values(refs.current).forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [filtradas])

  const goTo = (id: string) => refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      <PageHeader title="Manual de convivência" subtitle="Cultura, comunicação e boas práticas da comunidade 4JURIS." />

      {/* Busca */}
      <div className="relative mb-6 max-w-md">
        <Icon name="Search" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-muted" />
        <input className="input pl-10" placeholder="Buscar no manual..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8 items-start">
        {/* Sumário */}
        <nav className="sticky top-[88px] hidden lg:block">
          <div className="text-[11px] font-bold uppercase tracking-wide text-muted mb-3">Nesta página</div>
          <ul className="space-y-0.5">
            {filtradas.map((s) => (
              <li key={s.id}>
                <button onClick={() => goTo(s.id)}
                  className={cn('flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium transition',
                    active === s.id ? 'bg-brand-50 text-brand' : 'text-ink-2 hover:bg-surface-2')}>
                  <Icon name={s.icon} className="h-4 w-4 shrink-0" />
                  <span className="truncate">{s.titulo}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Conteúdo */}
        <div className="space-y-6 min-w-0">
          {filtradas.length === 0 && (
            <Card className="p-10 text-center text-muted text-[13.5px]">Nenhuma seção encontrada para “{q}”.</Card>
          )}
          {filtradas.map((s) => (
            <Card key={s.id} className="p-6 scroll-mt-24" >
              <section id={s.id} ref={(el) => { refs.current[s.id] = el }}>
                <div className="flex items-center gap-3 mb-4">
                  <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0">
                    <Icon name={s.icon} className="h-[21px] w-[21px]" />
                  </span>
                  <h2 className="text-[19px] font-bold text-ink">{s.titulo}</h2>
                </div>
                <div className="space-y-3">
                  {s.blocos.map((b, i) => {
                    if (b.tipo === 'sub') return <h3 key={i} className="text-[14px] font-bold text-ink pt-2">{b.texto}</h3>
                    if (b.tipo === 'p') return <p key={i} className="text-[14px] leading-relaxed text-ink-2">{b.texto}</p>
                    if (b.tipo === 'destaque') return (
                      <div key={i} className="flex gap-3 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
                        <Icon name="Quote" className="h-4 w-4 text-brand shrink-0 mt-0.5" />
                        <p className="text-[13.5px] font-semibold text-brand-700 italic">{b.texto}</p>
                      </div>
                    )
                    if (b.tipo === 'lista') return (
                      <ul key={i} className="space-y-2">
                        {b.itens!.map((it, j) => (
                          <li key={j} className="flex gap-2.5 text-[14px] text-ink-2 leading-relaxed">
                            <Icon name="Check" className="h-4 w-4 text-brand shrink-0 mt-1" />
                            <span>{it}</span>
                          </li>
                        ))}
                      </ul>
                    )
                    return null
                  })}
                </div>
              </section>
            </Card>
          ))}

          <Card className="p-5 flex items-center justify-between gap-4 flex-wrap bg-surface-2">
            <p className="text-[13.5px] text-muted">Ficou com alguma dúvida sobre o manual?</p>
            <div className="flex gap-2">
              <Badge tone="brand" dot>Atualizado · jul/2026</Badge>
              <a href="mailto:rh@4juris.com.br" className="text-[13px] font-semibold text-brand hover:underline flex items-center gap-1.5">
                <Icon name="Mail" className="h-4 w-4" /> Falar com o RH
              </a>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
