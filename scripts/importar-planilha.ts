/* ============================================================
   Importa a planilha de colaboradores direto no banco, com as mesmas
   regras da tela (Administração > Importar planilha) e as mesmas
   permissões do servidor (grava como a pessoa administradora).
     npm run importar -- "planilha.xlsx"                 # só mostra a prévia
     npm run importar -- "planilha.xlsx" --aplicar       # grava
   Opções: --modo novos|completar|atualizar (padrão: novos)
           --sem-acesso   não cria login para as pessoas novas
           --como <email> quem executa (padrão: administrador principal)
   Lê DATABASE_URL de .env.local (ou do ambiente).
   ============================================================ */
import { randomBytes } from 'node:crypto'
import { carregaEnv } from './env'

carregaEnv()

// localStorage em memória para a store (zustand/persist) rodar em Node.
const mem = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, String(v)), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 },
})

const args = process.argv.slice(2).filter((a) => a !== '--')
const opcao = (nome: string) => { const i = args.indexOf(nome); return i >= 0 ? args[i + 1] : undefined }
const arquivo = args.find((a, i) => !a.startsWith('--') && !['--modo', '--como'].includes(args[i - 1]))
const aplicar = args.includes('--aplicar')
const criarAcesso = !args.includes('--sem-acesso')

async function main() {
  if (!arquivo) throw new Error('Informe o arquivo: npm run importar -- "planilha.xlsx" [--aplicar]')
  const modo = (opcao('--modo') ?? 'novos') as 'novos' | 'completar' | 'atualizar'
  if (!['novos', 'completar', 'atualizar'].includes(modo)) throw new Error('--modo deve ser novos, completar ou atualizar.')

  const { default: lerXlsx } = await import('read-excel-file/node')
  const { db, hashSenha } = await import('../api/_lib')
  const { estadoPara, aplicarLote } = await import('../api/_v2/estadoLegado')
  const { useStore, DB_KEYS } = await import('../src/lib/store')
  const { diferenca } = await import('../src/domain/sincronia')
  const { ADMIN_EMAIL } = await import('../src/lib/mock')
  const { aplicarImportacao, escolherAba, lerPlanilhaPessoas } = await import('../src/domain/importacaoPessoas')
  type Celula = import('../src/domain/importacaoPessoas').Celula

  const abas = (await lerXlsx(arquivo)).map((a) => ({ nome: a.sheet, rows: a.data as Celula[][] }))
  const aba = escolherAba(abas)
  if (!aba) throw new Error('Planilha vazia.')
  console.log(`• aba "${aba.nome}" · modo ${modo}${aplicar ? '' : ' · PRÉVIA (nada será gravado; use --aplicar)'}`)

  const pool = db()
  const cli = await pool.connect()
  try {
    const como = opcao('--como') ?? ADMIN_EMAIL
    const u = (await cli.query('select colaborador_id from usuarios where lower(email) = lower($1) and ativo', [como])).rows[0]
    if (!u) throw new Error(`Usuário ${como} não encontrado ou inativo.`)
    const quem: string = u.colaborador_id
    const r0 = await estadoPara(cli, quem)
    if (!r0) throw new Error('Cadastro de quem executa não encontrado.')

    useStore.setState({ ...(r0.estado as object), sessaoId: quem, previewColaborador: false })
    const st = useStore.getState
    if (!st().pode('pessoas:gerenciar')) throw new Error(`${como} não tem permissão para gerenciar pessoas.`)
    const antes = Object.fromEntries(DB_KEYS.map((k) => [k, JSON.stringify((st() as unknown as Record<string, unknown>)[k])]))

    const leitura = lerPlanilhaPessoas(aba.rows, { setores: st().setores, cargos: st().cargos, pessoas: st().colaboradores, unidades: st().unidades }, undefined, { modo })
    if (leitura.erroCabecalho) throw new Error(leitura.erroCabecalho)
    if (leitura.ignoradas.length) console.log(`• colunas não importadas: ${leitura.ignoradas.join(', ')}`)
    for (const l of leitura.linhas) {
      const situacao = l.acao === 'ignorar' ? 'já cadastrada' : l.erros.length ? 'ERRO' : l.acao === 'criar' ? 'novo' : 'atualizar'
      const funcao = l.input.cargoId ? st().cargoNome(l.input.cargoId) : l.novaFuncao ? `${l.novaFuncao.nome} (nova)` : '—'
      console.log(`  L${String(l.linha).padStart(2)} ${situacao.padEnd(13)} ${l.input.nome.padEnd(38)} ${st().setorNome(l.input.setorId).padEnd(14)} ${funcao.padEnd(28)} ← ${l.superior || '—'}`)
      for (const e of l.erros) console.log(`        ✖ ${e}`)
      for (const a of l.avisos) console.log(`        ! ${a}`)
    }
    if (leitura.funcoesNovas.length) console.log(`• funções novas: ${leitura.funcoesNovas.map((f) => `${f.nome} (${st().setorNome(f.setorId)})`).join(', ')}`)
    const validas = leitura.linhas.filter((l) => l.acao !== 'ignorar' && !l.erros.length)
    console.log(`• ${validas.filter((l) => l.acao === 'criar').length} novo(s), ${validas.filter((l) => l.acao === 'atualizar').length} atualização(ões), ${leitura.linhas.filter((l) => l.acao === 'ignorar').length} já cadastrada(s)`)
    if (!aplicar || !validas.length) return

    const res = aplicarImportacao(validas, {
      salvarPessoa: st().salvarPessoa, pessoas: () => st().colaboradores,
      salvarCargo: st().salvarCargo, cargos: () => st().cargos,
      salvarSetor: st().salvarSetor, setores: () => st().setores,
    }, { modo })

    // Mesmo lote que a interface envia: só os registros que mudaram, com o hash da versão lida.
    const ops: Record<string, NonNullable<ReturnType<typeof diferenca>>> = {}
    for (const k of DB_KEYS) {
      if (k === 'config') continue
      const depois = JSON.stringify((st() as unknown as Record<string, unknown>)[k])
      if (depois === antes[k]) continue
      const d = diferenca(k, JSON.parse(antes[k]), JSON.parse(depois))
      if (d) ops[k] = d
    }
    await cli.query('begin')
    try {
      const r = await aplicarLote(cli, quem, { ops })
      if (r.conflitos?.length) throw new Error(`Alguém alterou os mesmos registros agora há pouco (${r.conflitos.map((c) => c.colecao).join(', ')}). Rode de novo.`)
      await cli.query('commit')
    } catch (e) {
      await cli.query('rollback').catch(() => undefined)
      throw e
    }

    let acessos = 0
    if (criarAcesso) {
      for (const id of res.criadas) {
        const p = st().pessoa(id)
        if (!p) continue
        const ja = await cli.query('select 1 from usuarios where colaborador_id = $1 or lower(email) = lower($2)', [id, p.email])
        if (ja.rowCount) continue
        // Senha aleatória descartada: cada pessoa define a sua em "Esqueceu a senha?".
        await cli.query('insert into usuarios (email, senha_hash, colaborador_id, papel, ativo) values ($1, $2, $3, $4, true)', [p.email, hashSenha(randomBytes(18).toString('base64url')), id, p.papel])
        acessos++
      }
    }

    console.log(`✔ ${res.criadas.length} criado(s), ${res.atualizadas.length} atualizado(s), ${res.ignoradas} sem alteração, ${acessos} acesso(s) criado(s)`)
    if (res.funcoesCriadas.length) console.log(`✔ funções criadas: ${res.funcoesCriadas.join(', ')}`)
    for (const l of res.liderancas) console.log(`✔ ${l}`)
    for (const e of res.erros) console.log(`✖ linha ${e.linha}: ${e.erro}`)
    for (const a of res.avisos) console.log(`! ${a.linha ? `linha ${a.linha}: ` : ''}${a.aviso}`)
  } finally {
    cli.release()
    await pool.end()
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error('✖', e instanceof Error ? e.message : e); process.exit(1) })
