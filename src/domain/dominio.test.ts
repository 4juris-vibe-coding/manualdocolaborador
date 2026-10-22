import { describe, it, expect } from 'vitest'
import type { Colaborador, LancamentoPontos, Pesquisa, PeriodoIndisponibilidade, RegraPontuacao, RespostaPesquisa, Desafio, Badge } from '@/lib/types'
import { avaliarPontuacao, saldo, nivelDe, validarNiveis, progressoDesafio, conquistasNovas, CONFIG_GAMIFICACAO_PADRAO } from './gamificacao'
import { validarPeriodo, sobreposicoesNaArea, POLITICA_PADRAO } from './disponibilidade'
import { agregar, validarRespostas } from './pesquisas'
import { cpfValido, cnpjValido, emailValido, mascaraCNPJ, ocultar } from './validacao'
import { gerarCSV, lerCSV } from './csv'
import { diasEntre, somarDias, mesesEntre, isDataValida } from './datas'
import { aniversariosDoMes, marcosDoMes } from './aniversarios'
import { can, MATRIZ } from './permissions'

const regras: RegraPontuacao[] = [
  { id: 'r1', acao: 'participacao_evento', nome: 'Evento', descricao: '', pontos: 50, ativa: true },
  { id: 'r2', acao: 'reconhecimento_enviado', nome: 'Reconhecer', descricao: '', pontos: 10, ativa: true, limiteMensal: 2 },
  { id: 'r3', acao: 'pesquisa_respondida', nome: 'Pesquisa', descricao: '', pontos: 30, ativa: false },
]
let n = 0
const id = () => `x${++n}`

describe('gamificação', () => {
  it('pontua uma única vez por (pessoa, ação, referência)', () => {
    const ledger: LancamentoPontos[] = []
    const e = { pessoaId: 'p1', acao: 'participacao_evento' as const, referenciaId: 'ev1', descricao: 'x', agora: '2026-10-01T10:00:00Z' }
    const r1 = avaliarPontuacao(ledger, regras, e, id)
    expect(r1.ok).toBe(true)
    if (r1.ok) ledger.push(r1.lancamento)
    const r2 = avaliarPontuacao(ledger, regras, e, id)
    expect(r2).toEqual({ ok: false, motivo: 'duplicado' })
    expect(saldo(ledger, 'p1')).toBe(50)
  })

  it('respeita limite mensal e regra inativa', () => {
    const ledger: LancamentoPontos[] = []
    for (const ref of ['a', 'b', 'c']) {
      const r = avaliarPontuacao(ledger, regras, { pessoaId: 'p1', acao: 'reconhecimento_enviado', referenciaId: ref, descricao: '', agora: '2026-10-05T00:00:00Z' }, id)
      if (r.ok) ledger.push(r.lancamento)
      else expect(r.motivo).toBe('limite_mensal')
    }
    expect(ledger).toHaveLength(2)
    // mês seguinte volta a pontuar
    expect(avaliarPontuacao(ledger, regras, { pessoaId: 'p1', acao: 'reconhecimento_enviado', referenciaId: 'd', descricao: '', agora: '2026-11-01T00:00:00Z' }, id).ok).toBe(true)
    expect(avaliarPontuacao(ledger, regras, { pessoaId: 'p1', acao: 'pesquisa_respondida', referenciaId: 'q', descricao: '', agora: '2026-10-05T00:00:00Z' }, id)).toEqual({ ok: false, motivo: 'regra_inativa' })
  })

  it('nunca gera pontos negativos a partir de regra e saldo não fica negativo', () => {
    const r = avaliarPontuacao([], regras, { pessoaId: 'p', acao: 'participacao_evento', referenciaId: 'e', descricao: '', pontos: -500, agora: '2026-10-01T00:00:00Z' }, id)
    expect(r.ok && r.lancamento.pontos).toBe(0)
    expect(saldo([{ id: 'l', colaboradorId: 'p', acao: 'ajuste_manual', referenciaId: 'z', pontos: -10, descricao: '', criadoEm: '' }], 'p')).toBe(0)
  })

  it('calcula níveis e valida configuração', () => {
    const niveis = CONFIG_GAMIFICACAO_PADRAO.niveis
    expect(nivelDe(0, niveis).nivel).toBe(1)
    const n2 = nivelDe(350, niveis)
    expect(n2.nivel).toBe(2)
    expect(n2.faltam).toBe(450)
    expect(nivelDe(99999, niveis).proximoNome).toBeNull()
    expect(validarNiveis(niveis)).toBeNull()
    expect(validarNiveis([{ nivel: 1, nome: 'a', minimo: 10 }])).toMatch(/começar em 0/)
    expect(validarNiveis([{ nivel: 1, nome: 'a', minimo: 0 }, { nivel: 2, nome: 'b', minimo: 0 }])).toMatch(/crescer/)
  })

  it('progresso de desafio conta só ações dentro do período', () => {
    const d: Desafio = { id: 'd', titulo: '', descricao: '', inicio: '2026-10-01', fim: '2026-10-31', criterio: { acao: 'participacao_evento', meta: 2 }, pontosBonus: 100, participantes: ['p'], criadoPorId: 'rh' }
    const l = (ref: string, dia: string): LancamentoPontos => ({ id: ref, colaboradorId: 'p', acao: 'participacao_evento', referenciaId: ref, pontos: 50, descricao: '', criadoEm: `${dia}T10:00:00Z` })
    const p = progressoDesafio(d, [l('a', '2026-09-30'), l('b', '2026-10-02')], 'p', '2026-10-10')
    expect(p.atual).toBe(1)
    expect(p.status).toBe('ativo')
    expect(p.participando).toBe(true)
  })

  it('concede conquista quando o critério é atingido', () => {
    const badges: Badge[] = [{ id: 'b', nome: 'Presente', descricao: '', icon: '', cor: '', raridade: 'comum', criterio: { tipo: 'acao', acao: 'participacao_evento', quantidade: 2 }, ativa: true }]
    const l = (ref: string): LancamentoPontos => ({ id: ref, colaboradorId: 'p', acao: 'participacao_evento', referenciaId: ref, pontos: 50, descricao: '', criadoEm: '2026-10-01T00:00:00Z' })
    expect(conquistasNovas([l('a')], badges, [], 'p', CONFIG_GAMIFICACAO_PADRAO.niveis)).toHaveLength(0)
    expect(conquistasNovas([l('a'), l('b')], badges, [], 'p', CONFIG_GAMIFICACAO_PADRAO.niveis)).toHaveLength(1)
    expect(conquistasNovas([l('a'), l('b')], badges, [{ colaboradorId: 'p', badgeId: 'b', obtidaEm: '' }], 'p', CONFIG_GAMIFICACAO_PADRAO.niveis)).toHaveLength(0)
  })
})

describe('disponibilidade (descanso combinado)', () => {
  const per = (p: Partial<PeriodoIndisponibilidade>): PeriodoIndisponibilidade => ({ id: 'x', colaboradorId: 'a', inicio: '2026-11-10', fim: '2026-11-15', status: 'planejado', criadoEm: '', atualizadoEm: '', ...p })

  it('valida datas e sobreposição com períodos próprios', () => {
    expect(validarPeriodo({ inicio: '2026-11-10', fim: '2026-11-01' }, 'a', [], POLITICA_PADRAO, '2026-10-21').erros[0]).toMatch(/posterior/)
    expect(validarPeriodo({ inicio: '2026-11-12', fim: '2026-11-20' }, 'a', [per({})], POLITICA_PADRAO, '2026-10-21').erros[0]).toMatch(/sobrepõe/)
    // período cancelado não conta
    expect(validarPeriodo({ inicio: '2026-11-12', fim: '2026-11-20' }, 'a', [per({ status: 'cancelado' })], POLITICA_PADRAO, '2026-10-21').erros).toHaveLength(0)
  })

  it('antecedência é apenas sugestão (aviso, nunca erro) e não existe limite de dias', () => {
    const v = validarPeriodo({ inicio: '2026-10-23', fim: '2027-01-30' }, 'a', [], POLITICA_PADRAO, '2026-10-21')
    expect(v.erros).toHaveLength(0)
    expect(v.avisos.join(' ')).toMatch(/sugere/)
  })

  it('não permite indicar a si mesmo como contato de continuidade', () => {
    expect(validarPeriodo({ inicio: '2026-12-01', fim: '2026-12-02', contatoContinuidadeId: 'a' }, 'a', [], POLITICA_PADRAO, '2026-10-21').erros[0]).toMatch(/outra pessoa/)
  })

  it('detecta sobreposição com colegas da mesma área (informativo)', () => {
    const periodos = [per({ id: '1', colaboradorId: 'b' }), per({ id: '2', colaboradorId: 'c' })]
    const setor = (id: string) => ({ a: 's1', b: 's1', c: 's2' } as Record<string, string>)[id]
    expect(sobreposicoesNaArea('2026-11-14', '2026-11-20', 'a', 's1', periodos, setor).map((p) => p.colaboradorId)).toEqual(['b'])
  })
})

describe('pesquisas anônimas', () => {
  const p: Pesquisa = {
    id: 'q', titulo: '', descricao: '', inicio: '2026-10-01', fim: '2026-10-30', status: 'aberta', setoresAlvo: [], minimoRespostas: 3, criadaPor: 'rh', criadaEm: '',
    perguntas: [{ id: 'e', texto: 'Escala', tipo: 'escala' }, { id: 'n', texto: 'NPS', tipo: 'enps' }, { id: 't', texto: 'Texto', tipo: 'texto' }],
  }
  const r = (setorId: string, e: number, nps: number, t?: string): RespostaPesquisa => ({ id: Math.random().toString(), pesquisaId: 'q', setorId, respostas: { e, n: nps, ...(t ? { t } : {}) }, enviadaEm: '2026-10-05' })

  it('suprime resultados abaixo do mínimo de respostas', () => {
    const res = agregar(p, [r('s1', 5, 10), r('s1', 4, 9)])
    expect(res.suprimido).toBe(true)
    expect(res.porPergunta.e).toBeNull()
  })

  it('calcula média e eNPS; texto livre nunca aparece por área', () => {
    const rs = [r('s1', 5, 10, 'ótimo'), r('s1', 3, 6), r('s1', 4, 8), r('s2', 1, 0)]
    const geral = agregar(p, rs)
    expect(geral.porPergunta.e).toMatchObject({ tipo: 'escala', media: 3.3, n: 4 })
    expect(geral.porPergunta.n).toMatchObject({ tipo: 'enps', enps: -25, promotores: 1, detratores: 2 })
    expect(geral.porPergunta.t).toMatchObject({ tipo: 'texto', textos: ['ótimo'] })
    const area = agregar(p, rs, 's1')
    expect(area.suprimido).toBe(false)
    expect(area.porPergunta.t).toBeNull()
    expect(agregar(p, rs, 's2').suprimido).toBe(true)
  })

  it('valida respostas obrigatórias (texto é opcional)', () => {
    expect(validarRespostas(p, { e: 4 })).toMatch(/NPS/)
    expect(validarRespostas(p, { e: 4, n: 11 })).toMatch(/inválida/)
    expect(validarRespostas(p, { e: 4, n: 7 })).toBeNull()
  })
})

describe('validações, datas e CSV', () => {
  it('valida CPF, CNPJ e e-mail', () => {
    expect(cpfValido('529.982.247-25')).toBe(true)
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cnpjValido('11.222.333/0001-81')).toBe(true)
    expect(cnpjValido('11.222.333/0001-82')).toBe(false)
    expect(emailValido('a@b.com')).toBe(true)
    expect(emailValido('a@b')).toBe(false)
    expect(mascaraCNPJ('11222333000181')).toBe('11.222.333/0001-81')
    expect(ocultar('12345-6', 3)).toBe('••••5-6')
  })

  it('opera datas sem fuso', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02')
    expect(diasEntre('2026-10-01', '2026-10-21')).toBe(20)
    expect(mesesEntre('2025-10-21', '2026-10-20')).toBe(11)
    expect(isDataValida('2026-02-30')).toBe(false)
  })

  it('gera e lê CSV com aspas, ";" e acentos', () => {
    const csv = gerarCSV([{ a: 'João; "Jo"', b: 1 }], [{ titulo: 'Nome', valor: (r) => r.a }, { titulo: 'N', valor: (r) => r.b }], ['meta'])
    const linhas = lerCSV(csv)
    expect(linhas[0]).toEqual(['Nome', 'N'])
    expect(linhas[1]).toEqual(['João; "Jo"', '1'])
  })
})

describe('aniversários e privacidade', () => {
  const pessoa = (id: string, nasc: string, mostrar: boolean, entrada = '2020-10-05'): Colaborador => ({
    id, nome: id, email: '', telefone: '', avatarCor: '', papel: 'colaborador', setorId: 's', cargoId: '', status: 'ativo', dataEntrada: entrada,
    nascimento: nasc, cidade: '', uf: '', regime: 'PJ', razaoSocial: '', cnpj: '', privacidade: { mostrarAniversario: mostrar, mostrarMarcos: true, aparecerEmDestaques: false },
  })
  it('mostra o aniversário de todos (com ou sem a antiga opção) e calcula marcos de parceria', () => {
    const lista = [pessoa('a', '1990-10-03', true), pessoa('b', '1991-10-09', false)]
    expect(aniversariosDoMes(lista, 9).map((c) => c.pessoa.id)).toEqual(['a', 'b'])
    expect(marcosDoMes(lista, 9, 2026)[0].anos).toBe(6)
  })
})

describe('permissões', () => {
  it('colaborador não acessa áreas administrativas; liderança não vê contratos', () => {
    expect(can('colaborador', 'rh:painel')).toBe(false)
    expect(can('colaborador', 'portal:usar')).toBe(true)
    expect(can('gestor', 'pessoas:ver_contratos')).toBe(false)
    expect(can('gestor', 'documentos:gerenciar')).toBe(false)
    expect(can('rh', 'pessoas:gerenciar')).toBe(true)
    expect(can('diretoria', 'pessoas:gerenciar')).toBe(false)
    expect(MATRIZ.admin).toContain('admin:auditoria')
  })
})
