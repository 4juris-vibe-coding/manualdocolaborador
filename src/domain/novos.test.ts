import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/lib/store'
import { chaveAutor, chaveApoio } from './anonimato'
import { MODELOS, criarApresentacao, revisar, itensDe, slideDoModelo } from './apresentacoes'

const st = () => useStore.getState()
beforeEach(() => { st().reset(); st().entrar('c2') })

describe('anonimato', () => {
  it('chaves são estáveis, opacas e distintas por finalidade', () => {
    expect(chaveAutor('c2')).toBe(chaveAutor('c2'))
    expect(chaveAutor('c2')).not.toBe(chaveAutor('c3'))
    expect(chaveAutor('c2')).not.toContain('c2')
    expect(chaveApoio('c2', 'sg1')).not.toBe(chaveApoio('c2', 'sg2'))
    expect(chaveApoio('c2', 'sg1')).not.toBe(chaveAutor('c2'))
  })
})

describe('caixa de sugestões', () => {
  it('guarda só uma chave opaca: nenhum campo da sugestão, auditoria ou notificação revela a pessoa', () => {
    const auditoriaAntes = st().auditoria.length, notifAntes = st().notificacoes.length
    const r = st().enviarSugestao({ titulo: 'Ideia de teste anônima', descricao: 'Descrição longa o bastante para valer.', categoria: 'Cultura' })
    expect(r.ok).toBe(true)
    const x = st().sugestoes.find((y) => y.id === (r.ok ? r.id : ''))!
    // Id e chave são hexadecimais aleatórios (podem conter "c2" por acaso); o que importa é nenhum campo ser o id da pessoa.
    expect(Object.values(x).flat()).not.toContain('c2')
    expect(x.autorChave).toMatch(/^[0-9a-f]{16}$/)
    expect(x.criadaEm).toMatch(/^\d{4}-\d{2}-\d{2}$/) // só data, sem hora
    expect(st().auditoria.length).toBe(auditoriaAntes)
    expect(st().notificacoes.length).toBe(notifAntes)
    expect(st().sugestaoEhMinha(x.id)).toBe(true)
  })

  it('só a autora edita/exclui, e só enquanto aguarda análise', () => {
    const id = (st().enviarSugestao({ titulo: 'Minha ideia editável', descricao: 'Descrição longa o bastante para valer.', categoria: 'Outros' }) as { id: string }).id
    st().entrar('c3')
    expect(st().editarSugestao(id, { titulo: 'Tentativa alheia', descricao: 'Descrição longa o bastante para valer.', categoria: 'Outros' }).ok).toBe(false)
    expect(st().excluirSugestao(id).ok).toBe(false)
    st().entrar('c2')
    expect(st().editarSugestao(id, { titulo: 'Título atualizado ok', descricao: 'Descrição longa o bastante para valer.', categoria: 'Processos' }).ok).toBe(true)
    st().entrar('c9'); expect(st().moderarSugestao(id, 'aprovada').ok).toBe(true)
    st().entrar('c2')
    expect(st().editarSugestao(id, { titulo: 'Depois de aprovada', descricao: 'Descrição longa o bastante para valer.', categoria: 'Outros' }).ok).toBe(false)
    expect(st().excluirSugestao(id).ok).toBe(false)
    expect(st().excluirSugestao('sg1').ok).toBe(true) // sg1 é do c2 e está aguardando
  })

  it('apoio: um por pessoa (alterna), nunca na própria sugestão', () => {
    expect(st().apoiarSugestao('sg1').ok).toBe(false) // própria
    st().entrar('c6')
    const antes = st().sugestoes.find((x) => x.id === 'sg1')!.apoios.length
    st().apoiarSugestao('sg1'); expect(st().sugestoes.find((x) => x.id === 'sg1')!.apoios.length).toBe(antes + 1)
    st().apoiarSugestao('sg1'); expect(st().sugestoes.find((x) => x.id === 'sg1')!.apoios.length).toBe(antes)
  })

  it('moderação: só RH/Admin; recusa exige motivo público; voltar a aguardando limpa a resposta', () => {
    expect(st().moderarSugestao('sg1', 'aprovada').ok).toBe(false) // colaborador
    st().entrar('c4'); expect(st().moderarSugestao('sg1', 'aprovada').ok).toBe(false) // liderança
    st().entrar('c9')
    expect(st().moderarSugestao('sg1', 'recusada', 'curto').ok).toBe(false)
    expect(st().moderarSugestao('sg1', 'recusada', 'Não cabe no escopo deste trimestre.').ok).toBe(true)
    expect(st().sugestoes.find((x) => x.id === 'sg1')!.resposta).toMatch(/escopo/)
    expect(st().moderarSugestao('sg1', 'aguardando').ok).toBe(true)
    expect(st().sugestoes.find((x) => x.id === 'sg1')!.resposta).toBeUndefined()
  })

  it('valida tamanhos e limita 10 por mês', () => {
    expect(st().enviarSugestao({ titulo: 'abc', descricao: 'Descrição longa o bastante para valer.', categoria: 'Outros' }).ok).toBe(false)
    expect(st().enviarSugestao({ titulo: 'Título válido', descricao: 'curta', categoria: 'Outros' }).ok).toBe(false)
    for (let i = 0; i < 9; i++) st().enviarSugestao({ titulo: `Ideia número ${i}`, descricao: 'Descrição longa o bastante para valer.', categoria: 'Outros' })
    expect(st().enviarSugestao({ titulo: 'Ideia excedente', descricao: 'Descrição longa o bastante para valer.', categoria: 'Outros' }).ok).toBe(false)
  })
})

describe('apresentações', () => {
  it('todo modelo gera slides válidos com os campos padrão preenchidos', () => {
    for (const m of MODELOS) {
      const a = criarApresentacao(m, 'Teste', 'c1', '2026-10-21', (() => { let n = 0; return () => `i${++n}` })())
      expect(a.slides).toHaveLength(m.roteiro.length)
      for (const s of a.slides) for (const c of slideDoModelo(m, s.modeloSlideId).campos) expect(s.valores[c.chave]).toBeDefined()
      expect(a.slides[0].valores.titulo).toBe('Teste')
    }
  })
  it('revisão aponta campo vazio, texto longo e listas grandes; listas ignoram linhas vazias', () => {
    const m = MODELOS[0]
    const a = criarApresentacao(m, 'T', 'c1', '2026-10-21', (() => { let n = 0; return () => `i${++n}` })())
    a.slides[1].valores.titulo = ''
    a.slides[1].valores.itens = 'a\n\nb\nc\nd\ne\nf\ng'
    const msgs = revisar(m, a).map((p) => p.mensagem)
    expect(msgs).toContain('campo vazio')
    expect(msgs.some((x) => x.includes('mais de 6 itens'))).toBe(true)
    expect(itensDe('a\n\n b \n')).toEqual(['a', 'b'])
  })
  it('só o autor edita; compartilhada pode ser duplicada por outros; limite de slides', () => {
    const r = st().criarApresentacao('institucional', 'Minha apresentação')
    const id = r.ok ? r.id! : ''
    expect(st().salvarApresentacao(id, { titulo: 'Novo título' }).ok).toBe(true)
    expect(st().salvarApresentacao(id, { slides: [] }).ok).toBe(false)
    st().entrar('c3')
    expect(st().salvarApresentacao(id, { titulo: 'Invasão' }).ok).toBe(false)
    expect(st().duplicarApresentacao(id).ok).toBe(false) // privada
    st().entrar('c2'); st().salvarApresentacao(id, { compartilhada: true })
    st().entrar('c3'); expect(st().duplicarApresentacao(id).ok).toBe(true)
    expect(st().criarApresentacao('institucional', 'ab').ok).toBe(false)
  })
})
