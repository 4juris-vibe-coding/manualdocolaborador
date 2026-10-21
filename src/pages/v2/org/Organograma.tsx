import { PageHeader, Card, EmptyState } from '@/components/ui'

/** Provisório: será substituído pela implementação do módulo. */
export default function Pagina() {
  return (
    <>
      <PageHeader title="Organograma" />
      <Card><EmptyState icon="Hammer" title="Em construção" desc="Esta tela será liberada em breve." /></Card>
    </>
  )
}
