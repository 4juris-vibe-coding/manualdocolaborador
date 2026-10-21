/* ============================================================
   Prepara o banco (Supabase): cria as tabelas, grava o conteúdo
   padrão (uma única vez) e garante o usuário ADMIN.
     npm run db:setup                  # idempotente
     ADMIN_SENHA='...' npm run db:setup -- --senha   # define/troca a senha do admin
   Lê DATABASE_URL de .env.local (ou do ambiente).
   ============================================================ */
import { readFileSync, readdirSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { carregaEnv } from './env'
import { db, gravarColecoes, hashSenha } from '../api/_lib'
import { ADMIN_EMAIL, ADMIN_ID, seedProducao } from '../src/lib/mock'

carregaEnv()

async function main() {
  const p = db()
  await p.query(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  console.log('✔ tabelas criadas/verificadas')
  // Módulos v2 (recrutamento, pesquisas, cargos…): migrações aditivas e idempotentes, em ordem.
  for (const f of readdirSync(new URL('../db/v2/', import.meta.url)).filter((n) => n.endsWith('.sql')).sort()) {
    await p.query(readFileSync(new URL(`../db/v2/${f}`, import.meta.url), 'utf8'))
    console.log(`✔ db/v2/${f}`)
  }

  const jaIniciou = await p.query("select 1 from app_meta where chave = 'inicializado'")
  if (!jaIniciou.rowCount) {
    const { config, ...colecoes } = seedProducao() as unknown as Record<string, unknown>
    await gravarColecoes({ ...colecoes, config })
    await p.query("insert into app_meta (chave, valor) values ('inicializado', to_jsonb(now()))")
    console.log('✔ conteúdo padrão gravado (estrutura + administrador)')
  } else console.log('• conteúdo já inicializado — mantido como está')

  const existe = await p.query('select id from usuarios where lower(email) = lower($1)', [ADMIN_EMAIL])
  const trocar = process.argv.includes('--senha')
  if (!existe.rowCount || trocar) {
    const senha = process.env.ADMIN_SENHA || randomBytes(12).toString('base64url')
    if (senha.length < 10) throw new Error('A senha precisa ter ao menos 10 caracteres.')
    if (existe.rowCount) await p.query('update usuarios set senha_hash = $2, ativo = true where lower(email) = lower($1)', [ADMIN_EMAIL, hashSenha(senha)])
    else await p.query("insert into usuarios (email, senha_hash, colaborador_id, papel) values ($1, $2, $3, 'admin')", [ADMIN_EMAIL, hashSenha(senha), ADMIN_ID])
    console.log(`✔ usuário admin: ${ADMIN_EMAIL}\n  senha: ${senha}\n  (anote agora — só o hash fica no banco)`)
  } else console.log(`• usuário ${ADMIN_EMAIL} já existe (use --senha para trocar a senha)`)

  const sobrando = await p.query('select email from usuarios where lower(email) <> lower($1)', [ADMIN_EMAIL])
  if (sobrando.rowCount) console.log('! há outros usuários cadastrados:', sobrando.rows.map((r) => r.email).join(', '))
  await p.end()
}
main().catch((e) => { console.error('✖', e.message); process.exit(1) })
