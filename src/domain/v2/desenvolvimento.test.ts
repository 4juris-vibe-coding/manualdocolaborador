import { describe, expect, it } from 'vitest'
import * as D from './desenvolvimento'

const cfg = (extra: Partial<D.ConfigDesenvolvimento> = {}): D.ConfigDesenvolvimento => ({ ...D.CONFIG_PADRAO, inicioVigencia: '2026-01-01', ...extra })

describe('cronograma automático', () => {
  it('30, 60 e 90 dias e depois AVD aos 6 meses, a cada 6 meses', () => {
    const m = D.cronograma('2026-01-31', '2028-02-01')
    expect(m.map((x) => [x.marco, x.data])).toEqual([
      ['30d', '2026-03-02'], ['60d', '2026-04-01'], ['90d', '2026-05-01'],
      ['6m', '2026-07-31'], ['12m', '2027-01-31'], ['18m', '2027-07-31'], ['24m', '2028-01-31'],
    ])
    expect(m.filter((x) => x.tipo === 'avd').map((x) => x.numero)).toEqual([1, 2, 3, 4])
    expect(m.find((x) => x.marco === '30d')!.tipo).toBe('acompanhamento')
  })
  it('a regra semestral continua indefinidamente', () => {
    const m = D.cronograma('2020-03-10', '2026-03-10').filter((x) => x.tipo === 'avd')
    expect(m[m.length - 1]).toMatchObject({ marco: '72m', numero: 12, data: '2026-03-10' })
  })
  it('meses com dia inexistente vão para o último dia do mês', () => {
    expect(D.somarMeses('2026-08-31', 6)).toBe('2027-02-28')
    expect(D.somarMeses('2027-08-31', 6)).toBe('2028-02-29')
  })
  it('abre na janela de antecedência e não gera o passado anterior à vigência', () => {
    const c = cfg({ inicioVigencia: '2026-11-10' })
    // Admitida há 2 anos e 2 meses: as AVDs passadas não são geradas; a próxima ainda não abriu.
    expect(D.marcosDevidos('2024-09-10', '2026-11-10', c)).toEqual([])
    // AVD de 24 meses daqui a 5 dias (antecedência de 10): abre.
    expect(D.marcosDevidos('2024-11-15', '2026-11-10', c).map((x) => x.marco)).toEqual(['24m'])
    // Admitida há 30 dias: só o acompanhamento de 30 dias.
    expect(D.marcosDevidos('2026-10-11', '2026-11-10', c).map((x) => x.marco)).toEqual(['30d'])
  })
  it('nunca abre duas AVDs ao mesmo tempo (só a mais recente)', () => {
    const c = cfg({ inicioVigencia: '2020-01-01' })
    const m = D.marcosDevidos('2025-05-10', '2026-11-10', c)
    expect(m.filter((x) => x.tipo === 'avd').map((x) => x.marco)).toEqual(['18m'])
  })
  it('próximos marcos a partir de hoje', () => {
    expect(D.proximosMarcos('2026-10-11', '2026-11-10', 3).map((x) => x.marco)).toEqual(['30d', '60d', '90d'])
    expect(D.proximosMarcos('2025-01-01', '2026-11-10', 2).map((x) => x.marco)).toEqual(['24m', '30m'])
  })
})

describe('liderança e equipe', () => {
  const setores: D.SetorMin[] = [{ id: 's1', gestorId: 'L', liderancaIds: ['L'] }, { id: 's2', gestorId: null, liderancaIds: [] }]
  const gente: D.PessoaMin[] = [
    { id: 'L', nome: 'Líder', status: 'ativo', setorId: 's1', cargoId: 'g', responsavelId: 'DIR' },
    { id: 'DIR', nome: 'Diretora', status: 'ativo', setorId: 's2', cargoId: 'g' },
    { id: 'A', nome: 'A', status: 'ativo', setorId: 's1', cargoId: 'g' },
    { id: 'B', nome: 'B', status: 'ativo', setorId: 's2', cargoId: 'g', responsavelId: 'L' },
    { id: 'X', nome: 'X', status: 'encerrado', setorId: 's1', cargoId: 'g', responsavelId: 'L' },
    { id: 'C', nome: 'C', status: 'ativo', setorId: 's2', cargoId: 'g', responsavelId: 'X' },
  ]
  it('responsável direto ativo; sem ele, a liderança da área', () => {
    expect(D.liderDe(gente[2], gente, setores)).toBe('L')
    expect(D.liderDe(gente[3], gente, setores)).toBe('L')
    expect(D.liderDe(gente[0], gente, setores)).toBe('DIR')
    // Responsável encerrado e área sem liderança: ninguém (o RH designa).
    expect(D.liderDe(gente[5], gente, setores)).toBeNull()
  })
  it('equipe só com pessoas ativas; quem lidera é identificado', () => {
    expect(D.equipeDe('L', gente, setores).map((p) => p.id).sort()).toEqual(['A', 'B'])
    expect(D.ehLideranca('L', gente, setores)).toBe(true)
    expect(D.ehLideranca('DIR', gente, setores)).toBe(true)
    expect(D.ehLideranca('A', gente, setores)).toBe(false)
  })
  it('formulários: membro × liderança (com e sem superior) × acompanhamento', () => {
    expect(D.formulariosDoCiclo('acompanhamento', 'A', 'L', false, []).map((f) => [f.tipo, f.respondenteId])).toEqual([['acomp_colaborador', 'A'], ['acomp_lideranca', 'L']])
    expect(D.formulariosDoCiclo('avd', 'A', 'L', false, []).map((f) => f.modelo)).toEqual(['avd_auto_membro', 'avd_lider_membro'])
    const lider = D.formulariosDoCiclo('avd', 'L', 'DIR', true, ['A', 'B'])
    expect(lider.map((f) => f.modelo)).toEqual(['avd_auto_lideranca', 'avd_superior_lideranca', 'avd_equipe_lideranca', 'avd_equipe_lideranca'])
    expect(D.formulariosDoCiclo('avd', 'DIR', null, true, ['L']).map((f) => f.tipo)).toEqual(['autoavaliacao', 'equipe_avalia_lider'])
  })
  it('critérios de liderança são diferentes dos de membros', () => {
    const ids = (k: D.ChaveModelo) => D.MODELOS_PADRAO[k].criterios.map((c) => c.id).join()
    expect(ids('avd_auto_lideranca')).not.toBe(ids('avd_auto_membro'))
    expect(D.MODELOS_PADRAO.avd_auto_lideranca.criterios).toHaveLength(12)
    expect(D.MODELOS_PADRAO.avd_equipe_lideranca.criterios).toHaveLength(14)
  })
})

describe('respostas, escala e notas', () => {
  const m = D.MODELOS_PADRAO.avd_auto_membro
  const completa = (): D.Respostas => ({
    notas: Object.fromEntries(m.criterios.map((k) => [k.id, 3])) as Record<string, D.Nota>,
    justificativas: {}, abertas: { contribuicoes: 'x', desenvolver: 'y', objetivos: 'z' },
  })
  it('notas 1, 2 e 5 exigem justificativa; N/A não', () => {
    const r = completa()
    r.notas.qualidade = 1; r.notas.prazos = 5; r.notas.equipe = 'na'
    const e = D.errosDeEnvio(r, m, D.CONFIG_PADRAO)
    expect(Object.keys(e).sort()).toEqual(['prazos', 'qualidade'])
    r.justificativas.qualidade = 'Atrasou duas entregas no mês.'; r.justificativas.prazos = 'Entregou tudo antes do prazo.'
    expect(D.errosDeEnvio(r, m, D.CONFIG_PADRAO)).toEqual({})
  })
  it('critério sem nota e pergunta obrigatória vazia impedem o envio', () => {
    const r = completa(); delete r.notas.qualidade; r.abertas.objetivos = '   '
    const s = D.sanitizarRespostas(r, m)
    expect(Object.keys(D.errosDeEnvio(s, m, D.CONFIG_PADRAO)).sort()).toEqual(['objetivos', 'qualidade'])
  })
  it('acompanhamento usa escala de percepção, sem justificativa obrigatória', () => {
    const a = D.MODELOS_PADRAO.acomp_colaborador
    const r = D.sanitizarRespostas({ notas: Object.fromEntries(a.criterios.map((k) => [k.id, 1])), abertas: { aprendizados: 'muito' } }, a)
    expect(D.errosDeEnvio(r, a, D.CONFIG_PADRAO)).toEqual({})
  })
  it('sanitização descarta itens fora do modelo e valores inválidos', () => {
    const r = D.sanitizarRespostas({ notas: { qualidade: 9, prazos: '4', intruso: 5, equipe: 'na' }, abertas: { hack: 'x' } }, m)
    expect(r.notas).toEqual({ prazos: 4, equipe: 'na' })
    expect(r.abertas).toEqual({})
  })
  it('média ponderada pelos pesos, sem contar N/A', () => {
    const criterios: D.Criterio[] = [{ id: 'a', nome: 'A', dimensao: 'X', peso: 3 }, { id: 'b', nome: 'B', dimensao: 'X', peso: 1 }, { id: 'c', nome: 'C', dimensao: 'X', peso: 5 }]
    expect(D.notaPonderada({ notas: { a: 4, b: 2, c: 'na' } }, criterios)).toBe(3.5)
    expect(D.notaPonderada({ notas: { c: 'na' } }, criterios)).toBeNull()
  })
  it('agregado da equipe some abaixo do mínimo', () => {
    const k = D.MODELOS_PADRAO.avd_equipe_lideranca.criterios
    const r = (n: number) => ({ notas: Object.fromEntries(k.map((x) => [x.id, n])) as Record<string, D.Nota> })
    expect(D.agregar([r(4), r(5)], k, 3)).toMatchObject({ n: 2, suprimido: true, media: null, porCriterio: [] })
    const ag = D.agregar([r(4), r(5), r(3)], k, 3)
    expect(ag.suprimido).toBe(false)
    expect(ag.media).toBe(4)
    expect(ag.porCriterio[0]).toMatchObject({ media: 4, n: 3 })
  })
  it('todos os modelos padrão são válidos (identificadores únicos entre critérios e perguntas)', () => {
    for (const k of D.CHAVES_MODELO) expect(D.validarModelo(D.MODELOS_PADRAO[k]), k).toBeNull()
  })
  it('validação de modelo editado pelo RH', () => {
    expect(D.validarModelo({ titulo: 'T', criterios: [{ id: 'a', nome: 'A', dimensao: 'X', peso: 0 }], perguntas: [] })).toMatch(/Peso/)
    expect(D.validarModelo({ titulo: 'T', criterios: [{ id: 'a', nome: 'A', dimensao: 'X', peso: 1 }], perguntas: [{ id: 'a', texto: 'q', obrigatoria: false }] })).toMatch(/repetido/)
    expect(D.validarModelo({ titulo: 'T', criterios: [{ id: 'a', nome: 'A', dimensao: 'X', peso: 2 }], perguntas: [] })).toBeNull()
  })
})

describe('etapas e status', () => {
  const f = (tipo: D.TipoFormulario, status: D.StatusFormulario): D.FormStatus => ({ tipo, status })
  const avdMembro = { tipo: 'avd' as const, lideranca: false }
  it('coleta só termina com os obrigatórios; equipe fecha no prazo; sem liderança não fecha', () => {
    expect(D.coletaConcluida([f('autoavaliacao', 'enviado'), f('lider_avalia', 'pendente')], '2026-12-01', '2026-11-10', avdMembro)).toBe(false)
    expect(D.coletaConcluida([f('autoavaliacao', 'enviado'), f('lider_avalia', 'enviado')], '2026-12-01', '2026-11-10', avdMembro)).toBe(true)
    expect(D.coletaConcluida([f('autoavaliacao', 'enviado')], '2026-12-01', '2026-11-10', avdMembro)).toBe(false)
    const lider = { tipo: 'avd' as const, lideranca: true }
    const forms = [f('autoavaliacao', 'enviado'), f('equipe_avalia_lider', 'enviado'), f('equipe_avalia_lider', 'pendente')]
    expect(D.coletaConcluida(forms, '2026-12-01', '2026-11-10', lider)).toBe(false)
    expect(D.coletaConcluida(forms, '2026-11-09', '2026-11-10', lider)).toBe(true)
    // Dispensado pelo RH conta como concluído (não respondido ≠ avaliação negativa)
    expect(D.coletaConcluida([f('autoavaliacao', 'dispensado'), f('lider_avalia', 'enviado')], '2026-12-01', '2026-11-10', avdMembro)).toBe(true)
  })
  it('status exibido acompanha o fluxo real', () => {
    const c = (etapa: D.Etapa, extra: Partial<D.CicloMin> = {}): D.CicloMin => ({ tipo: 'avd', etapa, prazo: '2026-12-01', lideranca: false, ...extra })
    expect(D.statusExibido(c('coleta'), [f('autoavaliacao', 'pendente'), f('lider_avalia', 'pendente')])).toBe('aguardando_autoavaliacao')
    expect(D.statusExibido(c('coleta'), [f('autoavaliacao', 'enviado'), f('lider_avalia', 'rascunho')])).toBe('aguardando_lideranca')
    expect(D.statusExibido(c('coleta', { lideranca: true }), [f('autoavaliacao', 'enviado'), f('equipe_avalia_lider', 'pendente')])).toBe('aguardando_equipe')
    expect(D.statusExibido(c('coleta'), [f('autoavaliacao', 'enviado')])).toBe('sem_lideranca')
    expect(D.statusExibido(c('devolutiva'), [])).toBe('aguardando_devolutiva')
    expect(D.statusExibido(c('devolutiva', { tipo: 'acompanhamento' }), [])).toBe('aguardando_registro')
    expect(D.statusExibido(c('encerramento'), [])).toBe('aguardando_encerramento')
    expect(D.etapaAposColeta({ tipo: 'avd', lideranca: true }, true)).toBe('consolidacao')
    expect(D.etapaAposColeta({ tipo: 'avd', lideranca: true }, false)).toBe('devolutiva')
  })
  it('atraso só em ciclo aberto', () => {
    expect(D.emAtraso({ etapa: 'coleta', prazo: '2026-11-09' }, '2026-11-10')).toBe(true)
    expect(D.emAtraso({ etapa: 'concluida', prazo: '2026-11-09' }, '2026-11-10')).toBe(false)
    expect(D.emAtraso({ etapa: 'suspensa', prazo: '2026-11-09' }, '2026-11-10')).toBe(false)
    expect(D.acaoAtrasada({ status: 'em_andamento', prazo: '2026-11-01' }, '2026-11-10')).toBe(true)
    expect(D.acaoAtrasada({ status: 'concluida', prazo: '2026-11-01' }, '2026-11-10')).toBe(false)
  })
  it('configuração fora da faixa volta ao padrão', () => {
    const c = D.normalizarConfig({ feedbackLideranca: { minRespostas: 1 }, avd: { prazoColetaDias: 999 }, justificativaObrigatoria: [1, 9, 2] })
    expect(c.feedbackLideranca.minRespostas).toBe(3)
    expect(c.avd.prazoColetaDias).toBe(20)
    expect(c.justificativaObrigatoria).toEqual([1, 2])
  })
})

describe('afastamentos, semana e configuração nova', () => {
  it('afastamento em curso: início ≤ dia ≤ fim; sem fim fica em aberto', () => {
    const l = [{ id: 'a', inicio: '2026-03-01', fim: '2026-03-10' }, { id: 'b', inicio: '2026-05-01', fim: null }]
    expect(D.afastamentoEm(l, '2026-03-10')?.id).toBe('a')
    expect(D.afastamentoEm(l, '2026-03-11')).toBeNull()
    expect(D.afastamentoEm(l, '2027-01-01')?.id).toBe('b')
  })
  it('retomada estende o prazo pelos dias de pausa, com mínimo de 5 dias a partir de hoje', () => {
    expect(D.prazoAposPausa('2026-03-20', '2026-03-10', '2026-03-30')).toBe('2026-04-09') // 20 dias de pausa
    expect(D.prazoAposPausa('2026-03-11', '2026-03-10', '2026-03-12')).toBe('2026-03-17') // mínimo de 5 dias
  })
  it('semana ISO (chave do resumo semanal)', () => {
    expect(D.semanaISO('2026-11-10')).toBe('2026-W46')
    expect(D.semanaISO('2026-01-01')).toBe('2026-W01')
    expect(D.semanaISO('2027-01-01')).toBe('2026-W53')
  })
  it('e-mail e resumo semanal ligados por padrão; aceitam desligar', () => {
    expect(D.normalizarConfig({})).toMatchObject({ emailNotificacoes: true, resumoSemanalDiretoria: true })
    expect(D.normalizarConfig({ emailNotificacoes: false, resumoSemanalDiretoria: 'x' })).toMatchObject({ emailNotificacoes: false, resumoSemanalDiretoria: true })
  })
})

describe('calibração e comparação para a devolutiva', () => {
  const l = (avaliadorId: string, setor: string, lid: number, auto: number | null = null) => ({ avaliadorId, avaliadorNome: avaliadorId.toUpperCase(), setorNome: setor, notaLideranca: lid, notaAuto: auto })
  it('agrupa por quem avaliou e alerta quem se afasta da média geral (com mínimo de avaliações)', () => {
    const r = D.calibrar([l('a', 'X', 5, 4), l('a', 'X', 5, 4), l('a', 'X', 4.5), l('b', 'Y', 2, 3), l('b', 'Y', 2.5, 3), l('b', 'Y', 2), l('c', 'Y', 3)], 'avaliador')
    expect(r.geral).toBe(3.4)
    const a = r.grupos.find((g) => g.chave === 'a')!, b = r.grupos.find((g) => g.chave === 'b')!, c = r.grupos.find((g) => g.chave === 'c')!
    expect(a).toMatchObject({ n: 3, media: 4.8, alerta: 'acima', altas: 100, diferenca: 1 })
    expect(b).toMatchObject({ n: 3, media: 2.2, alerta: 'abaixo', baixas: 67, diferenca: -0.7 })
    expect(c.alerta).toBeNull() // só 1 avaliação: sem alerta
    expect(D.calibrar([l('a', 'X', 5)], 'area').grupos[0].nome).toBe('X')
    expect(D.calibrar([], 'area')).toEqual({ geral: null, grupos: [] })
  })
  it('compara autoavaliação e liderança por critério; diferenças de 2+ pontos viram tema de conversa', () => {
    const lider = { modelo: { criterios: [{ id: 'c1', nome: 'Qualidade', dimensao: 'Entregas', descricao: '', peso: 1 }, { id: 'c2', nome: 'Prazos', dimensao: 'Entregas', descricao: '', peso: 1 }, { id: 'c9', nome: 'Comunicação', dimensao: 'Relações', descricao: '', peso: 1 }] }, respostas: { notas: { c1: 2, c2: 4, c9: 3 } as Record<string, D.Nota> } }
    const auto = { modelo: { criterios: [{ id: 'c1', nome: 'Qualidade', dimensao: 'Entregas', descricao: '', peso: 1 }, { id: 'x', nome: 'comunicação ', dimensao: 'Relações', descricao: '', peso: 1 }] }, respostas: { notas: { c1: 5, x: 3 } as Record<string, D.Nota> } }
    const r = D.compararAvaliacoes(lider, auto)
    expect(r[0]).toMatchObject({ id: 'c1', auto: 5, lideranca: 2, diferenca: -3, conversar: true })
    expect(r.find((x) => x.id === 'c9')).toMatchObject({ auto: 3, diferenca: 0, conversar: false }) // casou pelo nome
    expect(r[r.length - 1]).toMatchObject({ id: 'c2', auto: null, diferenca: null })
    expect(D.compararAvaliacoes(lider, null).every((x) => x.auto === null)).toBe(true)
  })
})
