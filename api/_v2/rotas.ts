/* API v2 · registro de todos os módulos. Cada módulo exporta `rotas: Rota[]`. */
import { compilar } from './nucleo.js'
import { rotas as base } from './modulos/base.js'
import { rotas as vagas } from './modulos/vagas.js'
import { rotas as ats } from './modulos/ats.js'
import { rotas as publico } from './modulos/publico.js'
import { rotas as pesquisas } from './modulos/pesquisas.js'
import { rotas as cargos } from './modulos/cargos.js'
import { rotas as organograma } from './modulos/organograma.js'
import { rotas as analytics } from './modulos/analytics.js'
import { rotas as financeiro } from './modulos/financeiro/index.js'
import { rotas as fotos } from './modulos/fotos.js'

export const ROTAS = compilar([...base, ...vagas, ...ats, ...publico, ...pesquisas, ...cargos, ...organograma, ...analytics, ...financeiro, ...fotos])
