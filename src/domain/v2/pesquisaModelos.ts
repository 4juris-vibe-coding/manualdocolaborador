/* ============================================================
   Central de pesquisas · biblioteca de modelos.
   São MODELOS (estrutura de perguntas), nunca resultados. O RH
   escolhe, visualiza e personaliza uma cópia antes de publicar.
   ============================================================ */
import { tempoEstimadoMin, type Operador, type PerguntaPesquisa } from './pesquisaTipos.js'

export type CategoriaModelo = 'Experiência e satisfação' | 'Liderança e gestão' | 'Desenvolvimento e carreira' | 'Rotina e ambiente de trabalho' | 'Ciclos específicos'
export const CATEGORIAS_MODELO: CategoriaModelo[] = ['Experiência e satisfação', 'Liderança e gestão', 'Desenvolvimento e carreira', 'Rotina e ambiente de trabalho', 'Ciclos específicos']

export interface ModeloPesquisa {
  chave: string
  titulo: string
  categoria: CategoriaModelo
  objetivo: string
  descricao: string
  tempoMin: number
  modoSugerido: 'anonima' | 'identificada'
  intro: string
  mensagemFinal: string
  perguntas: PerguntaPesquisa[]
}

/* ---- construtores curtos ---- */
type Item = Omit<PerguntaPesquisa, 'id'> & { se?: { ref: number; operador: Operador; valor?: string | number } }
const lk = (texto: string, dimensao: string, obrigatoria = true): Item => ({ tipo: 'likert', texto, dimensao, obrigatoria })
const enps = (texto = 'Em uma escala de 0 a 10, o quanto você recomendaria a 4JURIS como um bom lugar para trabalhar?'): Item => ({ tipo: 'enps', texto, obrigatoria: true, dimensao: 'eNPS' })
const aberta = (texto: string, se?: Item['se']): Item => ({ tipo: 'texto_longo', texto, obrigatoria: false, se })
const un = (texto: string, opcoes: string[], obrigatoria = true): Item => ({ tipo: 'unica', texto, opcoes, obrigatoria })
const mu = (texto: string, opcoes: string[], obrigatoria = false): Item => ({ tipo: 'multipla', texto, opcoes, obrigatoria })
const sn = (texto: string, obrigatoria = true): Item => ({ tipo: 'sim_nao', texto, obrigatoria })
const es = (texto: string, dimensao?: string): Item => ({ tipo: 'estrelas', texto, obrigatoria: true, dimensao })
const nota = (texto: string, min = 0, max = 10, rotuloMin?: string, rotuloMax?: string): Item => ({ tipo: 'escala', texto, obrigatoria: true, escala: { min, max, rotuloMin, rotuloMax } })
const ordem = (texto: string, opcoes: string[]): Item => ({ tipo: 'ordenacao', texto, opcoes, obrigatoria: true })

function montar(chave: string, itens: Item[]): PerguntaPesquisa[] {
  return itens.map(({ se, ...p }, i) => ({
    ...p,
    id: `q${i + 1}`,
    ...(se ? { condicao: { perguntaId: `q${se.ref + 1}`, operador: se.operador, valor: se.valor } } : {}),
  }))
}

function modelo(m: Omit<ModeloPesquisa, 'tempoMin' | 'perguntas'> & { itens: Item[] }): ModeloPesquisa {
  const { itens, ...resto } = m
  const perguntas = montar(m.chave, itens)
  return { ...resto, perguntas, tempoMin: perguntas.length ? tempoEstimadoMin(perguntas) : 1 }
}

const CONCORDA = 'Indique o quanto você concorda com cada afirmação.'
const FINAL_PADRAO = 'Obrigado por dedicar seu tempo. Sua opinião ajuda a melhorar a 4JURIS.'

export const MODELOS: ModeloPesquisa[] = [
  /* ---------- Experiência e satisfação ---------- */
  modelo({
    chave: 'enps', titulo: 'eNPS — Employee Net Promoter Score', categoria: 'Experiência e satisfação', modoSugerido: 'anonima',
    objetivo: 'Medir a lealdade e a disposição das pessoas em recomendar a empresa como lugar para trabalhar, acompanhando a evolução ao longo do tempo.',
    descricao: 'Pergunta única de 0 a 10, com classificação em promotores, neutros e detratores, e espaço para o motivo.',
    intro: 'Responda com sinceridade: são poucas perguntas e levam cerca de um minuto.', mensagemFinal: FINAL_PADRAO,
    itens: [
      enps(),
      aberta('Qual é o principal motivo da nota que você deu?'),
      aberta('O que a 4JURIS poderia fazer para que você desse uma nota mais alta?', { ref: 0, operador: 'menor_igual', valor: 8 }),
      aberta('O que a 4JURIS faz de melhor e deve continuar fazendo?', { ref: 0, operador: 'maior_igual', valor: 9 }),
      lk('Eu me sinto orgulhoso(a) de trabalhar na 4JURIS.', 'Orgulho'),
      lk('Eu me imagino trabalhando na 4JURIS daqui a um ano.', 'Permanência'),
      un('Há quanto tempo você atua com a 4JURIS?', ['Menos de 6 meses', '6 meses a 1 ano', '1 a 3 anos', 'Mais de 3 anos'], false),
    ],
  }),
  modelo({
    chave: 'satisfacao', titulo: 'Pesquisa de satisfação dos colaboradores', categoria: 'Experiência e satisfação', modoSugerido: 'anonima',
    objetivo: 'Entender o nível de satisfação com o trabalho, o reconhecimento, a remuneração e o ambiente, identificando o que mais pesa na percepção das pessoas.',
    descricao: 'Visão geral de satisfação em cinco dimensões, com pergunta aberta final.',
    intro: CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      es('De modo geral, qual é o seu nível de satisfação com a 4JURIS?', 'Satisfação geral'),
      lk('Estou satisfeito(a) com o trabalho que realizo.', 'Trabalho'),
      lk('Sinto que meu trabalho é reconhecido.', 'Reconhecimento'),
      lk('Considero justa a remuneração pelo que entrego.', 'Remuneração'),
      lk('O ambiente de trabalho é respeitoso.', 'Ambiente'),
      lk('Tenho autonomia para decidir como fazer meu trabalho.', 'Autonomia'),
      lk('Recebo as informações de que preciso para trabalhar bem.', 'Comunicação'),
      ordem('Ordene o que mais influencia sua satisfação (do mais para o menos importante).', ['Remuneração', 'Reconhecimento', 'Ambiente', 'Aprendizado', 'Flexibilidade', 'Liderança']),
      aberta('O que mais contribui para sua satisfação? E o que mais a prejudica?'),
    ],
  }),
  modelo({
    chave: 'clima', titulo: 'Pesquisa de clima organizacional', categoria: 'Experiência e satisfação', modoSugerido: 'anonima',
    objetivo: 'Mapear a percepção sobre o ambiente de trabalho, as relações, a comunicação e a liderança para orientar planos de ação por área.',
    descricao: 'Afirmações em escala Likert agrupadas por dimensão do clima.',
    intro: `${CONCORDA} Não existem respostas certas ou erradas.`, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('As pessoas da minha equipe colaboram entre si.', 'Relacionamento'),
      lk('Sinto que posso ser eu mesmo(a) no trabalho.', 'Relacionamento'),
      lk('Respeito e cordialidade fazem parte do dia a dia.', 'Respeito'),
      lk('Situações de desrespeito são tratadas com seriedade.', 'Respeito'),
      lk('Minha liderança é acessível e ouve a equipe.', 'Liderança'),
      lk('Recebo feedback com frequência suficiente.', 'Liderança'),
      lk('Sei o que se espera de mim.', 'Clareza'),
      lk('As decisões da empresa são comunicadas com clareza.', 'Comunicação'),
      lk('Tenho as condições necessárias para entregar um bom trabalho.', 'Condições'),
      lk('Sinto que posso crescer na 4JURIS.', 'Desenvolvimento'),
      enps(),
      aberta('Que mudança mais melhoraria o clima na sua área?'),
    ],
  }),
  modelo({
    chave: 'engajamento', titulo: 'Pesquisa de engajamento', categoria: 'Experiência e satisfação', modoSugerido: 'anonima',
    objetivo: 'Avaliar o vínculo emocional e a motivação das pessoas com o trabalho e com os objetivos da empresa.',
    descricao: 'Mede energia, dedicação e conexão com o propósito.',
    intro: CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Sinto energia e disposição ao trabalhar.', 'Vigor'),
      lk('Meu trabalho me inspira.', 'Dedicação'),
      lk('O tempo passa rápido quando estou envolvido(a) nas minhas tarefas.', 'Absorção'),
      lk('Compreendo como meu trabalho contribui para os resultados da 4JURIS.', 'Propósito'),
      lk('Acredito no propósito e nos valores da empresa.', 'Propósito'),
      lk('Estou disposto(a) a ir além do esperado quando necessário.', 'Dedicação'),
      lk('Sinto que minhas ideias são valorizadas.', 'Voz'),
      lk('Pretendo continuar contribuindo com a 4JURIS pelos próximos anos.', 'Permanência'),
      aberta('O que mais aumenta o seu engajamento no trabalho?'),
    ],
  }),
  modelo({
    chave: 'experiencia', titulo: 'Pesquisa de experiência do colaborador', categoria: 'Experiência e satisfação', modoSugerido: 'anonima',
    objetivo: 'Entender como as pessoas vivenciam a jornada na empresa — da chegada ao dia a dia — e onde estão os pontos de atrito.',
    descricao: 'Percorre os momentos da jornada: acolhimento, rotina, desenvolvimento e relacionamento com o RH.',
    intro: 'Queremos entender como é a sua experiência por aqui.', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Fui bem acolhido(a) quando comecei.', 'Chegada'),
      lk('Minha rotina de trabalho é organizada e previsível.', 'Rotina'),
      lk('Tenho clareza sobre processos e responsabilidades.', 'Rotina'),
      lk('As ferramentas que uso atendem às minhas necessidades.', 'Ferramentas'),
      lk('Consigo conciliar o trabalho com minha vida pessoal.', 'Equilíbrio'),
      lk('O RH é acessível e resolve minhas solicitações em prazo razoável.', 'Atendimento'),
      lk('Tenho oportunidades reais de aprender coisas novas.', 'Desenvolvimento'),
      es('Como você avalia sua experiência geral na 4JURIS?', 'Experiência geral'),
      mu('Quais momentos da sua jornada mais precisam melhorar?', ['Início da parceria', 'Rotina de trabalho', 'Comunicação', 'Pagamentos e notas fiscais', 'Desenvolvimento', 'Reconhecimento']),
      aberta('Conte uma situação que marcou positiva ou negativamente sua experiência.'),
    ],
  }),

  /* ---------- Liderança e gestão ---------- */
  modelo({
    chave: 'lideranca', titulo: 'Avaliação da liderança', categoria: 'Liderança e gestão', modoSugerido: 'anonima',
    objetivo: 'Avaliar a percepção da equipe sobre a liderança da área, apoiando o desenvolvimento das lideranças.',
    descricao: 'Direção, apoio, comunicação, delegação e desenvolvimento da equipe.',
    intro: 'Pense na liderança direta da sua área ao responder.', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Minha liderança deixa claras as prioridades e os resultados esperados.', 'Direção'),
      lk('Minha liderança toma decisões de forma justa e coerente.', 'Decisão'),
      lk('Minha liderança dá apoio quando enfrento dificuldades.', 'Apoio'),
      lk('Minha liderança comunica mudanças com antecedência e clareza.', 'Comunicação'),
      lk('Minha liderança delega com confiança e dá autonomia.', 'Delegação'),
      lk('Minha liderança reconhece boas entregas.', 'Reconhecimento'),
      lk('Minha liderança se preocupa com o meu desenvolvimento.', 'Desenvolvimento'),
      lk('Minha liderança age de acordo com os valores da empresa.', 'Exemplo'),
      nota('De 0 a 10, o quanto você recomendaria sua liderança direta a um colega?', 0, 10, 'Nada', 'Totalmente'),
      aberta('O que sua liderança faz bem e deve manter? O que poderia fazer diferente?'),
    ],
  }),
  modelo({
    chave: 'feedback-gestor', titulo: 'Feedback sobre o gestor', categoria: 'Liderança e gestão', modoSugerido: 'anonima',
    objetivo: 'Coletar feedback construtivo e específico sobre a atuação do gestor imediato.',
    descricao: 'Foco em comportamentos observáveis, com sugestões práticas.',
    intro: 'O feedback é sobre comportamentos, não sobre pessoas. Seja específico(a) e respeitoso(a).', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Meu gestor dá feedbacks regulares e úteis.', 'Feedback'),
      lk('Meu gestor escuta minhas ideias e preocupações.', 'Escuta'),
      lk('Meu gestor é claro ao definir prazos e prioridades.', 'Clareza'),
      lk('Meu gestor está disponível quando preciso.', 'Disponibilidade'),
      lk('Meu gestor trata as pessoas com respeito.', 'Respeito'),
      lk('Meu gestor ajuda a remover obstáculos do meu trabalho.', 'Apoio'),
      un('Com que frequência você recebe feedback do seu gestor?', ['Nunca', 'Raramente', 'Mensalmente', 'Semanalmente']),
      aberta('Cite uma atitude do seu gestor que ajuda você a trabalhar melhor.'),
      aberta('Cite uma mudança que tornaria a gestão mais efetiva para você.'),
    ],
  }),
  modelo({
    chave: 'confianca-lideranca', titulo: 'Pesquisa de confiança na liderança', categoria: 'Liderança e gestão', modoSugerido: 'anonima',
    objetivo: 'Medir o grau de confiança na alta liderança e na liderança direta: integridade, competência e transparência.',
    descricao: 'Mede confiança em quatro dimensões.',
    intro: CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('A liderança cumpre o que promete.', 'Integridade'),
      lk('A liderança age com honestidade, mesmo quando é difícil.', 'Integridade'),
      lk('Confio na capacidade da liderança de conduzir a empresa.', 'Competência'),
      lk('A liderança toma decisões pensando no bem da empresa e das pessoas.', 'Benevolência'),
      lk('A liderança explica o porquê das decisões importantes.', 'Transparência'),
      lk('A liderança admite erros e aprende com eles.', 'Transparência'),
      lk('Sinto segurança para discordar da liderança.', 'Segurança psicológica'),
      lk('Acredito que o futuro da 4JURIS está em boas mãos.', 'Confiança geral'),
      aberta('O que a liderança poderia fazer para aumentar sua confiança?'),
    ],
  }),
  modelo({
    chave: 'comunicacao-transparencia', titulo: 'Avaliação de comunicação e transparência', categoria: 'Liderança e gestão', modoSugerido: 'anonima',
    objetivo: 'Avaliar a clareza, a frequência e a transparência da comunicação da liderança com as equipes.',
    descricao: 'Clareza, canais, abertura a perguntas e acesso à informação.',
    intro: CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Recebo informações importantes a tempo de agir.', 'Tempestividade'),
      lk('As mensagens da liderança são claras e objetivas.', 'Clareza'),
      lk('Entendo a direção estratégica da empresa.', 'Estratégia'),
      lk('Posso fazer perguntas à liderança e recebo respostas honestas.', 'Abertura'),
      lk('Notícias ruins também são compartilhadas com a equipe.', 'Transparência'),
      lk('Sei onde encontrar as informações de que preciso.', 'Acesso'),
      mu('Quais canais funcionam melhor para você?', ['E-mail', 'Reuniões', 'Mensagens', 'Comunicados na plataforma', 'Conversas individuais']),
      un('Você sente que há informações demais, na medida certa ou de menos?', ['Demais', 'Na medida certa', 'De menos']),
      aberta('O que poderia melhorar na comunicação da empresa?'),
    ],
  }),

  /* ---------- Desenvolvimento e carreira ---------- */
  modelo({
    chave: 'desenvolvimento', titulo: 'Pesquisa de desenvolvimento profissional', categoria: 'Desenvolvimento e carreira', modoSugerido: 'anonima',
    objetivo: 'Entender como as pessoas percebem as oportunidades de aprendizado e crescimento, e o que desejam desenvolver.',
    descricao: 'Aprendizado no trabalho, apoio da liderança e preferências de formato.',
    intro: CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Aprendo coisas novas com frequência no meu trabalho.', 'Aprendizado'),
      lk('Tenho acesso a conteúdos e treinamentos relevantes.', 'Acesso'),
      lk('Minha liderança apoia meu desenvolvimento.', 'Apoio'),
      lk('Tenho tempo para me desenvolver durante a rotina.', 'Tempo'),
      lk('Conheço as competências que preciso desenvolver para evoluir.', 'Clareza'),
      mu('Em quais áreas você gostaria de se desenvolver?', ['Técnica da função', 'Comunicação', 'Liderança', 'Gestão de tempo', 'Tecnologia', 'Negociação', 'Idiomas']),
      mu('Quais formatos de aprendizado funcionam melhor?', ['Cursos online', 'Workshops presenciais', 'Mentoria', 'Leituras e trilhas', 'Projetos práticos']),
      aberta('Qual apoio da empresa faria mais diferença no seu desenvolvimento?'),
    ],
  }),
  modelo({
    chave: 'necessidades-treinamento', titulo: 'Pesquisa de necessidades de treinamento', categoria: 'Desenvolvimento e carreira', modoSugerido: 'identificada',
    objetivo: 'Levantar lacunas de conhecimento e prioridades de capacitação para montar o plano de treinamentos.',
    descricao: 'Identificada, para que o RH possa planejar ações individuais; informe a finalidade ao publicar.',
    intro: 'Suas respostas serão usadas para planejar treinamentos.', mensagemFinal: FINAL_PADRAO,
    itens: [
      mu('Quais temas você considera prioritários para treinamento?', ['Conhecimento técnico da função', 'Ferramentas e sistemas', 'Comunicação e relacionamento', 'Gestão de pessoas', 'Gestão do tempo e produtividade', 'Atendimento ao cliente', 'Compliance e LGPD'], true),
      nota('De 0 a 10, o quanto você se sente preparado(a) para as demandas atuais da sua função?', 0, 10, 'Nada preparado', 'Totalmente'),
      lk('Já deixei de fazer alguma tarefa com qualidade por falta de treinamento.', 'Lacunas'),
      un('Quanto tempo por semana você consegue dedicar a treinamentos?', ['Até 1 hora', '1 a 2 horas', '2 a 4 horas', 'Mais de 4 horas']),
      un('Qual formato você prefere?', ['Online ao vivo', 'Online gravado', 'Presencial', 'Prática com acompanhamento']),
      ordem('Ordene por prioridade o que mais ajudaria o seu desempenho.', ['Treinamento técnico', 'Mentoria', 'Ferramentas melhores', 'Processos mais claros', 'Feedback frequente']),
      aberta('Descreva uma capacitação específica que gostaria de receber.'),
    ],
  }),
  modelo({
    chave: 'expectativas-carreira', titulo: 'Pesquisa de expectativas de carreira', categoria: 'Desenvolvimento e carreira', modoSugerido: 'identificada',
    objetivo: 'Conhecer aspirações profissionais para conectar o crescimento das pessoas às oportunidades da empresa.',
    descricao: 'Identificada: os dados apoiam conversas individuais de carreira com a liderança e o RH.',
    intro: 'Suas respostas serão vistas apenas pelo RH e pela sua liderança direta, para apoiar conversas de carreira.', mensagemFinal: FINAL_PADRAO,
    itens: [
      un('Onde você se vê daqui a 2 anos?', ['Na mesma função, aprofundando conhecimento', 'Em uma função de maior complexidade', 'Em uma função de liderança', 'Em outra área da empresa', 'Ainda não sei']),
      lk('Conheço as possibilidades de crescimento na 4JURIS.', 'Clareza'),
      lk('Minha carreira tem sido discutida com minha liderança.', 'Conversas'),
      mu('O que é mais importante para você na carreira?', ['Remuneração', 'Aprendizado', 'Autonomia', 'Reconhecimento', 'Liderar pessoas', 'Flexibilidade', 'Estabilidade']),
      un('Você deseja assumir responsabilidade de liderança no futuro?', ['Sim, em breve', 'Sim, no médio prazo', 'Talvez', 'Não']),
      mu('Que apoio você precisa para chegar lá?', ['Mentoria', 'Treinamentos', 'Projetos desafiadores', 'Feedback', 'Visibilidade com a liderança']),
      aberta('Conte em suas palavras qual é seu objetivo profissional.'),
    ],
  }),
  modelo({
    chave: 'eficacia-treinamentos', titulo: 'Pesquisa de eficácia de treinamentos', categoria: 'Desenvolvimento e carreira', modoSugerido: 'anonima',
    objetivo: 'Avaliar reação, aprendizado percebido e aplicação prática de um treinamento realizado.',
    descricao: 'Baseada nos níveis de reação e aprendizagem; use logo após e 30 dias depois do treinamento.',
    intro: 'Responda pensando no treinamento mais recente que você fez.', mensagemFinal: FINAL_PADRAO,
    itens: [
      es('De modo geral, como você avalia o treinamento?', 'Reação'),
      lk('Os objetivos do treinamento ficaram claros.', 'Reação'),
      lk('O conteúdo foi relevante para o meu trabalho.', 'Relevância'),
      lk('O instrutor/material tornou o conteúdo fácil de entender.', 'Didática'),
      lk('Aprendi algo que não sabia.', 'Aprendizado'),
      lk('Consigo aplicar o que aprendi no meu trabalho.', 'Aplicação'),
      sn('Você já aplicou algo do treinamento na prática?'),
      nota('De 0 a 10, o quanto você recomendaria este treinamento a um colega?', 0, 10, 'Nada', 'Totalmente'),
      aberta('O que poderia melhorar neste treinamento?'),
    ],
  }),

  /* ---------- Rotina e ambiente de trabalho ---------- */
  modelo({
    chave: 'integracao', titulo: 'Pesquisa de integração de novos colaboradores', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'identificada',
    objetivo: 'Verificar como foi o acolhimento nas primeiras semanas e corrigir falhas na integração.',
    descricao: 'Identificada, para que o RH possa agir rapidamente com quem teve uma experiência ruim.',
    intro: 'Suas respostas serão vistas pelo RH para ajudarmos você a se sentir em casa.', mensagemFinal: 'Obrigado! O RH entrará em contato se houver algo em que possamos ajudar.',
    itens: [
      lk('Fui bem recebido(a) pela minha equipe.', 'Acolhimento'),
      lk('Recebi as informações necessárias para começar a trabalhar.', 'Informação'),
      lk('Tive acesso aos sistemas e ferramentas no prazo.', 'Estrutura'),
      lk('Entendo bem o que se espera de mim.', 'Clareza'),
      lk('Conheci pessoas-chave e sei a quem recorrer.', 'Rede'),
      lk('O que me foi apresentado no processo seletivo corresponde à realidade.', 'Expectativas'),
      nota('De 0 a 10, como você avalia sua integração até agora?', 0, 10, 'Muito ruim', 'Excelente'),
      sn('Você precisa de algum apoio do RH neste momento?'),
      aberta('O que faltou ou poderia ter sido melhor na sua chegada?'),
    ],
  }),
  modelo({
    chave: 'onboarding', titulo: 'Pesquisa de onboarding', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'anonima',
    objetivo: 'Avaliar o processo de onboarding (30/60/90 dias) e a preparação para a função.',
    descricao: 'Foca na qualidade do processo, não no desempenho da pessoa.',
    intro: 'Queremos melhorar o processo de onboarding com a sua experiência.', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('O onboarding apresentou a cultura e os valores da empresa.', 'Cultura'),
      lk('O onboarding me preparou para as atividades da minha função.', 'Preparação'),
      lk('Os materiais e treinamentos iniciais foram úteis.', 'Conteúdo'),
      lk('Meu gestor acompanhou meus primeiros dias de perto.', 'Acompanhamento'),
      lk('O ritmo do onboarding foi adequado.', 'Ritmo'),
      un('Em quanto tempo você se sentiu confiante para trabalhar com autonomia?', ['Menos de 2 semanas', '2 a 4 semanas', '1 a 2 meses', 'Mais de 2 meses', 'Ainda não']),
      es('Como você avalia o onboarding no geral?', 'Avaliação geral'),
      aberta('O que você incluiria ou retiraria do onboarding?'),
    ],
  }),
  modelo({
    chave: 'beneficios', titulo: 'Pesquisa de satisfação com benefícios', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'anonima',
    objetivo: 'Entender o valor percebido dos benefícios e parcerias oferecidos e priorizar novos.',
    descricao: 'Avalia conhecimento, utilidade e prioridades.',
    intro: 'Sua opinião orienta quais vantagens e parcerias manter ou incluir.', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Conheço os benefícios e parcerias disponíveis para mim.', 'Conhecimento'),
      lk('Sei como utilizar cada benefício.', 'Acesso'),
      lk('Os benefícios oferecidos atendem às minhas necessidades.', 'Adequação'),
      es('Qual é sua satisfação geral com os benefícios?', 'Satisfação'),
      mu('Quais benefícios você mais utiliza?', ['Saúde e bem-estar', 'Educação e cursos', 'Lazer e cultura', 'Descontos em parceiros', 'Apoio financeiro']),
      ordem('Ordene o que você gostaria de ver priorizado.', ['Saúde', 'Educação', 'Bem-estar', 'Flexibilidade', 'Apoio financeiro']),
      sn('Há algum benefício que você nunca utilizou por falta de informação?'),
      aberta('Que benefício ou parceria você sugere incluir?'),
    ],
  }),
  modelo({
    chave: 'ferramentas', titulo: 'Pesquisa sobre ferramentas e condições de trabalho', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'anonima',
    objetivo: 'Identificar problemas em ferramentas, sistemas, equipamentos e condições que afetam a produtividade.',
    descricao: 'Aponta gargalos para priorizar investimentos.',
    intro: CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Os sistemas que utilizo são estáveis e rápidos.', 'Sistemas'),
      lk('Os equipamentos que uso atendem bem ao meu trabalho.', 'Equipamentos'),
      lk('Meu espaço de trabalho (físico ou remoto) é adequado.', 'Ambiente'),
      lk('Recebo suporte técnico em prazo razoável.', 'Suporte'),
      lk('Os processos internos me ajudam, em vez de atrapalhar.', 'Processos'),
      un('Quanto do seu tempo semanal se perde por problemas de ferramentas?', ['Quase nada', 'Até 2 horas', '2 a 5 horas', 'Mais de 5 horas']),
      mu('Quais ferramentas mais precisam melhorar?', ['Sistema jurídico/gestão', 'Comunicação interna', 'Armazenamento de arquivos', 'Equipamentos', 'Internet', 'Outras']),
      aberta('Descreva a principal dificuldade com ferramentas ou condições de trabalho.'),
    ],
  }),
  modelo({
    chave: 'bem-estar', titulo: 'Pesquisa de bem-estar organizacional', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'anonima',
    objetivo: 'Mapear carga de trabalho, equilíbrio e bem-estar percebido, sem coletar dados clínicos.',
    descricao: 'Percepções gerais e agregadas — não é avaliação de saúde. Para apoio individual, o RH deve ser procurado.',
    intro: 'Responda sobre as últimas quatro semanas. Esta pesquisa não faz diagnóstico individual.', mensagemFinal: 'Obrigado. Se precisar conversar com alguém, o RH está disponível.',
    itens: [
      lk('Minha carga de trabalho é compatível com o prazo que tenho.', 'Carga'),
      lk('Consigo desligar do trabalho fora do horário combinado.', 'Equilíbrio'),
      lk('Me sinto à vontade para pedir ajuda quando preciso.', 'Apoio'),
      lk('Tenho pausas e momentos de descanso suficientes.', 'Descanso'),
      lk('Sinto que posso falar sobre dificuldades pessoais sem receio.', 'Segurança'),
      nota('De 0 a 10, como você avalia seu bem-estar no trabalho nas últimas semanas?', 0, 10, 'Muito baixo', 'Muito alto'),
      mu('O que mais pesa na sua rotina?', ['Volume de demandas', 'Prazos curtos', 'Interrupções', 'Falta de clareza', 'Conflitos', 'Deslocamento']),
      aberta('O que a empresa poderia fazer para apoiar o seu bem-estar?'),
    ],
  }),
  modelo({
    chave: 'comunicacao-interna', titulo: 'Pesquisa de comunicação interna', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'anonima',
    objetivo: 'Avaliar canais, frequência e utilidade da comunicação interna (comunicados, reuniões, plataforma).',
    descricao: 'Ajuda a ajustar canais e volume de mensagens.',
    intro: CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Os comunicados internos são claros e úteis.', 'Clareza'),
      lk('Recebo as informações pelo canal certo.', 'Canais'),
      lk('As reuniões são objetivas e produtivas.', 'Reuniões'),
      lk('Consigo encontrar informações antigas quando preciso.', 'Acesso'),
      lk('Me sinto por dentro do que acontece na empresa.', 'Pertencimento'),
      un('Com que frequência você acompanha os comunicados da plataforma?', ['Diariamente', 'Algumas vezes por semana', 'Raramente', 'Nunca']),
      mu('Que tipo de conteúdo você gostaria de receber mais?', ['Novidades da empresa', 'Resultados', 'Conquistas das pessoas', 'Conteúdo educativo', 'Eventos']),
      aberta('Que mudança deixaria a comunicação interna melhor?'),
    ],
  }),

  /* ---------- Ciclos específicos ---------- */
  modelo({
    chave: 'desligamento', titulo: 'Pesquisa de desligamento', categoria: 'Ciclos específicos', modoSugerido: 'identificada',
    objetivo: 'Compreender os motivos do encerramento da parceria e coletar aprendizados para melhorar a experiência de quem fica.',
    descricao: 'Identificada, enviada individualmente no encerramento; defina a finalidade e quem acessa ao publicar.',
    intro: 'Agradecemos o período em que trabalhamos juntos. Suas respostas são voluntárias e nos ajudam a melhorar.', mensagemFinal: 'Obrigado pela contribuição e boa sorte nos próximos passos.',
    itens: [
      un('Qual foi o principal motivo do encerramento?', ['Oportunidade melhor', 'Remuneração', 'Falta de crescimento', 'Relacionamento com a liderança', 'Carga de trabalho', 'Motivo pessoal', 'Fim de projeto', 'Outro']),
      mu('Que outros fatores contribuíram?', ['Ambiente', 'Comunicação', 'Reconhecimento', 'Ferramentas', 'Flexibilidade', 'Propósito']),
      lk('Eu recebia o apoio de que precisava da liderança.', 'Liderança'),
      lk('Eu tinha clareza sobre o que se esperava de mim.', 'Clareza'),
      lk('Eu me sentia reconhecido(a) pelo meu trabalho.', 'Reconhecimento'),
      lk('Tive oportunidades de aprender e crescer.', 'Desenvolvimento'),
      enps('De 0 a 10, o quanto você recomendaria a 4JURIS como um bom lugar para trabalhar?'),
      sn('Você voltaria a trabalhar com a 4JURIS no futuro?'),
      aberta('O que a 4JURIS poderia ter feito para que sua experiência fosse melhor?'),
    ],
  }),
  modelo({
    chave: 'mudanca-organizacional', titulo: 'Pesquisa após mudança organizacional', categoria: 'Ciclos específicos', modoSugerido: 'anonima',
    objetivo: 'Avaliar como uma mudança (reestruturação, novo processo, nova liderança) foi comunicada e vivenciada.',
    descricao: 'Aplique de 2 a 4 semanas após a mudança.',
    intro: 'Responda pensando na mudança recente comunicada pela empresa.', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Entendi o motivo da mudança.', 'Compreensão'),
      lk('A mudança foi comunicada com antecedência suficiente.', 'Comunicação'),
      lk('Sei como a mudança afeta o meu trabalho.', 'Impacto'),
      lk('Tive oportunidade de tirar dúvidas e dar opinião.', 'Participação'),
      lk('Recebi o apoio necessário para me adaptar.', 'Apoio'),
      lk('Acredito que a mudança trará benefícios.', 'Confiança'),
      nota('De 0 a 10, o quanto você se sente seguro(a) com a nova situação?', 0, 10, 'Inseguro(a)', 'Seguro(a)'),
      aberta('O que ainda está pouco claro ou preocupa você?'),
    ],
  }),
  modelo({
    chave: 'eventos', titulo: 'Pesquisa de feedback sobre eventos internos', categoria: 'Ciclos específicos', modoSugerido: 'anonima',
    objetivo: 'Coletar a avaliação de um evento interno para melhorar os próximos.',
    descricao: 'Rápida, para enviar logo após o evento.',
    intro: 'Conte-nos o que achou do evento.', mensagemFinal: 'Obrigado pelo feedback!',
    itens: [
      es('Como você avalia o evento no geral?', 'Avaliação geral'),
      lk('O conteúdo/programação foi interessante.', 'Conteúdo'),
      lk('A organização foi boa (horário, local ou link, logística).', 'Organização'),
      lk('Consegui me conectar com colegas.', 'Conexão'),
      un('A duração foi adequada?', ['Curta demais', 'Adequada', 'Longa demais']),
      sn('Você participaria de outro evento como este?'),
      aberta('O que podemos melhorar nos próximos eventos?'),
    ],
  }),
  modelo({
    chave: 'pulso', titulo: 'Pesquisa rápida de pulso', categoria: 'Ciclos específicos', modoSugerido: 'anonima',
    objetivo: 'Acompanhar com frequência (semanal ou quinzenal) o sentimento da equipe em poucas perguntas.',
    descricao: 'Cinco perguntas, menos de um minuto.',
    intro: 'Um minuto para dizer como as coisas estão.', mensagemFinal: 'Obrigado!',
    itens: [
      nota('De 0 a 10, como foi sua semana de trabalho?', 0, 10, 'Muito ruim', 'Excelente'),
      lk('Tive clareza sobre minhas prioridades esta semana.', 'Clareza'),
      lk('Me senti apoiado(a) pela equipe e pela liderança.', 'Apoio'),
      lk('Minha carga de trabalho foi administrável.', 'Carga'),
      lk('Senti que minha opinião foi ouvida.', 'Voz'),
      aberta('Existe algo que deveríamos saber ou resolver agora?'),
    ],
  }),
  modelo({
    chave: 'iniciativas-rh', titulo: 'Pesquisa de feedback sobre iniciativas de RH', categoria: 'Ciclos específicos', modoSugerido: 'anonima',
    objetivo: 'Avaliar a percepção sobre ações, políticas e serviços do RH para orientar prioridades.',
    descricao: 'Atendimento, comunicação, ações de desenvolvimento e reconhecimento.',
    intro: 'Ajude o RH a priorizar o que realmente importa para você.', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('O RH é acessível quando preciso.', 'Atendimento'),
      lk('Minhas solicitações são respondidas em prazo adequado.', 'Atendimento'),
      lk('As iniciativas de reconhecimento fazem sentido para mim.', 'Reconhecimento'),
      lk('As ações de desenvolvimento oferecidas são relevantes.', 'Desenvolvimento'),
      lk('As políticas internas são claras.', 'Políticas'),
      es('Como você avalia o RH no geral?', 'Avaliação geral'),
      ordem('Ordene o que o RH deveria priorizar no próximo ciclo.', ['Reconhecimento', 'Desenvolvimento', 'Comunicação', 'Benefícios', 'Cultura e eventos', 'Processos administrativos']),
      aberta('Que iniciativa de RH você gostaria de ver?'),
    ],
  }),
  modelo({
    chave: 'integracao-areas', titulo: 'Comunicação e integração entre áreas', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'anonima',
    objetivo: 'Identificar falhas de comunicação, dependências mal resolvidas e retrabalho entre departamentos.',
    descricao: 'Fluxo de informações, clareza das demandas, tempo de resposta, responsabilidades e conflitos entre equipes.',
    intro: CONCORDA + ' Pense nas áreas com as quais você mais interage.', mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Recebo das outras áreas as informações de que preciso para fazer meu trabalho.', 'Fluxo de informações'),
      lk('As demandas que chegam de outras áreas vêm claras e completas.', 'Clareza das demandas'),
      lk('Quando dependo de outra área, a resposta chega em prazo adequado.', 'Tempo de resposta'),
      lk('Está claro qual área é responsável por cada etapa dos processos em que atuo.', 'Responsabilidades'),
      lk('Raramente preciso refazer um trabalho por falha de comunicação entre áreas.', 'Retrabalho'),
      lk('As áreas compartilham informações relevantes sem que seja preciso pedir.', 'Compartilhamento'),
      lk('Quando surge um conflito entre áreas, ele é resolvido de forma objetiva.', 'Resolução de conflitos'),
      un('Com que frequência um atraso seu é causado por espera de outra área?', ['Nunca ou quase nunca', 'Algumas vezes por mês', 'Toda semana', 'Quase todos os dias']),
      mu('Onde as falhas de comunicação mais acontecem?', ['Passagem de demandas', 'Prazos e prioridades', 'Mudanças de processo', 'Informações sobre clientes', 'Aprovações', 'Outras']),
      aberta('Descreva uma situação recente em que a integração entre áreas falhou e o que teria ajudado.'),
    ],
  }),
  modelo({
    chave: 'seguranca-psicologica', titulo: 'Segurança psicológica e ambiente de trabalho', categoria: 'Rotina e ambiente de trabalho', modoSugerido: 'anonima',
    objetivo: 'Compreender se as pessoas se sentem seguras para dar opiniões, fazer perguntas, relatar problemas e admitir erros profissionais.',
    descricao: 'Anônima por padrão. Avalia o ambiente coletivo, nunca pessoas específicas.',
    intro: 'Esta pesquisa é sobre o ambiente da equipe, não sobre pessoas. ' + CONCORDA, mensagemFinal: FINAL_PADRAO,
    itens: [
      lk('Posso expressar uma opinião diferente da maioria sem receio.', 'Liberdade de opinião'),
      lk('As interações na minha equipe são respeitosas.', 'Respeito'),
      lk('Divergências são discutidas pelo conteúdo, e não de forma pessoal.', 'Divergências'),
      lk('Consigo pedir ajuda quando não sei fazer algo.', 'Pedir ajuda'),
      lk('Quando alguém comete um erro, o foco é corrigir e aprender, e não culpar.', 'Resposta a erros'),
      lk('Posso relatar um problema sem medo de represálias.', 'Receio de represálias'),
      lk('Tenho boas relações de trabalho com as pessoas com quem atuo.', 'Relações de trabalho'),
      sn('Nos últimos três meses, você deixou de comentar um problema por receio da reação?'),
      aberta('O que tornaria o ambiente mais seguro para falar abertamente?'),
    ],
  }),
  modelo({
    chave: 'onboarding-7', titulo: 'Onboarding · primeira semana (7 dias)', categoria: 'Ciclos específicos', modoSugerido: 'identificada',
    objetivo: 'Verificar, ao fim da primeira semana, se a pessoa recebeu as orientações iniciais e o acesso de que precisa.',
    descricao: 'Curta e identificada, para o RH agir rápido em acessos ou orientações que faltaram.',
    intro: 'Suas respostas serão vistas pelo RH e pela liderança direta para resolver o que faltou na sua chegada.', mensagemFinal: 'Obrigado! Se você indicou alguma pendência, o RH vai procurar você.',
    itens: [
      lk('Recebi orientações claras sobre como funcionam minhas primeiras semanas.', 'Orientações iniciais'),
      lk('Tenho acesso às ferramentas e aos sistemas de que preciso.', 'Acesso a ferramentas'),
      lk('Sei o que se espera de mim neste início.', 'Clareza das expectativas'),
      lk('Fui bem recebido(a) pela equipe.', 'Integração com a equipe'),
      sn('Falta algum acesso, equipamento ou informação para você trabalhar?'),
      aberta('O que está faltando?', { ref: 4, operador: 'igual', valor: 'sim' }),
    ],
  }),
  modelo({
    chave: 'onboarding-30', titulo: 'Onboarding · 30 dias', categoria: 'Ciclos específicos', modoSugerido: 'identificada',
    objetivo: 'Avaliar, após um mês, o apoio do gestor, o conhecimento dos processos e as necessidades de treinamento.',
    descricao: 'Identificada, com finalidade de acompanhamento individual da integração.',
    intro: 'Suas respostas serão vistas pelo RH e pela liderança direta para ajustar o seu acompanhamento.', mensagemFinal: 'Obrigado pela sinceridade!',
    itens: [
      lk('Meu gestor tem me dado o apoio de que preciso.', 'Apoio do gestor'),
      lk('Conheço os principais processos da minha área.', 'Conhecimento dos processos'),
      lk('Sinto segurança para executar minhas atividades.', 'Segurança para executar'),
      lk('Estou integrado(a) à equipe.', 'Integração com a equipe'),
      lk('O trabalho corresponde ao que foi apresentado na seleção.', 'Clareza das expectativas'),
      mu('Em quais temas você gostaria de mais treinamento?', ['Ferramentas e sistemas', 'Processos da área', 'Produtos e serviços', 'Clientes e mercado jurídico', 'Comunicação', 'Outros']),
      aberta('Qual foi a maior dificuldade até aqui?'),
    ],
  }),
  modelo({
    chave: 'onboarding-90', titulo: 'Onboarding · 60 a 90 dias', categoria: 'Ciclos específicos', modoSugerido: 'identificada',
    objetivo: 'Fechar o ciclo de integração: autonomia, clareza de resultados e intenção de continuar.',
    descricao: 'Aplicar entre 60 e 90 dias. Identificada, para orientar o plano de desenvolvimento.',
    intro: 'Suas respostas serão vistas pelo RH e pela liderança direta para fechar o seu ciclo de integração.', mensagemFinal: 'Obrigado! Seu retorno ajuda a melhorar a chegada das próximas pessoas.',
    itens: [
      lk('Trabalho com autonomia nas minhas atividades principais.', 'Autonomia'),
      lk('Sei por quais resultados sou responsável.', 'Clareza das expectativas'),
      lk('Recebo feedback com frequência suficiente.', 'Apoio do gestor'),
      lk('Os processos da área estão claros para mim.', 'Conhecimento dos processos'),
      nota('De 0 a 10, como você avalia sua experiência de integração como um todo?', 0, 10, 'Muito ruim', 'Excelente'),
      un('Como você se vê na 4JURIS daqui a um ano?', ['Na mesma função, mais experiente', 'Em uma função com mais responsabilidade', 'Em outra área', 'Ainda não sei', 'Prefiro não responder']),
      aberta('O que você mudaria no processo de integração?'),
    ],
  }),
  modelo({
    chave: 'personalizada', titulo: 'Pesquisa personalizada', categoria: 'Ciclos específicos', modoSugerido: 'anonima',
    objetivo: 'Começar do zero e montar sua própria pesquisa com qualquer combinação de tipos de pergunta.',
    descricao: 'Sem perguntas prontas.',
    intro: '', mensagemFinal: FINAL_PADRAO,
    itens: [],
  }),
]

export const modeloPorChave = (chave: string) => MODELOS.find((m) => m.chave === chave)

/** Cópia independente das perguntas de um modelo (ids novos não são necessários: são únicos dentro da pesquisa). */
export const copiarPerguntas = (m: ModeloPesquisa): PerguntaPesquisa[] => JSON.parse(JSON.stringify(m.perguntas))
