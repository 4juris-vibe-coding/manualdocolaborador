import { describe, it, expect } from 'vitest'
import { mundoPadrao } from './teste/harness'
import { escopoVagas, pessoaPorId, montarUsuario } from './nucleo'

describe('escopo de vagas', () => {
  it('gestor vê só as vagas da própria área; RH vê todas (array como parâmetro funciona no banco)', async () => {
    const m = await mundoPadrao()
    await m.pg.query(`insert into rec_vagas (codigo, slug, titulo, setor_id) values ('V1','v1','A','s1'), ('V2','v2','B','s2')`)
    const uid = async (id: string) => (await m.pg.query<{ id: string }>('select id from usuarios where colaborador_id = $1', [id])).rows[0].id
    const ger = (await montarUsuario(m.db, await uid('ger1'), 'ger1'))!
    const rh = (await montarUsuario(m.db, await uid('rh1'), 'rh1'))!
    const e1 = escopoVagas(ger, 'v', 1)
    const r1 = await m.db.query(`select codigo from rec_vagas v where ${e1.sql} order by codigo`, e1.params)
    expect(r1.rows.map((x) => x.codigo)).toEqual(['V1'])
    const e2 = escopoVagas(rh)
    expect((await m.db.query(`select codigo from rec_vagas v where ${e2.sql}`, e2.params)).rows).toHaveLength(2)
    expect(await pessoaPorId(m.db, 'nao-existe')).toBeNull()
  })
})
