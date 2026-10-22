/* ============================================================
   API v2 · Foto de perfil
   A própria pessoa ou quem tem `pessoas:gerenciar` (RH) troca ou
   remove a foto. Qualquer pessoa autenticada vê as fotos (como no
   diretório). O recorte é feito no navegador; aqui só se valida
   formato (pelos bytes) e tamanho.
   ============================================================ */
import { Buffer } from 'node:buffer'
import { auditar, invalido, naoEncontrado, ok, pessoaPorId, proibido, tem, type Rota, type Usuario } from '../nucleo.js'
import { validarUpload } from '../arquivos.js'

export const LIMITE_FOTO = 512 * 1024

function podeEditar(u: Usuario, id: string) {
  if (u.colaboradorId !== id && !tem(u, 'pessoas:gerenciar')) throw proibido('Só a própria pessoa ou o RH alteram esta foto.')
}

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'pessoas/fotos',
    h: async ({ db }) => {
      const r = await db.query('select colaborador_id, atualizado_em from pes_fotos')
      return ok({ versoes: Object.fromEntries(r.rows.map((x) => [x.colaborador_id, new Date(x.atualizado_em).getTime()])) })
    },
  },
  {
    metodo: 'GET', padrao: 'pessoas/:id/foto',
    h: async ({ db, params }) => {
      const r = await db.query('select mime, dados from pes_fotos where colaborador_id = $1', [params.id])
      if (!r.rows[0]) throw naoEncontrado('Esta pessoa não tem foto.')
      // a interface pede com ?v=<versão>: pode guardar em cache por bastante tempo
      return { status: 200, binario: { mime: r.rows[0].mime, nome: 'foto', dados: Buffer.from(r.rows[0].dados as Uint8Array), inline: true }, cabecalhos: { 'Cache-Control': 'private, max-age=86400' } }
    },
  },
  {
    metodo: 'PUT', padrao: 'pessoas/:id/foto',
    h: async ({ db, usuario: u, params, req }) => {
      podeEditar(u, params.id)
      const up = validarUpload(req.corpo?.arquivo, ['jpg', 'png'], 'foto')
      if (up.dados.length > LIMITE_FOTO) throw invalido('A foto recortada passou de 512 KB.', { foto: 'Máximo de 512 KB' })
      if (!(await pessoaPorId(db, params.id))) throw naoEncontrado('Pessoa não encontrada.')
      const r = await db.query(
        `insert into pes_fotos (colaborador_id, mime, dados, atualizado_por) values ($1,$2,$3,$4)
         on conflict (colaborador_id) do update set mime = excluded.mime, dados = excluded.dados, atualizado_em = now(), atualizado_por = excluded.atualizado_por
         returning atualizado_em`, [params.id, up.mime, up.dados, u.colaboradorId])
      await auditar(db, u.colaboradorId, 'pessoa', params.id, 'foto', { proprio: u.colaboradorId === params.id })
      return ok({ versao: new Date(r.rows[0].atualizado_em).getTime() })
    },
  },
  {
    metodo: 'DELETE', padrao: 'pessoas/:id/foto',
    h: async ({ db, usuario: u, params }) => {
      podeEditar(u, params.id)
      const r = await db.query('delete from pes_fotos where colaborador_id = $1', [params.id])
      if (!r.rowCount) throw naoEncontrado('Esta pessoa não tem foto.')
      await auditar(db, u.colaboradorId, 'pessoa', params.id, 'foto_removida', { proprio: u.colaboradorId === params.id })
      return ok({ removida: true })
    },
  },
]
