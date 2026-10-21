import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { saldo } from '@/domain/gamificacao'
import { hojeISO, somarDias } from '@/domain/datas'

const st = () => useStore.getState()
const como = (id: string) => st().entrar(id)
// Personas do seed: c2 colaborador (Marketing), c4 liderança (Tecnologia), c9 RH, c11 diretoria, c1 admin (lidera Marketing)

beforeEach(() => { st().reset(); st().entrar('c2') })

describe('dados de demonstração', () => {
  it('pontos do seed vêm do histórico, sem números soltos', () => {
    const s = st()
    for (const c of s.colaboradores) expect(s.pontosDe(c.id)).toBe(saldo(s.lancamentos, c.id))
    expect(s.lancamentos.every((l) => l.pontos >= 0)).toBe(true)
    // nenhum campo trabalhista no modelo
    const c = s.colaboradores[0] as unknown as Record<string, unknown>
    for (const campo of ['senha', 'pontos', 'streak', 'ferias', 'remuneracao']) expect(c[campo]).toBeUndefined()
  })
})

describe('permissões na camada de dados', () => {
  it('colaborador não cadastra pessoas nem configura gamificação', () => {
    const r = st().salvarPessoa({ nome: 'Fulano Teste', email: 'f@t.com', papel: 'admin', setorId: 's1', status: 'ativo', dataEntrada: hojeISO(), regime: 'PJ', cnpj: '11.222.333/0001-81', razaoSocial: 'X' })
    expect(r.ok).toBe(false)
    expect(st().salvarRegra('rg2', { pontos: 999 }).ok).toBe(false)
  })

  it('RH cadastra, mas não promove papel (só Administração)', () => {
    como('c9')
    const r = st().salvarPessoa({ nome: 'Fulana Teste', email: 'fulana@t.com', papel: 'admin', setorId: 's1', status: 'integracao', dataEntrada: hojeISO(), regime: 'PJ', cnpj: '11.222.333/0001-81', razaoSocial: 'Fulana ME' })
    expect(r.ok).toBe(true)
    expect(st().pessoa(r.ok ? r.id : '')?.papel).toBe('colaborador')
    expect(st().salvarPessoa({ nome: 'Outra', email: 'fulana@t.com', papel: 'colaborador', setorId: 's1', status: 'ativo', dataEntrada: hojeISO(), regime: 'PJ', cnpj: '11.222.333/0001-81', razaoSocial: 'Y' }).ok).toBe(false) // e-mail duplicado
    expect(st().salvarPessoa({ nome: 'Outra Pessoa', email: 'o@t.com', papel: 'colaborador', setorId: 's1', status: 'ativo', dataEntrada: hojeISO(), regime: 'PJ', cnpj: '11.222.333/0001-82', razaoSocial: 'Y' }).ok).toBe(false) // CNPJ inválido
  })

  it('ninguém aprova o próprio reembolso; liderança só aprova da própria área', () => {
    como('c1') // admin
    const proprio = st().reembolsos.find((r) => r.colaboradorId === 'c1' && r.status === 'pendente')!
    expect(st().setReembolsoStatus(proprio.id, 'aprovado', 'c1').ok).toBe(false)
    como('c4') // liderança de Tecnologia
    const deMarketing = st().reembolsos.find((r) => r.colaboradorId === 'c3' && r.status === 'pendente')!
    expect(st().setReembolsoStatus(deMarketing.id, 'aprovado', 'c4').ok).toBe(false)
  })

  it('a visão "como colaborador" retira privilégios', () => {
    como('c9')
    st().setPreview(true)
    expect(st().pode('pessoas:gerenciar')).toBe(false)
    st().setPreview(false)
    expect(st().pode('pessoas:gerenciar')).toBe(true)
  })
})

describe('disponibilidade não funciona como férias', () => {
  it('registro vira "planejado" sem aprovação e avisa a liderança; não há saldo', () => {
    const ini = somarDias(hojeISO(), 60), fim = somarDias(hojeISO(), 120) // 61 dias: não existe limite
    const antes = st().notificacoes.length
    const r = st().registrarPeriodo({ inicio: ini, fim })
    expect(r.ok).toBe(true)
    const p = st().periodos.find((x) => x.id === (r.ok ? r.id : ''))!
    expect(p.status).toBe('planejado')
    expect(st().notificacoes.length).toBeGreaterThan(antes)
    expect(st().notificacoes[0].colaboradorId).toBe('c1') // liderança de Marketing
  })

  it('só a liderança da área (ou RH) registra alinhamento; editar datas desfaz o alinhamento', () => {
    const r = st().registrarPeriodo({ inicio: somarDias(hojeISO(), 40), fim: somarDias(hojeISO(), 42) })
    const id = r.ok ? r.id! : ''
    expect(st().alinharPeriodo(id).ok).toBe(false) // a própria pessoa
    como('c4'); expect(st().alinharPeriodo(id).ok).toBe(false) // liderança de outra área
    como('c1'); expect(st().alinharPeriodo(id).ok).toBe(true)
    como('c2')
    st().registrarPeriodo({ inicio: somarDias(hojeISO(), 41), fim: somarDias(hojeISO(), 43) }, id)
    expect(st().periodos.find((x) => x.id === id)!.status).toBe('planejado')
  })
})

describe('gamificação aplicada', () => {
  it('reconhecimento pontua as duas pessoas uma vez e bloqueia autorreconhecimento', () => {
    const antes = st().pontosDe('c5')
    expect(st().reconhecer('c2', 'Cuidado', 'Mensagem longa o bastante', true).ok).toBe(false)
    expect(st().reconhecer('c5', 'Cuidado', 'curta', true).ok).toBe(false)
    expect(st().reconhecer('c5', 'Cuidado', 'Obrigado pela ajuda na campanha!', true).ok).toBe(true)
    expect(st().pontosDe('c5')).toBe(antes + 40)
  })

  it('presença registrada pela organização pontua uma única vez por evento', () => {
    como('c9')
    const ev = st().eventos.find((e) => e.id === 'e4')! // evento passado organizado pelo RH
    const antes = st().pontosDe('c13')
    expect(st().registrarPresencas(ev.id, [...ev.presencas, 'c13']).ok).toBe(true)
    st().registrarPresencas(ev.id, [...ev.presencas, 'c13'])
    expect(st().pontosDe('c13')).toBe(antes + 50)
  })

  it('confirmar presença em evento não gera pontos (evita exploração)', () => {
    const antes = st().pontosDe('c2')
    expect(st().responderEvento('e2', 'vou').ok).toBe(true)
    expect(st().pontosDe('c2')).toBe(antes)
  })

  it('estorno exige justificativa e não pode ser repetido', () => {
    como('c9')
    const l = st().lancamentos.find((x) => x.pontos > 0)!
    expect(st().estornarLancamento(l.id, 'curto').ok).toBe(false)
    expect(st().estornarLancamento(l.id, 'Presença registrada por engano').ok).toBe(true)
    expect(st().estornarLancamento(l.id, 'Presença registrada por engano').ok).toBe(false)
  })
})

describe('pesquisas anônimas', () => {
  it('a resposta não guarda identidade e não pode ser repetida', () => {
    como('c3')
    const r = st().responderPesquisa('q1', { q1p1: 4, q1p2: 4, q1p3: 8, q1p4: 'Aprendizado' })
    expect(r.ok).toBe(true)
    const resp = st().respostas[st().respostas.length - 1] as unknown as Record<string, unknown>
    expect(resp.colaboradorId).toBeUndefined()
    expect(JSON.stringify(resp)).not.toContain('c3')
    expect(st().responderPesquisa('q1', { q1p1: 4, q1p2: 4, q1p3: 8, q1p4: 'Aprendizado' }).ok).toBe(false)
  })
})

describe('encerramento e LGPD', () => {
  it('encerrar parceria encerra contrato e cancela períodos futuros; anonimização só após encerrar', () => {
    como('c1')
    expect(st().anonimizarPessoa('c10').ok).toBe(false)
    expect(st().encerrarParceria('c10', hojeISO(), 'me2', undefined, true).ok).toBe(true)
    expect(st().contratos.find((k) => k.colaboradorId === 'c10')!.status).toBe('encerrado')
    expect(st().periodos.filter((p) => p.colaboradorId === 'c10' && p.inicio > hojeISO()).every((p) => p.status === 'cancelado')).toBe(true)
    expect(st().processos.some((p) => p.colaboradorId === 'c10' && p.tipo === 'encerramento')).toBe(true)
    expect(st().anonimizarPessoa('c10').ok).toBe(true)
    const c = st().pessoa('c10')!
    expect(c.nome).toMatch(/anonimizada/)
    expect(c.pixChave).toBeUndefined()
    expect(st().documentos.some((d) => d.colaboradorId === 'c10')).toBe(false)
    expect(st().auditoria.some((a) => a.acao === 'lgpd.anonimizar')).toBe(true)
  })

  it('integração concluída ativa a pessoa e concede pontos', () => {
    como('c9')
    const p = st().processos.find((x) => x.colaboradorId === 'c7' && !x.concluidoEm)!
    for (const i of p.itens.filter((x) => !x.feito)) st().marcarItemJornada(p.id, i.id, true)
    expect(st().pessoa('c7')!.status).toBe('ativo')
    expect(st().lancamentos.some((l) => l.colaboradorId === 'c7' && l.acao === 'integracao_concluida')).toBe(true)
  })
})
