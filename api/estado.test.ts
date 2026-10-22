/* /api/estado: leitura filtrada por papel e gravação por registro com regras, conflito e tudo-ou-nada. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMundo, cookieDe, dbPglite, semear, ORG_BASE, type Mundo } from './_v2/teste/harness'
import { diferenca, hashRegistro, type OpsColecao } from '../src/domain/sincronia'
import { chaveApoio, chaveAutor } from '../src/domain/anonimato'
import { segredoAnonimo, migrarChavesSugestoes } from './_v2/estadoLegado'

let m: Mundo
vi.mock('./_lib.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./_lib.js')>()
  const pool = () => {
    const d = dbPglite(m.pg)
    return { query: d.query, connect: async () => ({ query: d.query, release() {} }) }
  }
  return { ...real, db: pool, enviarEmail: async () => undefined }
})
const { default: handler } = await import('./[acao]')

type Obj = Record<string, any>
async function chamar(acao: string, metodo: string, corpo?: unknown, cookie?: string, csrf = true) {
  const cab: Record<string, string> = { 'x-forwarded-for': '10.2.0.1' }
  if (csrf) cab['x-requested-with'] = '4juris'
  if (cookie) cab.cookie = cookie
  const req = { method: metodo, url: `/api/${acao}`, headers: cab, socket: {}, query: { acao }, body: corpo ?? {} }
  const res = { statusCode: 0, cabecalhos: {} as Record<string, string>, corpo: '', setHeader(k: string, v: string) { this.cabecalhos[k] = v }, end(c: string) { this.corpo = c } }
  await handler(req as never, res as never)
  return { status: res.statusCode, json: JSON.parse(res.corpo || '{}') }
}

const ler = async (cookie: string) => {
  const r = await chamar('estado', 'GET', undefined, cookie)
  expect(r.status).toBe(200)
  return r.json as { estado: Obj; segredoAnonimo: string; colaboradorId: string }
}

/** Faz o que o navegador faz: lê, altera em memória e envia só as diferenças. */
async function editar(cookie: string, mudar: (e: Obj) => void) {
  const { estado } = await ler(cookie)
  const antes = JSON.parse(JSON.stringify(estado))
  mudar(estado)
  const ops: Record<string, OpsColecao> = {}
  for (const k of Object.keys(estado)) {
    if (k === 'config') continue
    const d = diferenca(k, antes[k], estado[k])
    if (d) ops[k] = d
  }
  const config = JSON.stringify(antes.config) !== JSON.stringify(estado.config) ? { base: hashRegistro(antes.config), dados: estado.config } : undefined
  return chamar('estado', 'PUT', { ops, ...(config ? { config } : {}) }, cookie)
}
const linhas = async (colecao: string) => (await m.pg.query<{ dados: Obj }>(`select dados from app_${colecao.toLowerCase()} order by ord`)).rows.map((r) => r.dados)

const SENSIVEL = { cpf: '52998224725', banco: '341', agencia: '0001', conta: '12345-6', pixTipo: 'CPF', pixChave: '52998224725', emergenciaNome: 'Mãe', emergenciaTelefone: '11999', endereco: { cidade: 'SP' }, diversidade: { consentimento: true, genero: 'feminino' }, nascimento: '1990-05-17', razaoSocial: 'Caio ME', cnpj: '11222333000181' }

let c: Record<string, string>
beforeEach(async () => {
  m = await criarMundo()
  await semear(m, {
    ...ORG_BASE,
    pessoas: ORG_BASE.pessoas.map((p) => ({ ...p, ...SENSIVEL, privacidade: { mostrarAniversario: p.id === 'col2', mostrarMarcos: true, aparecerEmDestaques: true }, status: p.id === 'col1' ? 'integracao' : 'ativo' })),
    extras: {
      contratos: [{ id: 'k1', colaboradorId: 'col1', numero: 'C-1', objeto: 'Serviços', modalidade: 'mensal', valorMensal: 5000, inicio: '2026-01-01', renovacaoAutomatica: false, status: 'vigente', atualizadoEm: '2026-01-01' }],
      documentos: [{ id: 'd1', colaboradorId: 'col1', nome: 'RG', tipo: 'Documento pessoal', data: '2026-01-01', tamanho: '1 MB', confidencial: true }],
      reembolsos: [
        { id: 'r1', colaboradorId: 'col1', categoria: 'Deslocamento', descricao: 'Uber', valor: 50, data: '2026-10-01', status: 'pendente', criadoEm: '2026-10-01' },
        { id: 'r2', colaboradorId: 'ger1', categoria: 'Deslocamento', descricao: 'Táxi', valor: 80, data: '2026-10-01', status: 'pendente', criadoEm: '2026-10-01' },
      ],
      notas: [{ id: 'n1', colaboradorId: 'col1', competencia: '2026-10', valor: 5000, status: 'aguardando', prazo: '2026-10-22' }],
      registros: [{ id: 'ra1', colaboradorId: 'col1', tipoId: 't1', data: '2026-01-01', descricao: 'Observação interna', autorId: 'rh1', criadoEm: '2026-01-01' }],
      auditoria: [{ id: 'au1', em: '2026-01-01T00:00:00Z', atorId: 'rh1', acao: 'x', entidade: 'pessoa', entidadeId: 'col1', resumo: 'algo' }],
      notificacoes: [
        { id: 'no1', colaboradorId: 'col1', tipo: 'prazo', titulo: 'Para Caio', texto: '', data: '2026-10-01', lida: false },
        { id: 'no2', colaboradorId: 'col2', tipo: 'prazo', titulo: 'Para Duda', texto: '', data: '2026-10-01', lida: false },
      ],
      regras: [{ id: 'rg1', acao: 'perfil_completo', nome: 'Perfil', descricao: '', pontos: 20, ativa: true }],
      processos: [{ id: 'pr1', colaboradorId: 'col1', modeloId: 'm1', tipo: 'integracao', iniciadoEm: '2026-10-01', itens: [{ id: 'i1', titulo: 'Conversa', responsavel: 'lideranca', feito: false }] }],
      periodos: [{ id: 'p1', colaboradorId: 'col1', inicio: '2026-12-01', fim: '2026-12-10', observacaoPrivada: 'consulta médica', status: 'planejado', criadoEm: '2026-10-01', atualizadoEm: '2026-10-01' }],
    },
  })
  c = {}
  for (const p of ORG_BASE.pessoas) c[p.id] = await cookieDe(m, p.id)
}, 60_000)

describe('leitura filtrada', () => {
  it('colaborador não recebe contratos, documentos, finanças, registros nem auditoria de terceiros', async () => {
    const { estado, segredoAnonimo: seg } = await ler(c.col2)
    expect(seg).toBeTruthy()
    for (const k of ['contratos', 'documentos', 'notas', 'registros', 'auditoria']) expect(estado[k]).toEqual([])
    expect(estado.reembolsos).toEqual([])
    expect(estado.notificacoes.map((n: Obj) => n.id)).toEqual(['no2'])
    const caio = estado.colaboradores.find((p: Obj) => p.id === 'col1')
    for (const k of ['cpf', 'banco', 'agencia', 'conta', 'pixChave', 'emergenciaNome', 'endereco', 'diversidade', 'cnpj', 'razaoSocial', 'nascimento']) expect(caio).not.toHaveProperty(k)
    expect(caio.nome).toBe('Caio Colaborador')
    // Períodos de outra área não aparecem; para a liderança da área, aparecem sem a observação privada.
    expect(estado.periodos).toEqual([])
    const lider = (await ler(c.ger1)).estado
    expect(lider.periodos[0].inicio).toBe('2026-12-01')
    expect(lider.periodos[0]).not.toHaveProperty('observacaoPrivada')
    // O próprio cadastro vem completo.
    expect(estado.colaboradores.find((p: Obj) => p.id === 'col2').cpf).toBe(SENSIVEL.cpf)
  })

  it('aniversário de quem optou aparece sem o ano', async () => {
    const { estado } = await ler(c.col1)
    expect(estado.colaboradores.find((p: Obj) => p.id === 'col2').nascimento).toBe('2000-05-17')
  })

  it('o dono vê os próprios dados; liderança vê reembolsos da área; RH vê tudo; diretoria sem dados pessoais', async () => {
    const dono = (await ler(c.col1)).estado
    expect(dono.contratos).toHaveLength(1)
    expect(dono.documentos).toHaveLength(1)
    expect(dono.periodos[0].observacaoPrivada).toBe('consulta médica')
    const gestor = (await ler(c.ger1)).estado
    expect(gestor.reembolsos.map((r: Obj) => r.id).sort()).toEqual(['r1', 'r2'])
    expect(gestor.contratos).toEqual([])
    const rh = (await ler(c.rh1)).estado
    expect(rh.registros).toHaveLength(1)
    expect(rh.auditoria).toHaveLength(1)
    expect(rh.colaboradores.find((p: Obj) => p.id === 'col1').pixChave).toBe(SENSIVEL.pixChave)
    expect(rh.notificacoes).toEqual([])
    const dir = (await ler(c.dir1)).estado
    expect(dir.contratos).toHaveLength(1)
    expect(dir.registros).toEqual([])
    expect(dir.colaboradores.find((p: Obj) => p.id === 'col1')).not.toHaveProperty('pixChave')
  })
})

describe('gravação por registro', () => {
  it('formato antigo (coleções inteiras) e mutação sem cabeçalho são recusados', async () => {
    const r = await chamar('estado', 'PUT', { mudancas: { reembolsos: [] } }, c.col1)
    expect(r.status).toBe(409)
    expect(r.json.recarregar).toBe(true)
    expect((await chamar('estado', 'PUT', { ops: {} }, c.col1, false)).status).toBe(403)
    expect(await linhas('reembolsos')).toHaveLength(2)
  })

  it('colaborador edita dados pessoais, mas não papel, área nem status', async () => {
    expect((await editar(c.col2, (e) => { e.colaboradores.find((p: Obj) => p.id === 'col2').telefone = '1188887777' })).status).toBe(200)
    expect((await linhas('colaboradores')).find((p) => p.id === 'col2').telefone).toBe('1188887777')
    expect((await editar(c.col2, (e) => { e.colaboradores.find((p: Obj) => p.id === 'col2').papel = 'admin' })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.colaboradores.find((p: Obj) => p.id === 'col2').setorId = 's1' })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.colaboradores.find((p: Obj) => p.id === 'col1').nome = 'Hackeado' })).status).toBe(403)
    expect((await linhas('colaboradores')).find((p) => p.id === 'col2').papel).toBe('colaborador')
  })

  it('estrutura, configuração e papéis: só RH/administração; papel elevado só a administração', async () => {
    expect((await editar(c.col2, (e) => { e.setores[0].liderancaIds = ['col2'] })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.config = { ...e.config, geral: { x: 1 } } })).status).toBe(403)
    const novo = (papel: string) => ({ id: `n-${papel}`, nome: 'Nova Pessoa', email: `n-${papel}@x.com`, papel, setorId: 's1', cargoId: 'g1', status: 'ativo', privacidade: {} })
    expect((await editar(c.rh1, (e) => { e.colaboradores.push(novo('colaborador')) })).status).toBe(200)
    expect((await editar(c.rh1, (e) => { e.colaboradores.push(novo('admin')) })).status).toBe(403)
    expect((await editar(c.rh1, (e) => { e.colaboradores.find((p: Obj) => p.id === 'col2').papel = 'rh' })).status).toBe(403)
    expect((await editar(c.admin1, (e) => { e.colaboradores.find((p: Obj) => p.id === 'col2').papel = 'gestor' })).status).toBe(200)
  })

  it('reembolso: pedir em nome próprio; liderança aprova na área mas não paga; ninguém decide o próprio', async () => {
    const novo = { id: 'r9', colaboradorId: 'col2', categoria: 'Outros', descricao: 'Livro', valor: 30, data: '2026-10-02', status: 'pendente', criadoEm: '2026-10-02' }
    expect((await editar(c.col2, (e) => { e.reembolsos.unshift(novo) })).status).toBe(200)
    expect((await editar(c.col2, (e) => { e.reembolsos.unshift({ ...novo, id: 'r10', colaboradorId: 'col1' }) })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.reembolsos.unshift({ ...novo, id: 'r11', status: 'aprovado' }) })).status).toBe(403)
    // Liderança da área s1 (ger1) decide o r1 (col1), mas não marca como pago.
    expect((await editar(c.ger1, (e) => { Object.assign(e.reembolsos.find((r: Obj) => r.id === 'r1'), { status: 'pago' }) })).status).toBe(403)
    expect((await editar(c.ger1, (e) => { Object.assign(e.reembolsos.find((r: Obj) => r.id === 'r1'), { status: 'aprovado', aprovadorId: 'ger1', aprovadoEm: '2026-10-03' }) })).status).toBe(200)
    expect((await editar(c.ger1, (e) => { Object.assign(e.reembolsos.find((r: Obj) => r.id === 'r2'), { status: 'aprovado', aprovadorId: 'ger1' }) })).status).toBe(403)
    expect((await linhas('reembolsos')).find((r) => r.id === 'r1').status).toBe('aprovado')
    // A primeira posição do banco é o pedido novo (a interface mostra o mais recente no topo).
    expect((await linhas('reembolsos'))[0].id).toBe('r9')
  })

  it('contratos, documentos e notas legados são espelho do módulo financeiro: ninguém grava pela sincronização', async () => {
    expect((await editar(c.col1, (e) => { Object.assign(e.notas[0], { status: 'enviada', enviadaEm: '2026-10-05' }) })).status).toBe(403)
    expect((await editar(c.rh1, (e) => { Object.assign(e.notas[0], { status: 'paga' }) })).status).toBe(403)
    expect((await editar(c.rh1, (e) => { e.contratos[0].valorMensal = 1 })).status).toBe(403)
    expect((await editar(c.col1, (e) => { e.documentos.push({ id: 'dx', colaboradorId: 'col1', nome: 'x', tipo: 'Outro', data: '2026-01-01', tamanho: '1', confidencial: true, enviadoPorId: 'col1' }) })).status).toBe(403)
  })

  it('não exclui cadastro com histórico contratual (usa anonimização)', async () => {
    const r = await editar(c.admin1, (e) => { e.colaboradores = e.colaboradores.filter((p: Obj) => p.id !== 'col1') })
    expect(r.status).toBe(403)
    expect(r.json.erro).toMatch(/anonimização/)
    expect((await editar(c.rh1, (e) => { e.colaboradores = e.colaboradores.filter((p: Obj) => p.id !== 'dir1') })).status).toBe(403)
    expect((await editar(c.admin1, (e) => { e.colaboradores = e.colaboradores.filter((p: Obj) => p.id !== 'dir1') })).status).toBe(200)
  })

  it('campos não vistos são preservados quando a liderança conclui a integração', async () => {
    const r = await editar(c.ger1, (e) => {
      const p = e.processos.find((x: Obj) => x.id === 'pr1')
      p.itens[0] = { ...p.itens[0], feito: true, feitoEm: '2026-10-05', feitoPorId: 'ger1' }
      p.concluidoEm = '2026-10-05'
      e.colaboradores.find((x: Obj) => x.id === 'col1').status = 'ativo'
    })
    expect(r.status).toBe(200)
    const caio = (await linhas('colaboradores')).find((p) => p.id === 'col1')
    expect(caio.status).toBe('ativo')
    expect(caio.cpf).toBe(SENSIVEL.cpf)
    expect(caio.pixChave).toBe(SENSIVEL.pixChave)
    // Colega de outra área não marca itens da liderança.
    expect((await editar(c.ger2, (e) => { e.processos.push({ id: 'x' }) })).status).toBe(403)
  })

  it('observação privada do período sobrevive ao alinhamento feito pela liderança', async () => {
    const r = await editar(c.ger1, (e) => { Object.assign(e.periodos[0], { status: 'alinhado', alinhadoPorId: 'ger1', alinhadoEm: '2026-10-05' }) })
    expect(r.status).toBe(200)
    const p = (await linhas('periodos'))[0]
    expect(p.status).toBe('alinhado')
    expect(p.observacaoPrivada).toBe('consulta médica')
  })

  it('edição concorrente vira conflito (409) em vez de sobrescrever', async () => {
    const { estado } = await ler(c.rh1)
    const velho = estado.reembolsos.find((r: Obj) => r.id === 'r1')
    expect((await editar(c.rh1, (e) => { e.reembolsos.find((r: Obj) => r.id === 'r1').descricao = 'Uber (corrigido)' })).status).toBe(200)
    const ops = { reembolsos: { upserts: [{ chave: 'r1', base: hashRegistro(velho), pos: 'fim', dados: { ...velho, valor: 999 } }], remocoes: [] } }
    const r = await chamar('estado', 'PUT', { ops }, c.rh1)
    expect(r.status).toBe(409)
    expect(r.json.conflitos).toEqual([{ colecao: 'reembolsos', chave: 'r1' }])
    expect((await linhas('reembolsos')).find((x) => x.id === 'r1').valor).toBe(50)
  })

  it('lote é tudo-ou-nada', async () => {
    const r = await editar(c.col2, (e) => {
      e.colaboradores.find((p: Obj) => p.id === 'col2').telefone = '1100000000'
      e.reembolsos.unshift({ id: 'rx', colaboradorId: 'col2', categoria: 'Outros', descricao: 'x', valor: 1, data: '2026-10-02', status: 'aprovado', criadoEm: '2026-10-02' })
    })
    expect(r.status).toBe(403)
    expect((await linhas('colaboradores')).find((p) => p.id === 'col2').telefone).not.toBe('1100000000')
  })

  it('pontos: só pela regra; valor inflado ou ajuste manual por colaborador são recusados', async () => {
    const lanc = (pontos: number, acao = 'perfil_completo') => ({ id: `l${pontos}${acao}`, colaboradorId: 'col2', acao, referenciaId: 'perfil', pontos, descricao: 'Perfil completo', criadoEm: new Date().toISOString() })
    expect((await editar(c.col2, (e) => { e.lancamentos.push(lanc(500)) })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.lancamentos.push(lanc(500, 'ajuste_manual')) })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.lancamentos.push(lanc(20)) })).status).toBe(200)
    // Repetir a mesma ação não pontua de novo.
    expect((await editar(c.col2, (e) => { e.lancamentos.push({ ...lanc(20), id: 'outro' }) })).status).toBe(409)
  })

  it('auditoria: só acrescenta em nome próprio; remoções são ignoradas', async () => {
    const reg = { id: 'au9', em: new Date().toISOString(), atorId: 'rh1', acao: 'x', entidade: 'pessoa', entidadeId: 'col1', resumo: 'forjado' }
    expect((await editar(c.col2, (e) => { e.auditoria.unshift(reg) })).status).toBe(403)
    expect((await editar(c.rh1, (e) => { e.auditoria = [] })).status).toBe(200)
    expect(await linhas('auditoria')).toHaveLength(1)
  })

  it('pesquisa legada: resposta só junto com a participação da própria pessoa', async () => {
    await m.pg.query("insert into app_pesquisas (ord, id, dados) values (0, 'q1', $1::jsonb)", [JSON.stringify({ id: 'q1', titulo: 'Clima', descricao: '', perguntas: [], inicio: '2020-01-01', fim: '2099-12-31', status: 'aberta', setoresAlvo: [], minimoRespostas: 3, criadaPor: 'rh1', criadaEm: '2026-01-01' })])
    const resp = { id: 'rp1', pesquisaId: 'q1', setorId: 's2', respostas: {}, enviadaEm: '2026-10-05' }
    expect((await editar(c.col2, (e) => { e.respostas.push(resp) })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.respostas.push(resp); e.participacoes.push({ pesquisaId: 'q1', colaboradorId: 'col2' }) })).status).toBe(200)
    expect((await editar(c.col2, (e) => { e.respostas.push({ ...resp, id: 'rp2' }); e.participacoes.push({ pesquisaId: 'q1', colaboradorId: 'col1' }) })).status).toBe(403)
    expect(await linhas('respostas')).toHaveLength(1)
  })
})

describe('caixa de sugestões', () => {
  it('chave de autoria depende de segredo do servidor; chave forjada é recusada', async () => {
    const { segredoAnonimo: seg } = await ler(c.col2)
    expect(seg).toBe(segredoAnonimo('col2'))
    const base = { titulo: 'Mais cafés', descricao: 'Ideia', categoria: 'Outros', status: 'aguardando', apoios: [], criadaEm: '2026-10-01' }
    // Chave calculada pelo esquema antigo (sal público) não serve mais.
    expect((await editar(c.col2, (e) => { e.sugestoes.push({ ...base, id: 's1', autorChave: chaveAutor('col2', '') }) })).status).toBe(403)
    expect((await editar(c.col2, (e) => { e.sugestoes.push({ ...base, id: 's1', autorChave: chaveAutor('col2', seg) }) })).status).toBe(200)
    // Outra pessoa não edita, mas apoia com a própria chave.
    const seg1 = segredoAnonimo('col1')
    expect((await editar(c.col1, (e) => { e.sugestoes[0].titulo = 'Trocado' })).status).toBe(403)
    expect((await editar(c.col1, (e) => { e.sugestoes[0].apoios = [chaveApoio('col1', 's1', 'outro-segredo')] })).status).toBe(403)
    expect((await editar(c.col1, (e) => { e.sugestoes[0].apoios = [chaveApoio('col1', 's1', seg1)] })).status).toBe(200)
  })

  it('migra chaves antigas uma única vez', async () => {
    await m.pg.query("insert into app_sugestoes (ord, id, dados) values (0, 's0', $1::jsonb)", [JSON.stringify({ id: 's0', titulo: 'a', descricao: 'b', categoria: 'Outros', status: 'aguardando', autorChave: chaveAutor('col2', ''), apoios: [chaveApoio('col1', 's0', '')], criadaEm: '2026-10-01' })])
    expect(await migrarChavesSugestoes(dbPglite(m.pg))).toBe(1)
    const s = (await linhas('sugestoes'))[0]
    expect(s.autorChave).toBe(chaveAutor('col2', segredoAnonimo('col2')))
    expect(s.apoios).toEqual([chaveApoio('col1', 's0', segredoAnonimo('col1'))])
    expect(await migrarChavesSugestoes(dbPglite(m.pg))).toBe(0)
  })
})
