/* ============================================================
   4JURIS Pessoas · Dados FICTÍCIOS de demonstração (seed)
   ------------------------------------------------------------
   - Pessoas, CNPJs e valores são inventados e servem só para
     demonstrar os fluxos. A interface sinaliza "modo demonstração".
   - Datas são relativas ao dia de hoje, para a demo continuar viva.
   - Pontos NÃO são números soltos: são gerados a partir de ações
     registradas na própria demo (presenças, reconhecimentos etc.),
     pelo mesmo motor de regras usado pela aplicação.
   Substitua por um adaptador de dados real — ver docs/ARQUITETURA.md.
   ============================================================ */
import type {
  DB, Colaborador, LancamentoPontos, AcaoPontuavel, ConquistaObtida, Evento, NotaFiscal,
} from './types'
import { hojeISO, somarDias } from '@/domain/datas'
import { CONFIG_GAMIFICACAO_PADRAO, avaliarPontuacao, conquistasNovas } from '@/domain/gamificacao'
import { POLITICA_PADRAO } from '@/domain/disponibilidade'
import { CONFIG_INICIO_PADRAO, gerarAvaliacoesInicio, gerarParticipantes } from '@/domain/avaliacoes'
import { tracosPadrao, TRACOS } from '@/domain/perfil'
import { chaveAutor, chaveApoio } from '@/domain/anonimato'
import { criarApresentacao as montarApresentacao, modeloPorId } from '@/domain/apresentacoes'

export const DEMO_DOMINIO = 'demo.4juris.com.br'

const PALETTE = ['#0032D2', '#122029', '#0f9d6b', '#c98a12', '#7c3aed', '#0891b2', '#db2777', '#ea580c']

export function seed(hoje = hojeISO()): DB {
  const d = (n: number) => somarDias(hoje, n)
  const ano = Number(hoje.slice(0, 4))
  const mesAtual = hoje.slice(0, 7)
  /** Data de nascimento cujo aniversário cai `n` dias a partir de hoje. */
  const aniv = (anoNasc: number, n: number) => `${anoNasc}${d(n).slice(4)}`
  const ts = (dia: string, h = '10:00') => `${dia}T${h}:00`

  const unidades: DB['unidades'] = [
    { id: 'u1', nome: 'Sede — Belo Horizonte', endereco: 'Endereço fictício, BH/MG', telefone: '(31) 0000-0000' },
    { id: 'u2', nome: 'Remoto', endereco: 'Atuação remota' },
  ]

  const setores: DB['setores'] = [
    { id: 's1', nome: 'Marketing', descricao: 'Prospecção, conteúdo e performance digital.', cor: '#0032D2', icon: 'Sparkles', gestorId: 'c1', liderancaIds: ['c1'], reembolsoApenasLideranca: false, unidadeId: 'u1' },
    { id: 's2', nome: 'Tecnologia', descricao: 'Produto, engenharia e infraestrutura.', cor: '#0891b2', icon: 'Cpu', gestorId: 'c4', liderancaIds: ['c4'], reembolsoApenasLideranca: true, unidadeId: 'u2' },
    { id: 's3', nome: 'Comercial', descricao: 'Vendas, parcerias e expansão de carteira.', cor: '#0f9d6b', icon: 'Target', gestorId: 'c6', liderancaIds: ['c6'], reembolsoApenasLideranca: false, unidadeId: 'u1' },
    { id: 's4', nome: 'Jurídico', descricao: 'Contratos, compliance e suporte jurídico.', cor: '#7c3aed', icon: 'Scale', gestorId: 'c8', liderancaIds: ['c8'], reembolsoApenasLideranca: false, unidadeId: 'u1' },
    { id: 's5', nome: 'Financeiro', descricao: 'Contas, notas fiscais e pagamentos de serviços.', cor: '#c98a12', icon: 'Wallet', gestorId: null, liderancaIds: [], reembolsoApenasLideranca: false, unidadeId: 'u1' },
    { id: 's6', nome: 'RH & Pessoas', descricao: 'Cultura, integração e experiência das pessoas.', cor: '#db2777', icon: 'HeartHandshake', gestorId: 'c9', liderancaIds: ['c9'], reembolsoApenasLideranca: false, unidadeId: 'u1' },
  ]

  const cargos: DB['cargos'] = [
    { id: 'g1', nome: 'Head de Marketing', setorId: 's1', nivel: 'Liderança' },
    { id: 'g2', nome: 'Analista de Conteúdo', setorId: 's1', nivel: 'Pleno' },
    { id: 'g3', nome: 'Gestor(a) de Tráfego', setorId: 's1', nivel: 'Sênior' },
    { id: 'g4', nome: 'Tech Lead', setorId: 's2', nivel: 'Liderança' },
    { id: 'g5', nome: 'Desenvolvedor(a)', setorId: 's2', nivel: 'Pleno' },
    { id: 'g6', nome: 'Designer de Produto', setorId: 's2', nivel: 'Pleno' },
    { id: 'g7', nome: 'Executivo(a) de Vendas', setorId: 's3', nivel: 'Sênior' },
    { id: 'g8', nome: 'SDR', setorId: 's3', nivel: 'Júnior' },
    { id: 'g9', nome: 'Advogado(a)', setorId: 's4', nivel: 'Sênior' },
    { id: 'g10', nome: 'Analista Financeiro', setorId: 's5', nivel: 'Pleno' },
    { id: 'g11', nome: 'Analista de Pessoas', setorId: 's6', nivel: 'Pleno' },
    { id: 'g12', nome: 'Diretoria Executiva', setorId: 's6', nivel: 'Liderança' },
  ]

  const priv = (a = true, m = true, dst = true) => ({ mostrarAniversario: a, mostrarMarcos: m, aparecerEmDestaques: dst })

  const P = (
    n: number, nome: string, papel: Colaborador['papel'], setorId: string, cargoId: string, status: Colaborador['status'],
    entrada: string, nascimento: string | undefined, cidade: string, uf: string, razao: string, cnpj: string, unidadeId = 'u1',
  ): Colaborador => {
    const slug = nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(' ')
    return {
      id: `c${n}`, nome, email: `${slug[0]}.${slug[slug.length - 1]}@${DEMO_DOMINIO}`, telefone: `(31) 90000-00${String(n).padStart(2, '0')}`,
      avatarCor: PALETTE[n % PALETTE.length], papel, setorId, cargoId, unidadeId, status, dataEntrada: entrada, nascimento,
      cidade, uf, regime: 'PJ', razaoSocial: razao, cnpj,
      banco: 'Banco Demo', agencia: '0001', conta: `0000${n}-0`, pixTipo: 'CNPJ', pixChave: cnpj,
      emergenciaNome: 'Contato de emergência (demo)', emergenciaTelefone: '(31) 90000-9999', emergenciaParentesco: 'Familiar',
      privacidade: priv(),
    }
  }

  const colaboradores: Colaborador[] = [
    P(1, 'Marina Alves', 'admin', 's1', 'g1', 'ativo', `${ano - 4}-03-14`, aniv(1990, 9), 'Belo Horizonte', 'MG', 'Marina Alves Marketing (demo)', '00.111.001/0001-01'),
    P(2, 'Rafael Costa', 'colaborador', 's1', 'g3', 'ativo', `${ano - 3}-01-09`, aniv(1994, 2), 'Belo Horizonte', 'MG', 'RC Performance Digital (demo)', '00.111.002/0001-02'),
    P(3, 'Beatriz Nunes', 'colaborador', 's1', 'g2', 'ativo', `${ano - 3}-08-21`, aniv(1998, 34), 'São Paulo', 'SP', 'Bia Nunes Comunicação (demo)', '00.111.003/0001-03', 'u2'),
    P(4, 'Diego Martins', 'gestor', 's2', 'g4', 'ativo', `${ano - 5}-11-02`, aniv(1988, 120), 'Belo Horizonte', 'MG', 'DM Software (demo)', '00.111.004/0001-04', 'u2'),
    P(5, 'Camila Rocha', 'colaborador', 's2', 'g5', 'ativo', `${ano - 3}-05-15`, aniv(1996, 15), 'Curitiba', 'PR', 'Camila Rocha Dev (demo)', '00.111.005/0001-05', 'u2'),
    P(6, 'Lucas Ferreira', 'gestor', 's3', 'g7', 'ativo', d(-730 - 5), aniv(1992, 48), 'Belo Horizonte', 'MG', 'LF Negócios (demo)', '00.111.006/0001-06'),
    P(7, 'Ana Beatriz Lima', 'colaborador', 's3', 'g8', 'integracao', d(-25), aniv(2000, 200), 'Rio de Janeiro', 'RJ', 'Ana Lima Consultoria (demo)', '00.111.007/0001-07', 'u2'),
    P(8, 'Pedro Henrique Souza', 'gestor', 's4', 'g9', 'ativo', `${ano - 4}-02-28`, aniv(1991, 160), 'Belo Horizonte', 'MG', 'PH Souza Advocacia (demo)', '00.111.008/0001-08'),
    P(9, 'Juliana Prado', 'rh', 's6', 'g11', 'ativo', `${ano - 3}-03-10`, aniv(1995, 26), 'Belo Horizonte', 'MG', 'JP Consultoria em Pessoas (demo)', '00.111.009/0001-09'),
    P(10, 'Thiago Barros', 'colaborador', 's2', 'g6', 'ativo', `${ano - 4}-09-01`, aniv(1993, 75), 'Porto Alegre', 'RS', 'TB Design Studio (demo)', '00.111.010/0001-10', 'u2'),
    P(11, 'Helena Duarte', 'diretoria', 's6', 'g12', 'ativo', `${ano - 6}-06-01`, undefined, 'Belo Horizonte', 'MG', 'HD Gestão (demo)', '00.111.011/0001-11'),
    P(12, 'Otávio Lins', 'colaborador', 's3', 'g8', 'encerrado', `${ano - 2}-02-01`, aniv(1997, 60), 'Belo Horizonte', 'MG', 'OL Vendas (demo)', '00.111.012/0001-12'),
    P(13, 'Sofia Mendes', 'colaborador', 's5', 'g10', 'ativo', d(-400), aniv(1999, 5), 'Belo Horizonte', 'MG', 'Sofia Mendes Finanças (demo)', '00.111.013/0001-13'),
  ]
  const byId = (id: string) => colaboradores.find((c) => c.id === id)!
  // Preferências variadas (demonstram a privacidade funcionando)
  byId('c4').privacidade = priv(false, true, true)
  byId('c10').privacidade = priv(true, false, false)
  byId('c13').privacidade = priv(true, true, false)
  byId('c7').regime = 'MEI'
  byId('c13').regime = 'autonomo'
  Object.assign(byId('c13'), { cnpj: '', razaoSocial: '', cpf: '000.000.000-00', pixTipo: 'E-mail', pixChave: byId('c13').email })
  byId('c12').encerramento = { data: d(-40), motivoId: 'me1', observacao: 'Projeto de expansão concluído.' }

  const valores: Record<string, number> = { c1: 12980, c2: 9400, c3: 6200, c4: 16500, c5: 8900, c6: 7800, c7: 4500, c8: 11200, c9: 7100, c10: 8300, c11: 18000, c12: 4300, c13: 5600 }
  const contratos: DB['contratos'] = colaboradores.map((c, i) => {
    const encerrado = c.status === 'encerrado'
    const fimProximo = c.id === 'c3' ? d(35) : c.id === 'c10' ? d(52) : undefined
    return {
      id: `k${i + 1}`, colaboradorId: c.id, numero: `CPS-${ano}-${String(i + 1).padStart(3, '0')}`,
      objeto: `Prestação de serviços de ${cargos.find((g) => g.id === c.cargoId)?.nome.toLowerCase()} — ${setores.find((s) => s.id === c.setorId)?.nome}`,
      modalidade: c.id === 'c10' ? 'por-projeto' : 'mensal', valorMensal: valores[c.id] ?? 5000,
      inicio: c.dataEntrada, fim: encerrado ? c.encerramento!.data : fimProximo,
      renovacaoAutomatica: !fimProximo && !encerrado, status: encerrado ? 'encerrado' : fimProximo === d(35) ? 'em_renovacao' : 'vigente',
      atualizadoEm: c.dataEntrada,
    }
  })

  const documentos: DB['documentos'] = [
    { id: 'doc1', colaboradorId: 'c1', nome: 'Contrato de prestação de serviços', tipo: 'Contrato', data: byId('c1').dataEntrada, tamanho: '340 KB', confidencial: true },
    { id: 'doc2', colaboradorId: 'c1', nome: 'Cartão CNPJ', tipo: 'Cartão CNPJ', data: byId('c1').dataEntrada, tamanho: '120 KB', confidencial: false },
    { id: 'doc3', colaboradorId: 'c1', nome: 'Certidão negativa de débitos', tipo: 'Certidão', data: d(-150), validade: d(30), tamanho: '96 KB', confidencial: true },
    { id: 'doc4', colaboradorId: 'c2', nome: 'Contrato de prestação de serviços', tipo: 'Contrato', data: byId('c2').dataEntrada, tamanho: '338 KB', confidencial: true },
    { id: 'doc5', colaboradorId: 'c2', nome: 'Certidão negativa de débitos', tipo: 'Certidão', data: d(-200), validade: d(-20), tamanho: '90 KB', confidencial: true },
    { id: 'doc6', colaboradorId: 'c3', nome: 'Aditivo contratual — escopo', tipo: 'Aditivo', data: d(-60), tamanho: '80 KB', confidencial: true },
    { id: 'doc7', colaboradorId: 'c5', nome: 'Certidão negativa de débitos', tipo: 'Certidão', data: d(-170), validade: d(12), tamanho: '91 KB', confidencial: true },
    { id: 'doc8', colaboradorId: 'c7', nome: 'Cartão CNPJ (MEI)', tipo: 'Cartão CNPJ', data: d(-9), tamanho: '110 KB', confidencial: false },
  ]

  const reembolsos: DB['reembolsos'] = [
    { id: 'r1', colaboradorId: 'c1', categoria: 'Software & Ferramentas', descricao: 'Assinatura de ferramenta de design', valor: 540, data: d(-14), status: 'aprovado', comprovante: 'ferramenta.pdf', criadoEm: d(-14), aprovadorId: 'c9', aprovadoEm: d(-12) },
    { id: 'r2', colaboradorId: 'c1', categoria: 'Viagem & Deslocamento', descricao: 'Deslocamento para reunião com cliente', valor: 68.9, data: d(-5), status: 'pendente', comprovante: 'deslocamento.pdf', criadoEm: d(-5) },
    { id: 'r3', colaboradorId: 'c1', categoria: 'Alimentação', descricao: 'Almoço com cliente', valor: 210.5, data: d(-25), status: 'pago', comprovante: 'restaurante.jpg', criadoEm: d(-25), aprovadorId: 'c9', aprovadoEm: d(-23), pagoEm: d(-18) },
    { id: 'r4', colaboradorId: 'c2', categoria: 'Cursos & Educação', descricao: 'Curso de mídia paga', valor: 890, data: d(-18), status: 'pagamento', criadoEm: d(-18), aprovadorId: 'c9', aprovadoEm: d(-15) },
    { id: 'r5', colaboradorId: 'c4', categoria: 'Software & Ferramentas', descricao: 'Licença de IDE anual', valor: 1290, data: d(-11), status: 'pendente', comprovante: 'licenca.pdf', criadoEm: d(-11) },
    { id: 'r6', colaboradorId: 'c6', categoria: 'Viagem & Deslocamento', descricao: 'Visita a cliente no RJ', valor: 430, data: d(-8), status: 'pendente', comprovante: 'passagem.pdf', criadoEm: d(-8) },
    { id: 'r7', colaboradorId: 'c3', categoria: 'Material de escritório', descricao: 'Suporte para notebook', valor: 160, data: d(-6), status: 'pendente', comprovante: 'suporte.pdf', criadoEm: d(-6) },
  ]

  // Notas fiscais: competência atual + histórico de 2 meses do c1.
  const [a, m] = mesAtual.split('-')
  const ativosNF = colaboradores.filter((c) => c.status === 'ativo' || c.status === 'integracao')
  const notas: NotaFiscal[] = ativosNF.map((c, i) => {
    const v = contratos.find((k) => k.colaboradorId === c.id)!.valorMensal
    const st: NotaFiscal['status'] = i % 3 === 0 ? 'enviada' : i % 3 === 1 ? 'aguardando' : 'aprovada'
    return {
      id: `n${i + 1}`, colaboradorId: c.id, competencia: mesAtual, valor: v, status: st,
      prazo: `${a}-${m}-22`, pagamentoEm: `${a}-${m}-25`,
      enviadaEm: st !== 'aguardando' ? d(-3) : undefined,
      aprovadorId: st === 'aprovada' ? 'c9' : undefined, aprovadaEm: st === 'aprovada' ? d(-1) : undefined,
    }
  })
  for (const k of [1, 2]) {
    const dt = new Date(Number(a), Number(m) - 1 - k, 1)
    const comp = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
    notas.push({ id: `nh${k}`, colaboradorId: 'c1', competencia: comp, valor: 12980, status: 'paga', prazo: `${comp}-22`, pagamentoEm: `${comp}-25`, enviadaEm: `${comp}-05`, aprovadorId: 'c9', aprovadaEm: `${comp}-08`, pagaEm: `${comp}-25` })
  }

  const periodos: DB['periodos'] = [
    { id: 'p1', colaboradorId: 'c3', inicio: d(-3), fim: d(8), mensagemEquipe: 'Em descanso. Pautas urgentes com o Rafael.', contatoContinuidadeId: 'c2', planoContinuidade: 'Calendário editorial agendado até o retorno.', status: 'alinhado', alinhadoPorId: 'c1', alinhadoEm: d(-20), criadoEm: d(-30), atualizadoEm: d(-20) },
    { id: 'p2', colaboradorId: 'c10', inicio: d(20), fim: d(34), mensagemEquipe: 'Período de descanso combinado.', status: 'planejado', criadoEm: d(-2), atualizadoEm: d(-2) },
    { id: 'p3', colaboradorId: 'c5', inicio: d(28), fim: d(31), mensagemEquipe: 'Indisponível — compromisso pessoal.', observacaoPrivada: 'Mudança de cidade.', status: 'planejado', criadoEm: d(-1), atualizadoEm: d(-1) },
    { id: 'p4', colaboradorId: 'c1', inicio: d(12), fim: d(12), mensagemEquipe: 'Indisponível neste dia.', status: 'alinhado', alinhadoPorId: 'c9', alinhadoEm: d(-4), criadoEm: d(-6), atualizadoEm: d(-4) },
    { id: 'p5', colaboradorId: 'c2', inicio: d(-60), fim: d(-50), mensagemEquipe: 'Descanso combinado.', status: 'alinhado', alinhadoPorId: 'c1', alinhadoEm: d(-75), criadoEm: d(-80), atualizadoEm: d(-75) },
  ]

  const comunicados: DB['comunicados'] = [
    { id: 'm1', titulo: 'Nova política de reembolsos', resumo: 'Categorias e limites de reembolso de despesas atualizados. Confira o que muda.', corpo: 'Os limites por categoria de reembolso de despesas vinculadas aos serviços foram atualizados. Softwares e ferramentas até R$ 800/mês; cursos até R$ 1.500/semestre. O envio continua pela Central de Reembolsos, sempre com comprovante.', categoria: 'Financeiro', autor: 'Financeiro 4JURIS', autorId: 'c9', data: d(-2), fixado: true, importante: true, lidoPor: [], alvo: 'todos', setoresAlvo: [], usuariosAlvo: [] },
    { id: 'm2', titulo: 'Celebração de fim de trimestre', resumo: 'Encontro aberto para celebrar as entregas do trimestre. Participação opcional.', corpo: 'Vamos celebrar as entregas do trimestre! O encontro é aberto e a participação é opcional. Confirme na Agenda para ajudarmos na organização.', categoria: 'Eventos', autor: 'RH & Pessoas', autorId: 'c9', data: d(-4), lidoPor: ['c1'], alvo: 'todos', setoresAlvo: [], usuariosAlvo: [] },
    { id: 'm3', titulo: 'Notas fiscais do mês: prazo de envio no dia 22', resumo: 'Envie sua NF pela Central de Notas Fiscais. Pagamento no dia 25.', corpo: 'Lembrete: as notas fiscais referentes aos serviços do mês devem ser enviadas até o dia 22, com pagamento previsto para o dia 25. Utilize a Central de Notas Fiscais.', categoria: 'Financeiro', autor: 'Financeiro 4JURIS', autorId: 'c9', data: d(-6), lidoPor: [], alvo: 'todos', setoresAlvo: [], usuariosAlvo: [] },
    { id: 'm4', titulo: 'Tecnologia: foco em performance nas próximas semanas', resumo: 'Comunicado para a área de Tecnologia.', corpo: 'Time de Tecnologia: nas próximas semanas a prioridade dos projetos é performance e observabilidade. Os alinhamentos seguem na agenda combinada de cada projeto.', categoria: 'Geral', autor: 'Diego Martins', autorId: 'c4', data: d(-9), lidoPor: [], alvo: 'setores', setoresAlvo: ['s2'], usuariosAlvo: [] },
    { id: 'm5', titulo: 'Nova trilha de conteúdo: Marketing Jurídico', resumo: 'Trilha voluntária com 6 módulos disponível em Conteúdos.', corpo: 'Está no ar a trilha de Marketing Jurídico, com 6 módulos. O acesso é voluntário e está disponível em Conteúdos & trilhas.', categoria: 'Novidades', autor: 'Academy 4JURIS', autorId: 'c9', data: d(-12), lidoPor: ['c1'], alvo: 'todos', setoresAlvo: [], usuariosAlvo: [] },
  ]

  const ev = (
    id: string, titulo: string, categoria: Evento['categoria'], dia: string, hora: string, local: string, organizadorId: string,
    extra: Partial<Evento> = {},
  ): Evento => ({
    id, titulo, descricao: '', categoria, inicio: ts(dia, hora), local, organizadorId, visibilidade: 'todos', setoresAlvo: [],
    status: 'agendado', confirmados: [], interessados: [], presencas: [], criadoEm: d(-30), ...extra,
  })
  const eventos: Evento[] = [
    ev('e1', 'Celebração de fim de trimestre', 'Celebração', d(4), '18:00', 'Sede — espaço de convivência', 'c9', { descricao: 'Encontro aberto para celebrar as entregas do trimestre.', fim: ts(d(4), '20:00'), confirmados: ['c4', 'c6', 'c2'], interessados: ['c5'], capacidade: 40 }),
    ev('e2', 'Boas práticas de LGPD no dia a dia', 'Aprendizado', d(7), '14:00', 'Online', 'c8', { descricao: 'Conversa aberta sobre proteção de dados nos projetos.', link: 'https://meet.example.com/lgpd', confirmados: ['c1'], fim: ts(d(7), '15:00') }),
    ev('e3', 'Town Hall trimestral', 'Reunião aberta', d(14), '10:00', 'Sede + online', 'c11', { descricao: 'Resultados e direções para o próximo trimestre.', confirmados: ['c1', 'c2', 'c4'], fim: ts(d(14), '11:30') }),
    ev('e4', 'Café de boas-vindas — novas parcerias', 'Integração', d(-6), '09:30', 'Online', 'c9', { descricao: 'Apresentação das pessoas que chegaram neste mês.', confirmados: ['c7', 'c1', 'c9'], presencas: ['c7', 'c1', 'c9'] }),
    ev('e5', 'Oficina de escrita para redes', 'Aprendizado', d(-20), '15:00', 'Online', 'c1', { descricao: 'Técnicas de escrita para conteúdo jurídico.', visibilidade: 'setores', setoresAlvo: ['s1'], confirmados: ['c2', 'c3'], presencas: ['c2', 'c3', 'c1'] }),
    ev('e6', 'Pausa ativa — alongamento guiado', 'Bem-estar', d(-35), '12:00', 'Online', 'c9', { descricao: 'Sessão leve de alongamento.', confirmados: ['c5', 'c10', 'c4', 'c2'], presencas: ['c5', 'c10', 'c4', 'c2'] }),
    ev('e7', 'Demo day de produto', 'Reunião aberta', d(-48), '16:00', 'Online', 'c4', { descricao: 'Apresentação das entregas do ciclo.', confirmados: ['c5', 'c10', 'c1', 'c6'], presencas: ['c5', 'c10', 'c1', 'c6', 'c2'] }),
    ev('e8', 'Happy hour (cancelado)', 'Celebração', d(10), '18:00', 'A definir', 'c6', { status: 'cancelado', motivoCancelamento: 'Remarcado para junto da celebração do trimestre.' }),
  ]

  const beneficios: DB['beneficios'] = [
    { id: 'v1', nome: 'Clube de academias', categoria: 'Bem-estar', descricao: 'Condição de parceria em rede de academias e apps de atividade física.', icon: 'Dumbbell', elegibilidade: 'Prestadores com contrato vigente que optarem pela adesão.', comoUsar: 'Solicite a adesão ao RH; o convite chega no e-mail cadastrado.' },
    { id: 'v2', nome: 'Clube de descontos em saúde', categoria: 'Saúde', descricao: 'Descontos em telemedicina, consultas e farmácias parceiras. Não é plano de saúde.', icon: 'Stethoscope', elegibilidade: 'Adesão opcional, conforme contrato de parceria.', comoUsar: 'Após a adesão, ative pelo app do parceiro.' },
    { id: 'v3', nome: 'Apoio emocional online', categoria: 'Saúde', descricao: 'Acesso facilitado a psicologia online com condições de parceria.', icon: 'HeartPulse', elegibilidade: 'Adesão opcional.', comoUsar: 'Cadastre-se com o e-mail informado ao RH.' },
    { id: 'v4', nome: 'Academy 4JURIS', categoria: 'Educação', descricao: 'Trilhas de conteúdo abertas à comunidade.', icon: 'GraduationCap', elegibilidade: 'Toda a comunidade.', comoUsar: 'Acesse Conteúdos & trilhas.' },
    { id: 'v5', nome: 'Parcerias & descontos', categoria: 'Desconto', descricao: 'Descontos em restaurantes, livrarias e educação.', icon: 'Tags', elegibilidade: 'Toda a comunidade.', comoUsar: 'Consulte a lista de parceiros com o RH.' },
  ]

  const treinamentos: DB['treinamentos'] = [
    { id: 't1', titulo: 'Conhecendo a 4JURIS', descricao: 'Cultura, valores e como a comunidade se organiza.', categoria: 'Cultura', duracaoMin: 45, recomendado: true, modulos: 4 },
    { id: 't2', titulo: 'LGPD na prática', descricao: 'Proteção de dados nos projetos com clientes.', categoria: 'Compliance', duracaoMin: 60, recomendado: true, modulos: 5 },
    { id: 't3', titulo: 'Marketing Jurídico', descricao: 'Trilha de prospecção e conteúdo para o mercado jurídico.', categoria: 'Marketing', duracaoMin: 180, recomendado: false, modulos: 6 },
    { id: 't4', titulo: 'Comunicação e tom de voz', descricao: 'Como a 4JURIS se comunica.', categoria: 'Cultura', duracaoMin: 30, recomendado: false, modulos: 3 },
  ]
  const progressoConteudos: DB['progressoConteudos'] = [
    ...['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c8', 'c9', 'c10', 'c11', 'c13'].map((id) => ({ colaboradorId: id, treinamentoId: 't1', concluidoEm: d(-90) })),
    { colaboradorId: 'c1', treinamentoId: 't2', concluidoEm: d(-40) },
    { colaboradorId: 'c8', treinamentoId: 't2', concluidoEm: d(-38) },
    { colaboradorId: 'c2', treinamentoId: 't3', concluidoEm: d(-15) },
    { colaboradorId: 'c1', treinamentoId: 't4', concluidoEm: d(-10) },
  ]

  const regras: DB['regras'] = [
    { id: 'rg1', acao: 'perfil_completo', nome: 'Completar o perfil', descricao: 'Uma vez, ao preencher dados de contato e emergência.', pontos: 100, ativa: true },
    { id: 'rg2', acao: 'participacao_evento', nome: 'Participar de evento', descricao: 'Concedido quando a organização registra a presença. Uma vez por evento.', pontos: 50, ativa: true },
    { id: 'rg3', acao: 'reconhecimento_recebido', nome: 'Receber reconhecimento', descricao: 'Cada reconhecimento recebido de um colega.', pontos: 40, ativa: true, limiteMensal: 10 },
    { id: 'rg4', acao: 'reconhecimento_enviado', nome: 'Reconhecer um colega', descricao: 'Incentiva a cultura de reconhecimento. Limitado por mês.', pontos: 10, ativa: true, limiteMensal: 5 },
    { id: 'rg5', acao: 'desafio_concluido', nome: 'Concluir desafio', descricao: 'Bônus definido em cada desafio.', pontos: 100, ativa: true },
    { id: 'rg6', acao: 'conteudo_concluido', nome: 'Concluir conteúdo', descricao: 'Uma vez por conteúdo ou trilha concluída.', pontos: 60, ativa: true },
    { id: 'rg7', acao: 'pesquisa_respondida', nome: 'Responder pesquisa', descricao: 'Uma vez por pesquisa. As respostas continuam anônimas.', pontos: 30, ativa: true },
    { id: 'rg8', acao: 'integracao_concluida', nome: 'Concluir integração', descricao: 'Ao concluir o checklist de integração inicial.', pontos: 150, ativa: true },
    { id: 'rg9', acao: 'iniciativa_concluida', nome: 'Contribuir com iniciativa', descricao: 'Pontos definidos em cada iniciativa voluntária, confirmados pela organização.', pontos: 100, ativa: true },
    { id: 'rg10', acao: 'ajuste_manual', nome: 'Ajuste manual', descricao: 'Correções feitas pelo RH, sempre com justificativa registrada.', pontos: 0, ativa: true },
  ]

  const badges: DB['badges'] = [
    { id: 'b1', nome: 'Boas-vindas', descricao: 'Concluiu a integração inicial.', icon: 'Rocket', cor: '#0032D2', raridade: 'comum', criterio: { tipo: 'acao', acao: 'integracao_concluida', quantidade: 1 }, ativa: true },
    { id: 'b2', nome: 'Presente', descricao: 'Participou de 2 eventos da comunidade.', icon: 'CalendarCheck', cor: '#0f9d6b', raridade: 'comum', criterio: { tipo: 'acao', acao: 'participacao_evento', quantidade: 2 }, ativa: true },
    { id: 'b3', nome: 'Aprendiz contínuo', descricao: 'Concluiu 2 conteúdos ou trilhas.', icon: 'GraduationCap', cor: '#c98a12', raridade: 'raro', criterio: { tipo: 'acao', acao: 'conteudo_concluido', quantidade: 2 }, ativa: true },
    { id: 'b4', nome: 'Conector', descricao: 'Participou de 3 eventos da comunidade.', icon: 'Users', cor: '#0891b2', raridade: 'raro', criterio: { tipo: 'acao', acao: 'participacao_evento', quantidade: 3 }, ativa: true },
    { id: 'b5', nome: 'Referência', descricao: 'Recebeu 2 reconhecimentos de colegas.', icon: 'Star', cor: '#db2777', raridade: 'épico', criterio: { tipo: 'acao', acao: 'reconhecimento_recebido', quantidade: 2 }, ativa: true },
    { id: 'b6', nome: 'Gentileza', descricao: 'Reconheceu 3 colegas.', icon: 'HandHeart', cor: '#ea580c', raridade: 'raro', criterio: { tipo: 'acao', acao: 'reconhecimento_enviado', quantidade: 3 }, ativa: true },
    { id: 'b7', nome: 'Inspiração', descricao: 'Alcançou o nível 5.', icon: 'Crown', cor: '#7c3aed', raridade: 'lendário', criterio: { tipo: 'nivel', nivel: 5 }, ativa: true },
  ]

  const reconhecimentos: DB['reconhecimentos'] = [
    { id: 'rc1', deId: 'c4', paraId: 'c5', valor: 'Excelência', mensagem: 'Obrigado pela investigação cuidadosa do incidente de performance!', publico: true, criadoEm: ts(d(-3)) },
    { id: 'rc2', deId: 'c1', paraId: 'c2', valor: 'Colaboração', mensagem: 'Valeu por cobrir as pautas urgentes nesta semana.', publico: true, criadoEm: ts(d(-2)) },
    { id: 'rc3', deId: 'c9', paraId: 'c1', valor: 'Cuidado', mensagem: 'A recepção da Ana no café de boas-vindas foi incrível.', publico: true, criadoEm: ts(d(-5)) },
    { id: 'rc4', deId: 'c2', paraId: 'c1', valor: 'Protagonismo', mensagem: 'Obrigado por puxar a oficina de escrita!', publico: true, criadoEm: ts(d(-19)) },
    { id: 'rc5', deId: 'c6', paraId: 'c8', valor: 'Aprendizado', mensagem: 'A revisão contratual me ensinou muito.', publico: false, criadoEm: ts(d(-12)) },
    { id: 'rc6', deId: 'c1', paraId: 'c9', valor: 'Colaboração', mensagem: 'Parceria impecável na organização dos eventos.', publico: true, criadoEm: ts(d(-30)) },
    { id: 'rc7', deId: 'c1', paraId: 'c3', valor: 'Criatividade', mensagem: 'O calendário editorial ficou lindo.', publico: true, criadoEm: ts(d(-28)) },
  ]

  const desafios: DB['desafios'] = [
    { id: 'd1', titulo: 'Mês do reconhecimento', descricao: 'Reconheça 3 colegas neste mês. Pequenos gestos fortalecem a cultura.', inicio: `${mesAtual}-01`, fim: d(20), criterio: { acao: 'reconhecimento_enviado', meta: 3 }, pontosBonus: 120, participantes: ['c1', 'c2', 'c9'], criadoPorId: 'c9' },
    { id: 'd2', titulo: 'Trilha do conhecimento', descricao: 'Conclua 2 conteúdos da Academy durante o desafio.', inicio: d(-30), fim: d(30), criterio: { acao: 'conteudo_concluido', meta: 2 }, pontosBonus: 150, participantes: ['c1', 'c2'], criadoPorId: 'c9' },
    { id: 'd3', titulo: 'Comunidade em movimento', descricao: 'Participe de 2 eventos da comunidade no período.', inicio: d(-50), fim: d(-1), criterio: { acao: 'participacao_evento', meta: 2 }, pontosBonus: 100, participantes: ['c5', 'c10', 'c1'], criadoPorId: 'c9' },
  ]

  const iniciativas: DB['iniciativas'] = [
    { id: 'i1', titulo: 'Escrever um artigo para o blog da comunidade', descricao: 'Compartilhe um aprendizado recente em até 800 palavras. Contribuição voluntária.', pontos: 150, status: 'aberta', voluntarioId: null, criadaPor: 'c9', criadaEm: d(-6) },
    { id: 'i2', titulo: 'Gravar dicas para quem está chegando', descricao: 'Vídeo curto (até 1 min) com uma dica para novas parcerias. Voluntário.', pontos: 120, status: 'andamento', voluntarioId: 'c2', criadaPor: 'c9', criadaEm: d(-15) },
    { id: 'i3', titulo: 'Organizar uma roda de leitura', descricao: 'Escolher um livro e conduzir um encontro aberto à comunidade.', pontos: 180, status: 'revisao', voluntarioId: 'c3', criadaPor: 'c1', criadaEm: d(-25), entrega: 'Encontro realizado com 8 pessoas; resumo publicado no mural.' },
    { id: 'i4', titulo: 'Mentoria de boas-vindas', descricao: 'Acompanhar uma nova parceria nas primeiras semanas (voluntário).', pontos: 200, status: 'aberta', voluntarioId: null, criadaPor: 'c9', criadaEm: d(-3) },
    { id: 'i5', titulo: 'Curadoria de ferramentas úteis', descricao: 'Montar uma lista colaborativa de ferramentas recomendadas.', pontos: 100, status: 'concluida', voluntarioId: 'c5', criadaPor: 'c4', criadaEm: d(-45), entrega: 'Lista publicada no mural.', confirmadaPor: 'c4', concluidaEm: d(-33) },
  ]

  const checklists: DB['checklists'] = [
    {
      id: 'ck1', nome: 'Integração de nova parceria', tipo: 'integracao', itens: [
        { id: 'ci1', titulo: 'Contrato de prestação de serviços assinado', responsavel: 'rh', prazoDias: 0 },
        { id: 'ci2', titulo: 'Enviar cartão CNPJ e dados para emissão de NF', responsavel: 'pessoa', prazoDias: 3 },
        { id: 'ci3', titulo: 'Liberar acessos às ferramentas do projeto', responsavel: 'lideranca', prazoDias: 2 },
        { id: 'ci4', titulo: 'Conhecer a 4JURIS (conteúdo de cultura)', responsavel: 'pessoa', prazoDias: 7 },
        { id: 'ci5', titulo: 'Conversa de alinhamento do escopo com a área', responsavel: 'lideranca', prazoDias: 5 },
        { id: 'ci6', titulo: 'Completar perfil e preferências de privacidade', responsavel: 'pessoa', prazoDias: 7 },
        { id: 'ci7', titulo: 'Café de boas-vindas com a comunidade (opcional)', responsavel: 'rh', prazoDias: 14 },
      ],
    },
    {
      id: 'ck2', nome: 'Encerramento de parceria', tipo: 'encerramento', itens: [
        { id: 'ce1', titulo: 'Registrar distrato ou término do contrato', responsavel: 'rh', prazoDias: 0 },
        { id: 'ce2', titulo: 'Repasse das entregas em andamento', responsavel: 'lideranca', prazoDias: 5 },
        { id: 'ce3', titulo: 'Revogar acessos às ferramentas', responsavel: 'lideranca', prazoDias: 5 },
        { id: 'ce4', titulo: 'Conferir última nota fiscal e reembolsos pendentes', responsavel: 'rh', prazoDias: 10 },
        { id: 'ce5', titulo: 'Conversa de encerramento (opcional)', responsavel: 'rh', prazoDias: 10 },
      ],
    },
  ]
  const processos: DB['processos'] = [
    {
      id: 'pj1', colaboradorId: 'c7', modeloId: 'ck1', tipo: 'integracao', iniciadoEm: d(-25),
      itens: checklists[0].itens.map((i, idx) => ({ ...i, feito: idx < 3 || idx === 6, feitoEm: idx < 3 || idx === 6 ? d(-8 + idx) : undefined, feitoPorId: idx < 3 ? (i.responsavel === 'pessoa' ? 'c7' : 'c9') : undefined })),
    },
    {
      id: 'pj2', colaboradorId: 'c13', modeloId: 'ck1', tipo: 'integracao', iniciadoEm: d(-400), concluidoEm: d(-380),
      itens: checklists[0].itens.map((i) => ({ ...i, feito: true, feitoEm: d(-385), feitoPorId: 'c9' })),
    },
    {
      id: 'pj3', colaboradorId: 'c12', modeloId: 'ck2', tipo: 'encerramento', iniciadoEm: d(-45), concluidoEm: d(-38),
      itens: checklists[1].itens.map((i) => ({ ...i, feito: true, feitoEm: d(-39), feitoPorId: 'c9' })),
    },
  ]

  const motivosEncerramento: DB['motivosEncerramento'] = [
    { id: 'me1', nome: 'Conclusão do projeto / escopo', ativo: true },
    { id: 'me2', nome: 'Não renovação do contrato', ativo: true },
    { id: 'me3', nome: 'Rescisão por iniciativa da prestadora', ativo: true },
    { id: 'me4', nome: 'Rescisão por iniciativa da contratante', ativo: true },
    { id: 'me5', nome: 'Acordo entre as partes (distrato)', ativo: true },
    { id: 'me6', nome: 'Outro', ativo: true },
  ]

  const tiposRegistro: DB['tiposRegistro'] = [
    { id: 'tr1', nome: 'Alinhamento contratual', ativo: true },
    { id: 'tr2', nome: 'Atualização cadastral', ativo: true },
    { id: 'tr3', nome: 'Ocorrência operacional', ativo: true },
    { id: 'tr4', nome: 'Reconhecimento formal', ativo: true },
    { id: 'tr5', nome: 'Outro', ativo: true },
  ]
  const registros: DB['registros'] = [
    { id: 'ra1', colaboradorId: 'c3', tipoId: 'tr1', data: d(-60), descricao: 'Aditivo de escopo assinado (inclusão de gestão de redes).', autorId: 'c9', criadoEm: d(-60) },
    { id: 'ra2', colaboradorId: 'c7', tipoId: 'tr2', data: d(-9), descricao: 'Cadastro inicial e dados da MEI conferidos.', autorId: 'c9', criadoEm: d(-9) },
    { id: 'ra3', colaboradorId: 'c12', tipoId: 'tr1', data: d(-45), descricao: 'Comunicado de término por conclusão do projeto de expansão.', autorId: 'c9', criadoEm: d(-45) },
  ]

  const objetivos: DB['objetivos'] = [
    { id: 'o1', titulo: 'Leads qualificados do mês', descricao: 'Leads qualificados gerados por campanhas.', setorId: 's1', periodo: mesAtual, meta: 120, atual: 84, unidadeMedida: 'leads', responsavelId: 'c1' },
    { id: 'o2', titulo: 'Tempo de carregamento do portal', descricao: 'Reduzir o p95 de carregamento.', setorId: 's2', periodo: mesAtual, meta: 100, atual: 60, unidadeMedida: '% do plano', responsavelId: 'c4' },
    { id: 'o3', titulo: 'Novos contratos de clientes', descricao: 'Contratos de clientes assinados no mês.', setorId: 's3', periodo: mesAtual, meta: 10, atual: 7, unidadeMedida: 'contratos', responsavelId: 'c6' },
    { id: 'o4', titulo: 'Revisões contratuais', descricao: 'Revisões concluídas no prazo combinado.', setorId: 's4', periodo: mesAtual, meta: 30, atual: 31, unidadeMedida: 'revisões', responsavelId: 'c8' },
  ]

  const pesquisas: DB['pesquisas'] = [
    {
      id: 'q1', titulo: 'Pulso da comunidade — trimestre atual', descricao: 'Pesquisa voluntária e anônima sobre a experiência de colaboração com a 4JURIS.',
      perguntas: [
        { id: 'q1p1', texto: 'Tenho clareza sobre o escopo e as expectativas dos meus projetos.', tipo: 'escala' },
        { id: 'q1p2', texto: 'A comunicação da empresa chega a mim de forma clara.', tipo: 'escala' },
        { id: 'q1p3', texto: 'De 0 a 10, quanto você recomendaria a 4JURIS como parceira a um(a) colega profissional?', tipo: 'enps' },
        { id: 'q1p4', texto: 'Que tipo de evento você gostaria de ter mais?', tipo: 'opcoes', opcoes: ['Aprendizado', 'Celebração', 'Bem-estar', 'Reunião aberta'] },
        { id: 'q1p5', texto: 'Sugestões (opcional)', tipo: 'texto' },
      ],
      inicio: d(-10), fim: d(15), status: 'aberta', setoresAlvo: [], minimoRespostas: 3, criadaPor: 'c9', criadaEm: d(-12),
    },
    {
      id: 'q2', titulo: 'Avaliação do café de boas-vindas', descricao: 'Feedback anônimo sobre o evento de integração.',
      perguntas: [
        { id: 'q2p1', texto: 'O encontro me ajudou a conhecer a comunidade.', tipo: 'escala' },
        { id: 'q2p2', texto: 'Comentários (opcional)', tipo: 'texto' },
      ],
      inicio: d(-6), fim: d(-1), status: 'encerrada', setoresAlvo: [], minimoRespostas: 3, criadaPor: 'c9', criadaEm: d(-6),
    },
  ]
  // Respostas fictícias (demo) — sem identidade, apenas área.
  const respostas: DB['respostas'] = [
    { id: 'rp1', pesquisaId: 'q1', setorId: 's1', respostas: { q1p1: 4, q1p2: 5, q1p3: 9, q1p4: 'Aprendizado', q1p5: 'Mais trilhas práticas.' }, enviadaEm: d(-8) },
    { id: 'rp2', pesquisaId: 'q1', setorId: 's2', respostas: { q1p1: 3, q1p2: 4, q1p3: 8, q1p4: 'Bem-estar' }, enviadaEm: d(-7) },
    { id: 'rp3', pesquisaId: 'q1', setorId: 's2', respostas: { q1p1: 4, q1p2: 3, q1p3: 7, q1p4: 'Aprendizado' }, enviadaEm: d(-7) },
    { id: 'rp4', pesquisaId: 'q1', setorId: 's3', respostas: { q1p1: 5, q1p2: 4, q1p3: 10, q1p4: 'Celebração', q1p5: 'Gostei dos comunicados mais curtos.' }, enviadaEm: d(-5) },
    { id: 'rp5', pesquisaId: 'q1', setorId: 's2', respostas: { q1p1: 2, q1p2: 4, q1p3: 6, q1p4: 'Reunião aberta' }, enviadaEm: d(-4) },
    { id: 'rp6', pesquisaId: 'q2', setorId: 's3', respostas: { q2p1: 5 }, enviadaEm: d(-5) },
    { id: 'rp7', pesquisaId: 'q2', setorId: 's6', respostas: { q2p1: 4, q2p2: 'Ótima recepção!' }, enviadaEm: d(-5) },
    { id: 'rp8', pesquisaId: 'q2', setorId: 's1', respostas: { q2p1: 5 }, enviadaEm: d(-4) },
  ]
  const participacoes: DB['participacoes'] = [
    { pesquisaId: 'q1', colaboradorId: 'c2' }, { pesquisaId: 'q1', colaboradorId: 'c5' }, { pesquisaId: 'q1', colaboradorId: 'c10' },
    { pesquisaId: 'q1', colaboradorId: 'c6' }, { pesquisaId: 'q1', colaboradorId: 'c4' },
    { pesquisaId: 'q2', colaboradorId: 'c7' }, { pesquisaId: 'q2', colaboradorId: 'c9' }, { pesquisaId: 'q2', colaboradorId: 'c1' },
  ]

  /* ---------- Pontos derivados das ações acima (mesmo motor da aplicação) ---------- */
  const lancamentos: LancamentoPontos[] = []
  let seq = 0
  const pontuar = (pessoaId: string, acao: AcaoPontuavel, ref: string, desc: string, quando: string, pontos?: number) => {
    const r = avaliarPontuacao(lancamentos, regras, { pessoaId, acao, referenciaId: ref, descricao: desc, agora: quando.length > 10 ? quando : ts(quando), pontos }, () => `l${++seq}`)
    if (r.ok) lancamentos.push(r.lancamento)
  }
  colaboradores.filter((c) => c.id !== 'c7' && c.id !== 'c12').forEach((c) => pontuar(c.id, 'perfil_completo', 'perfil', 'Perfil completo', c.dataEntrada > d(-200) ? c.dataEntrada : d(-200)))
  processos.filter((p) => p.concluidoEm && p.tipo === 'integracao').forEach((p) => pontuar(p.colaboradorId, 'integracao_concluida', p.id, 'Integração inicial concluída', p.concluidoEm!))
  ;['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c8', 'c9', 'c10', 'c11'].forEach((id) => pontuar(id, 'integracao_concluida', `hist-${id}`, 'Integração inicial concluída', d(-300)))
  eventos.forEach((e) => e.presencas.forEach((pid) => pontuar(pid, 'participacao_evento', e.id, `Presença: ${e.titulo}`, e.inicio)))
  progressoConteudos.forEach((p) => pontuar(p.colaboradorId, 'conteudo_concluido', p.treinamentoId, `Conteúdo: ${treinamentos.find((t) => t.id === p.treinamentoId)?.titulo}`, p.concluidoEm))
  ;[...reconhecimentos].sort((x, y) => x.criadoEm.localeCompare(y.criadoEm)).forEach((r) => {
    pontuar(r.paraId, 'reconhecimento_recebido', r.id, `Reconhecimento (${r.valor})`, r.criadoEm)
    pontuar(r.deId, 'reconhecimento_enviado', r.id, 'Reconheceu um colega', r.criadoEm)
  })
  participacoes.forEach((p) => pontuar(p.colaboradorId, 'pesquisa_respondida', p.pesquisaId, 'Respondeu a uma pesquisa', d(-5)))
  iniciativas.filter((i) => i.status === 'concluida' && i.voluntarioId).forEach((i) => pontuar(i.voluntarioId!, 'iniciativa_concluida', i.id, `Iniciativa: ${i.titulo}`, i.concluidaEm!, i.pontos))
  // Desafio encerrado d3: quem atingiu a meta recebe o bônus.
  for (const pid of desafios[2].participantes) {
    const qtd = lancamentos.filter((l) => l.colaboradorId === pid && l.acao === 'participacao_evento' && l.criadoEm.slice(0, 10) >= desafios[2].inicio && l.criadoEm.slice(0, 10) <= desafios[2].fim).length
    if (qtd >= desafios[2].criterio.meta) pontuar(pid, 'desafio_concluido', 'd3', `Desafio: ${desafios[2].titulo}`, desafios[2].fim, desafios[2].pontosBonus)
  }
  const conquistas: ConquistaObtida[] = []
  colaboradores.forEach((c) => {
    conquistasNovas(lancamentos, badges, conquistas, c.id, CONFIG_GAMIFICACAO_PADRAO.niveis)
      .forEach((b) => conquistas.push({ colaboradorId: c.id, badgeId: b.id, obtidaEm: d(-1) }))
  })

  const parabens: DB['parabens'] = [
    { id: 'pb1', deId: 'c9', paraId: 'c2', ocasiao: `aniversario-${ano}`, mensagem: 'Feliz aniversário, Rafa! 🎉', criadoEm: ts(d(0), '08:30') },
  ]

  const notificacoes: DB['notificacoes'] = [
    { id: 'no1', colaboradorId: 'c1', tipo: 'prazo', titulo: 'Nota fiscal do mês', texto: 'Envie sua nota fiscal até o dia 22.', data: ts(d(-1), '09:00'), lida: false, href: '/notas' },
    { id: 'no2', colaboradorId: 'c1', tipo: 'aprovacao', titulo: 'Reembolso aprovado', texto: 'Seu reembolso "Assinatura de ferramenta de design" foi aprovado.', data: ts(d(-12), '15:30'), lida: false, href: '/reembolsos' },
    { id: 'no3', colaboradorId: 'c1', tipo: 'gamificacao', titulo: 'Você recebeu um reconhecimento', texto: 'Juliana reconheceu você por Cuidado.', data: ts(d(-5), '11:00'), lida: false, href: '/experiencia' },
    { id: 'no4', colaboradorId: 'c1', tipo: 'comunicado', titulo: 'Novo comunicado', texto: 'Nova política de reembolsos.', data: ts(d(-2), '08:00'), lida: true, href: '/comunicados' },
    { id: 'no5', colaboradorId: 'c1', tipo: 'disponibilidade', titulo: 'Período registrado na sua área', texto: 'Beatriz Nunes registrou um período de descanso combinado.', data: ts(d(-30), '10:00'), lida: true, href: '/disponibilidade' },
    { id: 'no6', colaboradorId: 'c2', tipo: 'gamificacao', titulo: 'Você recebeu um reconhecimento', texto: 'Marina reconheceu você por Colaboração.', data: ts(d(-2), '10:00'), lida: false, href: '/experiencia' },
    { id: 'no7', colaboradorId: 'c4', tipo: 'disponibilidade', titulo: 'Período planejado na sua área', texto: 'Thiago Barros registrou um período de indisponibilidade.', data: ts(d(-2), '10:00'), lida: false, href: '/lideranca' },
    { id: 'no8', colaboradorId: 'c9', tipo: 'pendencia', titulo: 'Integração em andamento', texto: 'Ana Beatriz Lima tem itens de integração pendentes.', data: ts(d(-1), '09:00'), lida: false, href: '/rh/jornadas' },
  ]


  /* ---------- Ficha complementar, diversidade (com consentimento) e perfis ---------- */
  const ficha: Record<string, Partial<Colaborador>> = {
    c1: { escolaridade: 'pos_graduacao', curso: 'Marketing digital', celular: '(31) 90000-1001', diversidade: { consentimento: true, consentidoEm: d(-200), genero: 'feminino', racaEtnia: 'branca', pcd: false, estadoCivil: 'casado' } },
    c2: { escolaridade: 'superior_completo', curso: 'Publicidade', responsavelId: 'c1', diversidade: { consentimento: true, consentidoEm: d(-150), genero: 'masculino', racaEtnia: 'parda', pcd: false, estadoCivil: 'solteiro' } },
    c3: { escolaridade: 'superior_completo', curso: 'Jornalismo', responsavelId: 'c1', diversidade: { consentimento: true, consentidoEm: d(-120), genero: 'feminino', racaEtnia: 'preta', pcd: false, estadoCivil: 'solteiro' } },
    c4: { escolaridade: 'mestrado', curso: 'Ciência da computação', diversidade: { consentimento: true, consentidoEm: d(-100), genero: 'masculino', racaEtnia: 'branca', pcd: false, estadoCivil: 'uniao_estavel' } },
    c5: { escolaridade: 'superior_completo', curso: 'Sistemas de informação', responsavelId: 'c4', diversidade: { consentimento: true, consentidoEm: d(-90), genero: 'feminino', racaEtnia: 'amarela', pcd: true, tipoDeficiencia: 'Auditiva', estadoCivil: 'solteiro' } },
    c6: { escolaridade: 'superior_incompleto', curso: 'Administração' },
    c7: { escolaridade: 'medio_completo', responsavelId: 'c6' },
    c8: { escolaridade: 'pos_graduacao', curso: 'Direito digital', diversidade: { consentimento: true, consentidoEm: d(-80), genero: 'masculino', racaEtnia: 'parda', pcd: false, estadoCivil: 'casado' } },
    c9: { escolaridade: 'pos_graduacao', curso: 'Gestão de pessoas', diversidade: { consentimento: true, consentidoEm: d(-60), genero: 'feminino', racaEtnia: 'branca', pcd: false, estadoCivil: 'solteiro' } },
    c10: { escolaridade: 'superior_completo', curso: 'Design', responsavelId: 'c4' },
    c13: { escolaridade: 'superior_completo', curso: 'Ciências contábeis' },
  }
  Object.entries(ficha).forEach(([id, f]) => Object.assign(byId(id), f, {
    endereco: { cidade: byId(id).cidade, uf: byId(id).uf, pais: 'Brasil', logradouro: 'Endereço fictício (demo)' },
  }))
  const disc = (e: number, c: number, p: number, a: number) => ({ executor: e, comunicador: c, planejador: p, analista: a })
  const tr = (ajuste: number) => Object.fromEntries(TRACOS.map((t, i) => [t.chave, Math.max(0, Math.min(100, 50 + ((i * 37 + ajuste) % 61) - 30))]))
  const perfis: Record<string, [ReturnType<typeof disc>, number]> = {
    c1: [disc(78, 72, 40, 35), 11], c2: [disc(55, 80, 35, 30), 23], c3: [disc(30, 75, 55, 45), 5], c4: [disc(70, 40, 60, 75), 41],
    c5: [disc(35, 30, 70, 85), 17], c8: [disc(50, 35, 72, 80), 29], c9: [disc(40, 70, 65, 45), 3], c10: [disc(45, 55, 50, 65), 13],
  }
  Object.entries(perfis).forEach(([id, [dd, aj]]) => { byId(id).perfil = { consentimento: true, fonte: 'autodeclarado', atualizadoEm: d(-30), disc: dd, tracos: tr(aj) } })

  /* ---------- Engenharia de funções ---------- */
  const fn: Record<string, Partial<DB['cargos'][number]>> = {
    g1: { codigoCBO: '1423-10', atividades: '- Definir a estratégia de marketing da carteira\n- Coordenar campanhas e calendário editorial\n- Acompanhar indicadores de aquisição', habilidades: ['Estratégia', 'Liderança de projetos', 'Análise de dados'], requisitos: ['Experiência com marketing B2B'], faixaValor: { min: 11000, max: 15000, visivel: false }, perfilIdeal: { disc: disc(75, 70, 45, 40), tracos: tr(11) } },
    g2: { codigoCBO: '2611-25', atividades: '- Produzir conteúdo para blog e redes\n- Revisar textos jurídicos para linguagem acessível', habilidades: ['Redação', 'SEO', 'Pesquisa'], faixaValor: { min: 5000, max: 8000, visivel: true }, funcaoSuperiorId: 'g1', perfilIdeal: { disc: disc(35, 70, 55, 50), tracos: tr(5) } },
    g3: { codigoCBO: '2531-15', atividades: '- Planejar e otimizar mídia paga\n- Relatórios de performance', habilidades: ['Google Ads', 'Meta Ads', 'Analytics'], faixaValor: { min: 7000, max: 11000, visivel: true }, funcaoSuperiorId: 'g1', perfilIdeal: { disc: disc(60, 55, 50, 70), tracos: tr(23) } },
    g4: { codigoCBO: '1425-10', atividades: '- Arquitetura e qualidade técnica\n- Coordenação das entregas de produto', habilidades: ['Arquitetura', 'Mentoria técnica', 'Cloud'], faixaValor: { min: 14000, max: 19000, visivel: false }, perfilIdeal: { disc: disc(65, 45, 65, 75), tracos: tr(41) } },
    g5: { codigoCBO: '2124-05', atividades: '- Desenvolver funcionalidades\n- Revisão de código e testes', habilidades: ['TypeScript', 'React', 'Testes automatizados'], faixaValor: { min: 7000, max: 12000, visivel: true }, funcaoSuperiorId: 'g4', perfilIdeal: { disc: disc(40, 35, 70, 85), tracos: tr(17) } },
  }
  Object.entries(fn).forEach(([id, f]) => Object.assign(cargos.find((g) => g.id === id)!, f))

  const historicoFuncao: DB['historicoFuncao'] = [
    { id: 'hf1', colaboradorId: 'c2', em: d(-300), porId: 'c9', cargoAnteriorId: 'g2', cargoNovoId: 'g3', valorAnterior: 7800, valorNovo: 9400 },
    { id: 'hf2', colaboradorId: 'c5', em: d(-180), porId: 'c9', valorAnterior: 8100, valorNovo: 8900 },
  ]
  const dependentes: DB['dependentes'] = [
    { id: 'dp1', colaboradorId: 'c4', nome: 'Dependente demo 1', parentesco: 'Filho(a)', nascimento: '2018-05-10' },
    { id: 'dp2', colaboradorId: 'c8', nome: 'Dependente demo 2', parentesco: 'Cônjuge' },
    { id: 'dp3', colaboradorId: 'c1', nome: 'Dependente demo 3', parentesco: 'Filho(a)', nascimento: '2020-11-02' },
  ]
  const exigencias: DB['exigencias'] = [
    { id: 'ex1', colaboradorId: 'c4', tipo: 'Certificação técnica', descricao: 'Certificação de nuvem (nível associado)', data: d(-400), validade: d(330), situacao: 'regular', emissor: 'Provedor de nuvem (demo)' },
    { id: 'ex2', colaboradorId: 'c8', tipo: 'Registro profissional', descricao: 'Inscrição na OAB', data: d(-1500), situacao: 'regular', registro: 'OAB/MG 000000 (demo)' },
    { id: 'ex3', colaboradorId: 'c5', tipo: 'Treinamento de segurança (NR)', descricao: 'NR-10 exigido pelo cliente para visita técnica', data: d(-700), validade: d(-5), situacao: 'irregular', emissor: 'Escola técnica (demo)' },
    { id: 'ex4', colaboradorId: 'c2', tipo: 'Exame exigido por cliente', descricao: 'Exame solicitado pelo cliente X para acesso às instalações', data: d(-340), validade: d(25), situacao: 'com_ressalvas', observacoes: 'Renovar antes da próxima visita.' },
    { id: 'ex5', colaboradorId: 'c8', tipo: 'Seguro de responsabilidade', descricao: 'Seguro de responsabilidade civil profissional', data: d(-200), validade: d(165), situacao: 'regular' },
  ]

  Object.assign(beneficios[0], { tipo: 'bem_estar', fornecedor: 'Clube de academias (demo)', valor: 39.9, aplicadoComo: 'reais', periodicidade: 'mensal', coparticipacao: 100, opcaoCoparticipacao: 'percentual', permiteDependentes: true, ativo: true })
  Object.assign(beneficios[1], { tipo: 'clube_descontos', fornecedor: 'Clube de saúde (demo)', valor: 0, aplicadoComo: 'reais', periodicidade: 'mensal', permiteDependentes: true, ativo: true })
  Object.assign(beneficios[2], { tipo: 'outro', fornecedor: 'Plataforma de psicologia (demo)', valor: 49, aplicadoComo: 'reais', periodicidade: 'mensal', coparticipacao: 50, opcaoCoparticipacao: 'percentual', ativo: true })
  Object.assign(beneficios[3], { tipo: 'auxilio_educacao', valor: 0, periodicidade: 'anual', ativo: true })
  Object.assign(beneficios[4], { tipo: 'clube_descontos', valor: 0, periodicidade: 'mensal', ativo: true })
  beneficios.push({ id: 'v6', nome: 'Plano de saúde coletivo por adesão', categoria: 'Saúde', descricao: 'Plano coletivo por adesão via entidade de classe, com condição negociada.', icon: 'ShieldPlus', elegibilidade: 'Adesão opcional para empresas prestadoras.', comoUsar: 'Fale com o RH para simular valores.', tipo: 'plano_saude', fornecedor: 'Operadora (demo)', valor: 420, aplicadoComo: 'reais', periodicidade: 'mensal', coparticipacao: 100, opcaoCoparticipacao: 'percentual', permiteDependentes: true, ativo: true })
  const beneficiarios: DB['beneficiarios'] = [
    { id: 'bf1', colaboradorId: 'c1', beneficioId: 'v1', desde: d(-300), dependentesIds: [] },
    { id: 'bf2', colaboradorId: 'c4', beneficioId: 'v6', desde: d(-250), dependentesIds: ['dp1'] },
    { id: 'bf3', colaboradorId: 'c8', beneficioId: 'v6', desde: d(-200), dependentesIds: ['dp2'] },
    { id: 'bf4', colaboradorId: 'c5', beneficioId: 'v3', desde: d(-120), dependentesIds: [] },
    { id: 'bf5', colaboradorId: 'c2', beneficioId: 'v1', desde: d(-90), dependentesIds: [] },
  ]

  /* ---------- Competências e avaliações ---------- */
  const gruposCompetencia: DB['gruposCompetencia'] = [
    { id: 'gc1', nome: 'Entrega e qualidade', categoria9box: 'desempenho', ativo: true },
    { id: 'gc2', nome: 'Colaboração e comunicação', categoria9box: 'comportamento', ativo: true },
    { id: 'gc3', nome: 'Adaptação ao início da parceria', categoria9box: 'nenhuma', ativo: true },
  ]
  const competencias: DB['competencias'] = [
    { id: 'cp1', tipo: 'desempenho', grupoId: 'gc1', nome: 'Qualidade das entregas', descricao: 'Entregas atendem ao escopo e ao padrão combinado.', peso: 3, cargoIds: [], ativo: true },
    { id: 'cp2', tipo: 'desempenho', grupoId: 'gc1', nome: 'Cumprimento de prazos combinados', descricao: 'Respeita os prazos acordados para cada entrega.', peso: 2, cargoIds: [], ativo: true },
    { id: 'cp3', tipo: 'desempenho', grupoId: 'gc2', nome: 'Comunicação com a equipe', descricao: 'Mantém a área informada sobre andamento e riscos.', peso: 2, cargoIds: [], ativo: true },
    { id: 'cp4', tipo: 'desempenho', grupoId: 'gc2', nome: 'Colaboração', descricao: 'Contribui com colegas e com a cultura.', peso: 1, cargoIds: [], ativo: true },
    { id: 'cp5', tipo: 'desempenho', grupoId: 'gc1', nome: 'Domínio técnico', descricao: 'Aplica conhecimento técnico da função.', peso: 2, cargoIds: ['g4', 'g5', 'g6'], ativo: true },
    { id: 'cp6', tipo: 'inicio_parceria', grupoId: 'gc3', nome: 'Entendimento do escopo', descricao: 'Compreendeu o escopo e as expectativas.', peso: 2, cargoIds: [], ativo: true },
    { id: 'cp7', tipo: 'inicio_parceria', grupoId: 'gc3', nome: 'Integração com a área', descricao: 'Interage bem com as pessoas e ferramentas da área.', peso: 1, cargoIds: [], ativo: true },
    { id: 'cp8', tipo: 'inicio_parceria', grupoId: 'gc3', nome: 'Primeiras entregas', descricao: 'Qualidade das primeiras entregas.', peso: 2, cargoIds: [], ativo: true },
  ]
  const ciclos: DB['ciclos'] = [
    { id: 'cv1', nome: 'Ciclo de alinhamento — semestre atual', descricao: 'Conversa estruturada sobre as entregas do semestre.', abertura: d(-10), encerramento: d(20), niveisEscala: 5, rotuloEscala: 'desempenho', comentarioCompetenciaMostrar: true, comentarioCompetenciaObrigatorio: false, comentarioGeralObrigatorio: false, tipoRelacao: 'conjunta_180', autoavaliacao: true, regimes: [], status: 'ativo', etapa: 4, criadoEm: d(-12) },
    { id: 'cv2', nome: 'Ciclo de Tecnologia (rascunho)', abertura: d(30), encerramento: d(60), niveisEscala: 4, rotuloEscala: 'concordancia', comentarioCompetenciaMostrar: false, comentarioCompetenciaObrigatorio: false, comentarioGeralObrigatorio: false, tipoRelacao: 'direta_90', autoavaliacao: false, regimes: [], nivelEstrutura: 'area', opcaoEstruturaId: 's2', status: 'rascunho', etapa: 2, criadoEm: d(-2) },
  ]
  let pseq = 0
  const participantesCiclo = gerarParticipantes(ciclos[0], colaboradores, setores, () => `pc${++pseq}`)
  const respostasAvaliacao: DB['respostasAvaliacao'] = []
  participantesCiclo.slice(0, Math.ceil(participantesCiclo.length * 0.6)).forEach((pc, i) => {
    const notas = Object.fromEntries(['cp1', 'cp2', 'cp3', 'cp4', 'cp5'].map((c, j) => [c, 3 + ((i + j) % 3)]))
    respostasAvaliacao.push({ id: `ra${i + 1}`, cicloId: 'cv1', participanteId: pc.id, notas, comentarios: {}, comentarioGeral: i % 3 === 0 ? 'Boa evolução no semestre; manter o ritmo de comunicação.' : undefined, respondidaEm: d(-5 + (i % 4)) })
  })
  let aseq = 0
  const avaliacoesInicio = gerarAvaliacoesInicio(CONFIG_INICIO_PADRAO, colaboradores, setores, [], hoje, () => `ai${++aseq}`).novas
  const classificacoesGrupo: DB['classificacoesGrupo'] = [
    { colaboradorId: 'c4', grupo: 'alto', porId: 'c9', em: d(-20) }, { colaboradorId: 'c8', grupo: 'alto', porId: 'c9', em: d(-20) },
    { colaboradorId: 'c5', grupo: 'alto', porId: 'c9', em: d(-20) }, { colaboradorId: 'c3', grupo: 'desenvolvimento', porId: 'c9', em: d(-20) },
    { colaboradorId: 'c10', grupo: 'desenvolvimento', porId: 'c9', em: d(-20) },
  ]
  const feedbacks: DB['feedbacks'] = [
    { id: 'fb1', colaboradorId: 'c5', data: d(-14), classificacao: 'positivo', comentario: 'Excelente condução do incidente de performance, com comunicação clara para a área.', autorId: 'c4', visivelParaPessoa: true, criadoEm: d(-14) },
    { id: 'fb2', colaboradorId: 'c10', data: d(-20), classificacao: 'para_melhorar', comentario: 'Alinhar com antecedência quando um prazo combinado estiver em risco.', autorId: 'c4', visivelParaPessoa: true, criadoEm: d(-20) },
    { id: 'fb3', colaboradorId: 'c2', data: d(-30), classificacao: 'positivo', comentario: 'Campanha de captação superou a meta combinada.', autorId: 'c1', visivelParaPessoa: true, criadoEm: d(-30) },
    { id: 'fb4', colaboradorId: 'c3', data: d(-45), classificacao: 'neutro', comentario: 'Conversa de alinhamento sobre o novo escopo do aditivo.', autorId: 'c1', visivelParaPessoa: false, criadoEm: d(-45) },
  ]
  registros.forEach((r, i) => { r.classificacao = (['neutro', 'positivo', 'neutro'] as const)[i % 3] })
  objetivos.forEach((o, i) => { o.codigo = `OBJ-${String(i + 1).padStart(3, '0')}` })

  /* ---------- Caixa de sugestões (autoria opaca) ---------- */
  const sg = (id: string, autor: string, titulo: string, descricao: string, categoria: DB['sugestoes'][number]['categoria'], status: DB['sugestoes'][number]['status'], dias: number, apoiadores: string[], resposta?: string): DB['sugestoes'][number] => ({
    id, titulo, descricao, categoria, status, autorChave: chaveAutor(autor), apoios: apoiadores.map((p) => chaveApoio(p, id)), criadaEm: d(-dias),
    ...(resposta ? { resposta, respondidaEm: d(-Math.max(0, dias - 3)), moderadorId: 'c9' } : {}),
  })
  const sugestoes: DB['sugestoes'] = [
    sg('sg1', 'c2', 'Resumo mensal dos comunicados por e-mail', 'Um resumo curto no início do mês com os comunicados importantes ajudaria quem não acessa o portal todo dia.', 'Comunicação', 'aguardando', 2, ['c3', 'c5', 'c10']),
    sg('sg2', 'c5', 'Sala virtual aberta para tirar dúvidas técnicas', 'Um horário fixo semanal, aberto a todas as áreas, para perguntas rápidas entre quem presta serviços.', 'Cultura', 'aguardando', 5, ['c2', 'c4']),
    sg('sg3', 'c10', 'Trilha de onboarding em vídeo', 'Vídeos curtos de 3 minutos apresentando cada área para quem está chegando.', 'Processos', 'aprovada', 14, ['c2', 'c3', 'c5', 'c6', 'c8'], 'Aprovada! Vamos gravar os vídeos no próximo trimestre, começando por Marketing e Tecnologia.'),
    sg('sg4', 'c3', 'Modelo padrão de relatório mensal de entregas', 'Um modelo único facilitaria comparar entregas entre áreas e acelerar a emissão da nota.', 'Processos', 'aprovada', 21, ['c1', 'c2', 'c6'], 'Em andamento: o modelo será publicado na seção Conteúdos & trilhas.'),
    sg('sg5', 'c6', 'Happy hour toda sexta', 'Seria legal ter um encontro fixo toda sexta-feira ao fim do dia.', 'Eventos', 'recusada', 18, ['c7'], 'Obrigada pela ideia! Por ora preferimos eventos pontuais e opcionais, para respeitar a agenda de cada pessoa. Vamos ampliar o calendário de encontros.'),
    sg('sg6', 'c8', 'Integração com ferramenta de contratos', 'Assinar e acompanhar aditivos dentro da plataforma, sem sair para outras ferramentas.', 'Ferramentas', 'aguardando', 1, ['c4']),
  ]
  const apresentacoes: DB['apresentacoes'] = (() => {
    let n = 0
    const novoId = () => `ap${++n}`
    const a = montarApresentacao(modeloPorId('institucional'), 'Boas-vindas à comunidade 4JURIS', 'c9', d(-6), novoId)
    a.id = 'apx1'; a.compartilhada = true
    a.slides[0].valores = { titulo: 'Boas-vindas à comunidade 4JURIS', subtitulo: 'Como trabalhamos, o que esperar e como participar', rodape: 'RH & Pessoas · material de integração' }
    a.slides[1].valores = { titulo: 'O que vamos ver', itens: ['Quem somos', 'Como a comunidade se organiza', 'Notas fiscais e reembolsos', 'Eventos, reconhecimento e sugestões'].join('\n') }
    return [a]
  })()

  return {
    colaboradores, setores, unidades, cargos, contratos, documentos, reembolsos, notas, periodos, comunicados, eventos,
    beneficios, treinamentos, progressoConteudos, badges, conquistas, regras, lancamentos, desafios, reconhecimentos,
    iniciativas, checklists, processos, motivosEncerramento, tiposRegistro, registros, objetivos, pesquisas, respostas,
    participacoes, parabens, notificacoes, auditoria: [],
    historicoFuncao, dependentes, exigencias, beneficiarios, gruposCompetencia, competencias, ciclos, participantesCiclo,
    respostasAvaliacao, avaliacoesInicio, classificacoesGrupo, feedbacks, apresentacoes, sugestoes,
    config: {
      disponibilidade: POLITICA_PADRAO, gamificacao: CONFIG_GAMIFICACAO_PADRAO, financeiro: { diaEnvioNF: 22, diaPagamento: 25 },
      geral: { nomeEmpresa: '4JURIS', razaoSocialTomador: '4JURIS MARKETING LTDA', cnpjTomador: '46.937.316/0001-05', emailRH: 'rh@4juris.com.br', emailFinanceiro: 'financeiro@4juris.com.br' },
      cultura: CULTURA_PADRAO,
      avaliacaoInicio: CONFIG_INICIO_PADRAO,
    },
  }
}

/** Personas para o seletor do login de demonstração. */
export const PERSONAS_DEMO = [
  { id: 'c2', rotulo: 'Colaborador(a)', desc: 'Rafael · Marketing' },
  { id: 'c4', rotulo: 'Liderança', desc: 'Diego · Tecnologia' },
  { id: 'c9', rotulo: 'RH & Pessoas', desc: 'Juliana · RH' },
  { id: 'c11', rotulo: 'Diretoria', desc: 'Helena · visão executiva' },
  { id: 'c1', rotulo: 'Administração', desc: 'Marina · acesso total' },
]

export const CULTURA_PADRAO: DB['config']['cultura'] = {
  proposito: 'Guiar cada passo da trajetória de quem transforma o mercado jurídico.',
  missao: 'Levar inovação e resultado ao marketing jurídico, com ética e proximidade.',
  visao: 'Ser a comunidade de referência em marketing jurídico no Brasil.',
  valores: [
    { nome: 'Colaboração', descricao: 'Construímos juntos e compartilhamos o que aprendemos.', icone: 'Users', cor: '#0032D2' },
    { nome: 'Criatividade', descricao: 'Buscamos soluções novas para problemas antigos.', icone: 'Lightbulb', cor: '#c98a12' },
    { nome: 'Cuidado', descricao: 'Respeito às pessoas, aos clientes e aos combinados.', icone: 'HeartHandshake', cor: '#db2777' },
    { nome: 'Excelência', descricao: 'Entregas bem feitas, no padrão combinado.', icone: 'Gem', cor: '#7c3aed' },
    { nome: 'Aprendizado', descricao: 'Curiosidade e evolução contínua.', icone: 'GraduationCap', cor: '#0f9d6b' },
    { nome: 'Protagonismo', descricao: 'Tomamos a iniciativa e assumimos o que é nosso.', icone: 'Rocket', cor: '#ea580c' },
  ],
}
