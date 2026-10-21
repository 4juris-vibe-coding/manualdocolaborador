/* ============================================================
   Conteúdo da Central de Dúvidas 4JURIS
   Cada artigo vira um cartão e uma página de detalhe.
   Para adicionar: copie um objeto, ajuste e inclua o id em GROUPS.
   ============================================================ */
export interface Atividade { codigo: string; nome: string; principal?: boolean }
export interface FaqQA { q: string; a: string }
export interface Artigo {
  id: string
  icon: string // nome lucide
  title: string
  tag: string
  summary: string
  oQueE: string
  comoFunciona: string[]
  atividades?: Atividade[]
  link?: string
  passoAPasso: string[]
  observacoes: string[]
  faq: FaqQA[]
}

export const ARTIGOS: Record<string, Artigo> = {
  wellhub: {
    id: 'wellhub', icon: 'Dumbbell', title: 'Wellhub', tag: 'Benefícios & Bem-estar',
    summary: 'Acesso a academias e apps de atividade física.',
    oQueE: 'O Wellhub é o benefício de bem-estar físico oferecido pela 4JURIS, dando acesso a uma rede de academias, estúdios e aplicativos de atividade física por um plano mensal.',
    comoFunciona: [
      'Depois que o RH libera o benefício para você, o Wellhub envia um convite por e-mail para o endereço informado ao RH.',
      'A ativação é feita pelo próprio colaborador, direto no e-mail recebido — não é necessário nenhum cadastro manual adicional.',
    ],
    passoAPasso: [
      'Abra o e-mail de convite enviado pelo Wellhub.',
      'Clique no link de ativação e conclua o seu cadastro.',
      'Baixe o aplicativo Wellhub no seu celular.',
      'Faça login usando o mesmo e-mail informado ao RH.',
      'Escolha o plano que melhor atende às suas necessidades.',
    ],
    observacoes: [
      'Verifique a caixa de spam ou lixo eletrônico se o convite não aparecer na caixa de entrada.',
      'Confirme com o RH se o e-mail cadastrado está correto.',
      'Se o convite não for localizado após essas checagens, entre em contato com o RH para verificar o envio.',
    ],
    faq: [
      { q: 'Não recebi o e-mail de convite, o que faço?', a: 'Primeiro verifique a caixa de spam. Se não encontrar, confirme com o RH se o e-mail informado está correto e peça para verificarem o envio do convite.' },
      { q: 'Preciso usar o mesmo e-mail cadastrado no RH?', a: 'Sim. O convite chega nesse e-mail e o login do aplicativo deve ser feito com o mesmo endereço.' },
      { q: 'Quando o benefício fica disponível para mim?', a: 'Assim que o RH libera o seu acesso, o convite é enviado automaticamente por e-mail.' },
    ],
  },
  avus: {
    id: 'avus', icon: 'Stethoscope', title: 'Avus', tag: 'Benefícios & Bem-estar',
    summary: 'Clube de benefícios com descontos em saúde.',
    oQueE: 'A Avus não é um plano de saúde, e sim um clube de benefícios que oferece descontos e acesso facilitado a serviços de saúde: telemedicina, plantão médico 24h, consultas presenciais, exames, atendimento odontológico e descontos em farmácias parceiras.',
    comoFunciona: [
      'Após o RH realizar o seu cadastro, a Avus libera o benefício — esse processo pode levar até 7 dias.',
      'Telemedicina: acesse o aplicativo, escolha a especialidade desejada e agende sua consulta online.',
      'Plantão 24 horas: utilize o atendimento imediato com clínico geral direto pelo aplicativo.',
      'Consultas, exames e odontologia: localize no aplicativo a clínica, laboratório ou consultório credenciado e agende.',
      'Farmácias parceiras: informe que possui o benefício Avus e apresente o CPF no caixa. Aceito em redes como Drogasil, Droga Raia, Pague Menos, Drogaria São Paulo e Pacheco.',
    ],
    passoAPasso: [
      'Baixe o aplicativo Avus no seu celular.',
      'Faça login utilizando o seu CPF.',
      'Ative o seu cadastro seguindo as orientações do aplicativo.',
      'Pronto — os benefícios da plataforma já estarão disponíveis.',
    ],
    observacoes: [
      'A liberação do cadastro pode levar até 7 dias após o RH concluir o seu cadastro.',
      'A Avus é um clube de benefícios com descontos, não um plano de saúde tradicional.',
    ],
    faq: [
      { q: 'A Avus substitui um plano de saúde?', a: 'Não. A Avus é um clube de benefícios que oferece descontos e acesso facilitado a serviços de saúde, não um plano de saúde.' },
      { q: 'Quanto tempo demora até eu conseguir usar o benefício?', a: 'Após o cadastro pelo RH, a liberação pela Avus pode levar até 7 dias.' },
      { q: 'Como uso o desconto nas farmácias parceiras?', a: 'Informe no caixa que possui o benefício Avus e apresente o seu CPF. É aceito em redes como Drogasil, Droga Raia, Pague Menos, Drogaria São Paulo e Pacheco.' },
    ],
  },
  starbem: {
    id: 'starbem', icon: 'HeartPulse', title: 'Starbem', tag: 'Benefícios & Bem-estar',
    summary: 'Consultas online, psicologia e apoio emocional com IA.',
    oQueE: 'A Starbem oferece acesso a consultas online com médicos e especialistas, atendimento com psicólogos e nutricionistas, uma assistente virtual de IA para acolhimento emocional (Stella) e descontos em exames e medicamentos com parceiros credenciados.',
    comoFunciona: [
      'Após o RH realizar o seu cadastro, o benefício é liberado para utilização automaticamente.',
      'Agendamento de consultas: acesse o aplicativo, escolha a especialidade desejada e agende sua consulta por vídeo.',
      'Assistente virtual Stella: disponível no aplicativo para apoio e acolhimento emocional a qualquer momento.',
      'Descontos em parceiros: consulte no aplicativo os estabelecimentos conveniados para exames e medicamentos.',
    ],
    passoAPasso: [
      'Baixe o aplicativo Starbem no seu celular.',
      'Faça o cadastro utilizando o CPF ou o e-mail informado ao RH.',
      'Confirme seus dados para ativar o acesso.',
      'O sistema reconhece automaticamente o seu vínculo com a empresa e libera os benefícios disponíveis.',
    ],
    observacoes: [
      'O vínculo com a 4JURIS é reconhecido automaticamente pelo aplicativo após o cadastro.',
      'A assistente Stella é um recurso de apoio, e não substitui atendimento profissional em situações de urgência.',
    ],
    faq: [
      { q: 'Quais profissionais estão disponíveis pela Starbem?', a: 'Médicos, especialistas, psicólogos e nutricionistas, além da assistente virtual Stella para acolhimento emocional.' },
      { q: 'O que é a Stella?', a: 'É a assistente virtual com IA da Starbem, disponível no aplicativo para apoio e acolhimento emocional a qualquer momento.' },
      { q: 'Como faço login no aplicativo?', a: 'Usando o CPF ou o e-mail que foi informado ao RH no seu cadastro.' },
    ],
  },
  cadastro_facial: {
    id: 'cadastro_facial', icon: 'ScanFace', title: 'Cadastro Facial', tag: 'Administrativo',
    summary: 'Como solicitar o acesso facial ao prédio.',
    oQueE: 'O cadastro facial é o processo que libera o seu acesso à entrada do prédio por reconhecimento facial.',
    comoFunciona: [
      'O formulário de cadastro é solicitado ao RH.',
      'Após o preenchimento e entrega, as informações são validadas e o cadastro facial é realizado.',
      'Assim que a validação é concluída, o seu acesso ao prédio é liberado.',
    ],
    passoAPasso: [
      'Solicite ao RH o formulário de cadastro.',
      'Preencha todas as informações solicitadas.',
      'Entregue o formulário na recepção do prédio.',
      'Aguarde a validação das informações — o acesso é liberado em seguida.',
    ],
    observacoes: [
      'O formulário deve ser solicitado diretamente ao RH.',
      'A entrega é feita presencialmente, na recepção do prédio.',
    ],
    faq: [
      { q: 'Onde consigo o formulário de cadastro facial?', a: 'Solicite diretamente ao RH.' },
      { q: 'Para onde entrego o formulário preenchido?', a: 'Na recepção do prédio.' },
      { q: 'Quando meu acesso é liberado?', a: 'Depois que as informações do formulário são validadas pelo RH.' },
    ],
  },
  nota_fiscal: {
    id: 'nota_fiscal', icon: 'ReceiptText', title: 'Emissão de Nota Fiscal', tag: 'Administrativo',
    summary: 'Passo a passo para emitir a NFS-e pelo Emissor Nacional.',
    oQueE: 'A emissão da Nota Fiscal de Serviço (NFS-e) para a 4JURIS é feita pelo portal Emissor Nacional, usando a razão social e o CNPJ da empresa.',
    comoFunciona: [
      'Razão Social: 4JURIS MARKETING LTDA',
      'CNPJ: 46.937.316/0001-05',
      'A nota deve ser emitida com a atividade econômica que melhor representa o serviço prestado à 4JURIS. Em caso de dúvida, consulte o Financeiro antes de emitir.',
    ],
    atividades: [
      { codigo: '73.19-0-03', nome: 'Marketing direto', principal: true },
      { codigo: '73.19-0-04', nome: 'Consultoria em publicidade' },
      { codigo: '73.19-0-02', nome: 'Promoção de vendas' },
      { codigo: '63.19-4-00', nome: 'Portais, provedores de conteúdo e serviços de informação na internet' },
      { codigo: '58.19-1-00', nome: 'Edição de cadastros, listas e de outros produtos gráficos' },
      { codigo: '82.19-9-99', nome: 'Preparação de documentos e serviços de apoio administrativo' },
    ],
    passoAPasso: [
      'Acesse o portal do Emissor Nacional e faça login.',
      'Clique em "Nova NFS-e".',
      'Informe os dados da empresa: Razão Social 4JURIS MARKETING LTDA e CNPJ 46.937.316/0001-05.',
      'Preencha a descrição do serviço prestado.',
      'Informe o valor conforme acordado em contrato.',
      'Selecione a atividade econômica compatível com o serviço prestado.',
      'Revise as informações e clique em "Emitir".',
      'Faça o download do PDF da Nota Fiscal.',
      'Envie o PDF para o Financeiro em financeiro@4juris.com.br.',
    ],
    observacoes: [
      'Confira todos os dados antes de emitir a nota — ela não pode ser editada depois.',
      'Guarde uma cópia da Nota Fiscal para seu controle.',
      'Em caso de dúvidas sobre a emissão ou sobre qual atividade utilizar, fale com o Financeiro ou o RH antes de finalizar.',
    ],
    faq: [
      { q: 'Qual atividade econômica eu devo escolher?', a: 'A que melhor representa o serviço que você prestou à 4JURIS. Em caso de dúvida, consulte o Financeiro antes de emitir a nota.' },
      { q: 'Para onde envio a nota depois de emitida?', a: 'Envie o PDF para financeiro@4juris.com.br.' },
      { q: 'Onde acesso o portal para emitir a NFS-e?', a: 'Pelo Emissor Nacional, no link disponibilizado pelo Financeiro/RH.' },
    ],
    link: 'https://www.nfse.gov.br/EmissorNacional/Login?ReturnUrl=%2fEmissorNacional%2fDashboard',
  },
}

export const FAQ_GROUPS: { title: string; items: string[] }[] = [
  { title: 'Parcerias & bem-estar (adesão opcional)', items: ['wellhub', 'avus', 'starbem'] },
  { title: 'Administrativo', items: ['cadastro_facial', 'nota_fiscal'] },
]

export const FAQ_SOON: { icon: string; title: string }[] = [
  { icon: 'Palmtree', title: 'Disponibilidade e descanso combinado' },
  { icon: 'Wallet', title: 'Reembolso' },
  { icon: 'ShieldCheck', title: 'Políticas Internas' },
  { icon: 'Settings2', title: 'Sistemas & Acessos' },
]
