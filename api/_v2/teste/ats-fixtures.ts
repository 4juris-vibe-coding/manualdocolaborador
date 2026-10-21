/* Fixtures dos testes de ATS/portal: vagas por INSERT direto (independe das rotas do módulo de vagas). */
import { ETAPAS_PADRAO } from '../../../src/domain/v2/ats.js'
import type { Mundo } from './harness.js'

export interface OpcoesVaga {
  titulo?: string; status?: string; setorId?: string; qtd?: number; recrutador?: string | null; slug?: string
  perguntas?: unknown[]; divulgarSalario?: boolean; encerraEm?: string | null; arquivada?: boolean
}

let n = 0
export async function criarVaga(m: Mundo, o: OpcoesVaga = {}): Promise<{ id: string; slug: string; etapas: { id: string; tipo: string; nome: string }[] }> {
  n++
  const slug = o.slug ?? `vaga-teste-${n}-${Math.random().toString(36).slice(2, 6)}`
  const r = await m.pg.query<{ id: string }>(
    `insert into rec_vagas (codigo, slug, titulo, resumo, status, setor_id, qtd_posicoes, recrutador_id, perguntas_triagem, divulgar_salario, salario_min, salario_max,
       observacoes_rh, texto_publico, publicada_em, encerra_candidaturas_em, arquivada, gestor_solicitante_id)
     values ($1,$2,$3,'Resumo da vaga',$4,$5,$6,$7,$8::jsonb,$9,5000,9000,'SEGREDO-RH','Descrição pública', now(), $10, $11, 'ger1') returning id`,
    [`VAG-T-${n}`, slug, o.titulo ?? 'Advogado(a) Pleno', o.status ?? 'publicada', o.setorId ?? 's1', o.qtd ?? 1, o.recrutador === undefined ? 'rec1' : o.recrutador,
      JSON.stringify(o.perguntas ?? []), o.divulgarSalario ?? false, o.encerraEm ?? null, o.arquivada ?? false])
  const id = r.rows[0].id
  for (let i = 0; i < ETAPAS_PADRAO.length; i++) await m.pg.query('insert into rec_vaga_etapas (vaga_id, ordem, nome, tipo) values ($1,$2,$3,$4)', [id, i + 1, ETAPAS_PADRAO[i].nome, ETAPAS_PADRAO[i].tipo])
  const et = await m.pg.query<{ id: string; tipo: string; nome: string }>('select id, tipo, nome from rec_vaga_etapas where vaga_id = $1 order by ordem', [id])
  return { id, slug, etapas: et.rows }
}

export const PDF_B64 = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64')

export function corpoCandidatura(extra: Record<string, unknown> = {}) {
  return {
    nome: 'Maria Candidata', email: `maria${Math.random().toString(36).slice(2, 8)}@exemplo.com`, telefone: '(11) 99999-0000', cidade: 'São Paulo', uf: 'SP',
    consentimento: true, curriculo: { nome: 'curriculo.pdf', base64: PDF_B64 }, ...extra,
  }
}
