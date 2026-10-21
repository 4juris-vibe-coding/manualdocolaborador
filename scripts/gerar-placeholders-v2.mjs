// Gera páginas provisórias dos módulos v2 que ainda não existem (não sobrescreve as existentes).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const paginas = {
  'vagas/PainelVagas': 'Painel de vagas',
  'vagas/ListaVagas': 'Vagas',
  'vagas/VagaForm': 'Nova vaga',
  'vagas/VagaDetalhe': 'Vaga',
  'vagas/ConfigRecrutamento': 'Configurações do recrutamento',
  'ats/Pipeline': 'Candidatos',
  'ats/CandidatoPerfil': 'Candidato',
  'ats/Talentos': 'Banco de talentos',
  'ats/Entrevistas': 'Entrevistas',
  'ats/Comunicacao': 'Comunicação com candidatos',
  'carreiras/Carreiras': 'Carreiras',
  'carreiras/VagaPublica': 'Vaga',
  'carreiras/Candidatar': 'Candidatura',
  'carreiras/Acompanhar': 'Acompanhar candidatura',
  'pesquisas/Painel': 'Central de pesquisas',
  'pesquisas/Lista': 'Pesquisas',
  'pesquisas/Construtor': 'Construtor de pesquisas',
  'pesquisas/Templates': 'Biblioteca de modelos',
  'pesquisas/Resultados': 'Resultados',
  'pesquisas/Responder': 'Responder pesquisa',
  'cargos/Catalogo': 'Catálogo de cargos',
  'cargos/CargoFicha': 'Ficha do cargo',
  'cargos/Familias': 'Famílias e trilhas',
  'cargos/Matriz': 'Matriz de competências',
  'cargos/Faixas': 'Faixas salariais',
  'cargos/Governanca': 'Governança de cargos',
  'org/Organograma': 'Organograma',
  'analytics/Analytics': 'People Analytics',
  'admin/FuncoesAdicionais': 'Funções adicionais',
}

for (const [arquivo, titulo] of Object.entries(paginas)) {
  const caminho = `src/pages/v2/${arquivo}.tsx`
  if (existsSync(caminho)) continue
  mkdirSync(dirname(caminho), { recursive: true })
  writeFileSync(caminho, `import { PageHeader, Card, EmptyState } from '@/components/ui'

/** Provisório: será substituído pela implementação do módulo. */
export default function Pagina() {
  return (
    <>
      <PageHeader title="${titulo}" />
      <Card><EmptyState icon="Hammer" title="Em construção" desc="Esta tela será liberada em breve." /></Card>
    </>
  )
}
`)
  console.log('criado', caminho)
}
