/* ============================================================
   Recrutamento · modelos de vaga para funções recorrentes.
   São PONTOS DE PARTIDA editáveis: descrevem a função, nunca a
   empresa. Não trazem remuneração, benefícios, jornada nem
   promessas de crescimento — isso depende de cada abertura e é
   preenchido por quem cria a vaga.
   ============================================================ */

export interface CamposModeloVaga {
  titulo: string
  textoPublico: string
  responsabilidades: string
  desafios: string
  requisitosObrigatorios: string[]
  requisitosDesejaveis: string[]
}

export interface ModeloVaga {
  chave: string
  nome: string
  area: string
  campos: CamposModeloVaga
}

export const MODELOS_VAGA: ModeloVaga[] = [
  {
    chave: 'sdr', nome: 'SDR (pré-vendas)', area: 'Comercial',
    campos: {
      titulo: 'SDR — Pré-vendas',
      textoPublico: 'Buscamos uma pessoa para a linha de frente do time comercial: gerar e qualificar oportunidades com escritórios de advocacia e entregar ao time de fechamento reuniões com real potencial de negócio.',
      responsabilidades: 'Prospecção ativa de escritórios de advocacia por telefone, WhatsApp, e-mail e redes sociais.\nQualificação de leads de acordo com o perfil de cliente definido.\nAgendamento de reuniões para o time de fechamento.\nRegistro completo e atualizado das interações no CRM.\nAcompanhamento diário das metas de atividades e de reuniões qualificadas.',
      desafios: 'Manter volume e qualidade de abordagem ao mesmo tempo, adaptando o discurso a escritórios de portes e áreas de atuação diferentes.',
      requisitosObrigatorios: ['Experiência com prospecção ativa, pré-vendas ou atendimento comercial', 'Boa comunicação escrita e verbal', 'Organização para trabalhar com metas diárias de atividade', 'Familiaridade com CRM ou disposição para aprender rapidamente'],
      requisitosDesejaveis: ['Experiência com vendas B2B', 'Conhecimento do mercado jurídico', 'Vivência com cadências de prospecção'],
    },
  },
  {
    chave: 'closer', nome: 'Closer (executivo de vendas)', area: 'Comercial',
    campos: {
      titulo: 'Closer — Executivo(a) de Vendas',
      textoPublico: 'Procuramos uma pessoa para conduzir reuniões de diagnóstico e fechamento com escritórios de advocacia, transformando oportunidades qualificadas em contratos.',
      responsabilidades: 'Conduzir reuniões de diagnóstico com escritórios qualificados pelo time de pré-vendas.\nApresentar as soluções e montar propostas adequadas a cada cliente.\nNegociar condições e conduzir o fechamento.\nManter o funil atualizado no CRM, com próximos passos definidos.\nFazer a passagem organizada do cliente para a equipe de implantação.',
      desafios: 'Entender a realidade de cada escritório em pouco tempo e construir propostas que façam sentido para o momento do cliente.',
      requisitosObrigatorios: ['Experiência comprovada com fechamento de vendas consultivas', 'Capacidade de negociação e de lidar com objeções', 'Organização do próprio funil e disciplina com CRM', 'Boa comunicação em reuniões on-line'],
      requisitosDesejaveis: ['Experiência com vendas de serviços de marketing ou tecnologia', 'Conhecimento do mercado jurídico', 'Vivência com metas mensais de receita'],
    },
  },
  {
    chave: 'gestor-trafego', nome: 'Gestor(a) de tráfego', area: 'Marketing',
    campos: {
      titulo: 'Gestor(a) de Tráfego Pago',
      textoPublico: 'Buscamos uma pessoa para planejar, executar e otimizar campanhas de mídia paga para escritórios de advocacia, com foco em resultados mensuráveis e respeito às regras de publicidade da advocacia.',
      responsabilidades: 'Planejar e configurar campanhas em Meta Ads e Google Ads.\nAcompanhar métricas diariamente e otimizar públicos, criativos e orçamentos.\nProduzir relatórios de desempenho com análise e próximos passos.\nTrabalhar com o time criativo na definição de anúncios e testes.\nGarantir que as campanhas respeitem as normas de publicidade da advocacia.',
      desafios: 'Gerir várias contas ao mesmo tempo, com objetivos e orçamentos diferentes, mantendo a qualidade das otimizações.',
      requisitosObrigatorios: ['Experiência na gestão de campanhas em Meta Ads e/ou Google Ads', 'Domínio das principais métricas de mídia paga (CPL, CPA, CTR, ROAS)', 'Análise de dados em planilhas', 'Organização para gerir múltiplas contas'],
      requisitosDesejaveis: ['Experiência com clientes do mercado jurídico', 'Conhecimento de Google Analytics e Tag Manager', 'Certificações das plataformas de anúncio'],
    },
  },
  {
    chave: 'designer', nome: 'Designer', area: 'Marketing',
    campos: {
      titulo: 'Designer Gráfico',
      textoPublico: 'Procuramos uma pessoa para criar peças visuais para redes sociais, anúncios e materiais de marca de escritórios de advocacia, com atenção à identidade de cada cliente.',
      responsabilidades: 'Criar peças para redes sociais, anúncios e apresentações.\nAdaptar materiais à identidade visual de cada cliente.\nTrabalhar com redatores e gestores de tráfego na criação de campanhas.\nOrganizar arquivos e versões de forma que outras pessoas encontrem.\nCumprir prazos de entrega combinados com a equipe.',
      desafios: 'Manter qualidade e consistência visual com um volume alto de entregas para clientes diferentes.',
      requisitosObrigatorios: ['Portfólio com trabalhos de design para digital', 'Domínio de Photoshop, Illustrator ou Figma', 'Noções de tipografia, cor e composição', 'Organização com prazos e revisões'],
      requisitosDesejaveis: ['Experiência com motion design ou edição de vídeo', 'Experiência em agência', 'Conhecimento de Canva para templates de clientes'],
    },
  },
  {
    chave: 'desenvolvedor', nome: 'Desenvolvedor(a)', area: 'Tecnologia',
    campos: {
      titulo: 'Desenvolvedor(a) Full Stack',
      textoPublico: 'Buscamos uma pessoa para desenvolver e manter os sistemas internos e os produtos digitais que atendem escritórios de advocacia, com foco em qualidade, segurança e entregas incrementais.',
      responsabilidades: 'Desenvolver novas funcionalidades no front-end e no back-end.\nManter e corrigir sistemas em produção.\nEscrever testes automatizados para o código entregue.\nParticipar das decisões técnicas e das revisões de código.\nDocumentar o que for necessário para outras pessoas darem continuidade.',
      desafios: 'Evoluir sistemas em uso diário sem interromper a operação, equilibrando novas entregas e melhoria do que já existe.',
      requisitosObrigatorios: ['Experiência com JavaScript/TypeScript', 'Experiência com React ou framework equivalente', 'Experiência com bancos de dados relacionais (SQL)', 'Uso de Git no dia a dia'],
      requisitosDesejaveis: ['Node.js no back-end', 'PostgreSQL / Supabase', 'Testes automatizados', 'Noções de LGPD e segurança de aplicações'],
    },
  },
  {
    chave: 'customer-success', nome: 'Customer Success', area: 'Atendimento',
    campos: {
      titulo: 'Analista de Customer Success',
      textoPublico: 'Procuramos uma pessoa para acompanhar escritórios de advocacia após a contratação, garantindo que entendam as entregas, alcancem resultados e permaneçam conosco.',
      responsabilidades: 'Conduzir o onboarding de novos clientes.\nRealizar reuniões periódicas de acompanhamento e apresentação de resultados.\nIdentificar riscos de cancelamento e agir com antecedência.\nRegistrar demandas e acionar as áreas internas responsáveis.\nAcompanhar indicadores de satisfação e retenção da carteira.',
      desafios: 'Equilibrar a expectativa do cliente com a capacidade de entrega das equipes internas, mantendo uma comunicação transparente.',
      requisitosObrigatorios: ['Experiência com atendimento ou relacionamento com clientes B2B', 'Boa comunicação em reuniões e por escrito', 'Organização para acompanhar uma carteira de clientes', 'Capacidade de lidar com situações de insatisfação'],
      requisitosDesejaveis: ['Experiência com Customer Success em agência ou SaaS', 'Conhecimento de marketing digital', 'Conhecimento do mercado jurídico'],
    },
  },
  {
    chave: 'analista-administrativo', nome: 'Analista administrativo', area: 'Administrativo',
    campos: {
      titulo: 'Analista Administrativo(a)',
      textoPublico: 'Buscamos uma pessoa para apoiar as rotinas administrativas e financeiras, mantendo processos organizados, controles em dia e informações confiáveis para a gestão.',
      responsabilidades: 'Controlar contas a pagar e a receber.\nOrganizar documentos, contratos e cadastros.\nApoiar a emissão e a conferência de notas fiscais.\nAtualizar planilhas e relatórios de controle.\nAtender demandas administrativas das demais áreas.',
      desafios: 'Manter os controles atualizados e sem erros em meio a demandas de várias áreas ao mesmo tempo.',
      requisitosObrigatorios: ['Experiência com rotinas administrativas ou financeiras', 'Domínio de planilhas (Excel ou Google Sheets)', 'Atenção a detalhes e organização', 'Boa comunicação escrita'],
      requisitosDesejaveis: ['Formação em Administração, Contabilidade ou áreas afins', 'Experiência com contratos de prestação de serviços', 'Experiência com sistemas de gestão (ERP)'],
    },
  },
  {
    chave: 'analista-rh', nome: 'Analista de RH', area: 'Pessoas',
    campos: {
      titulo: 'Analista de Recursos Humanos',
      textoPublico: 'Procuramos uma pessoa para conduzir rotinas de gestão de pessoas, com foco em recrutamento, integração e acompanhamento do clima da equipe.',
      responsabilidades: 'Conduzir processos seletivos, da abertura da vaga à contratação.\nOrganizar a integração de novas pessoas.\nAplicar e analisar pesquisas de clima e engajamento.\nApoiar lideranças em feedbacks e planos de desenvolvimento.\nManter cadastros e documentos de pessoas atualizados.',
      desafios: 'Estruturar processos de pessoas que acompanhem o crescimento da empresa sem burocracia desnecessária.',
      requisitosObrigatorios: ['Experiência com recrutamento e seleção', 'Boa comunicação e escuta', 'Organização com cadastros e documentos', 'Discrição no trato de informações confidenciais'],
      requisitosDesejaveis: ['Experiência com pesquisas de clima e indicadores de pessoas', 'Conhecimento de LGPD aplicada a RH', 'Formação em Psicologia, Administração ou Gestão de Pessoas'],
    },
  },
]

export const modeloVagaPorChave = (chave: string) => MODELOS_VAGA.find((m) => m.chave === chave)
