/* API v2 · Gestão de prestadores PJ (fornecedores, contratos, documentos, notas fiscais, kanban, disparos, contas a pagar, painel). */
import type { Rota } from '../../nucleo.js'
import { rotas as cadastros } from './cadastros.js'
import { rotas as notas } from './notas.js'
import { rotas as contas } from './contas.js'
import { rotas as painel } from './painel.js'
import { rotas as disparos } from './disparos.js'
import { rotas as kanban } from './kanban.js'
import { rotas as contratosBase } from './contratosBase.js'
import { rotas as salario } from './salario.js'

// Rotas fixas (ex.: contas/exportar, notas/esperadas) antes das com parâmetro: o roteador usa a primeira que casar.
export const rotas: Rota[] = [...painel, ...disparos, ...kanban, ...contratosBase, ...salario, ...cadastros, ...notas, ...contas]
