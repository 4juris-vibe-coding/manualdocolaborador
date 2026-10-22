/* API v2 · Gestão de prestadores PJ (fornecedores, contratos, documentos, notas fiscais, contas a pagar, painel). */
import type { Rota } from '../../nucleo.js'
import { rotas as cadastros } from './cadastros.js'
import { rotas as notas } from './notas.js'
import { rotas as contas } from './contas.js'
import { rotas as painel } from './painel.js'

// Rotas fixas (ex.: contas/exportar, notas/esperadas) antes das com parâmetro: o roteador usa a primeira que casar.
export const rotas: Rota[] = [...painel, ...cadastros, ...notas, ...contas]
