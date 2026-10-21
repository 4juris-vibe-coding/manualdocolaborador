import Link from "next/link";
import { ClipboardList, UserCog } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// "Motivos de Demissão" não mora aqui: é um cadastro de RH (segue o menu
// do Sólides, que o lista dentro de Gestão de Talentos), não uma
// configuração de sistema — a rota é /motivos-demissao, fora deste grupo.
const SECOES = [
  {
    href: "/configuracoes/usuarios",
    icon: UserCog,
    title: "Usuários do sistema",
    description: "Contas de acesso do RH e dos gestores, com seus papéis.",
  },
  {
    href: "/configuracoes/tipos-registro",
    icon: ClipboardList,
    title: "Tipos de Registro",
    description: "Categorias para classificar ocorrências do colaborador.",
  },
];

export default async function ConfiguracoesPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Configurações"
        description="Cadastros de apoio e usuários do sistema."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECOES.map((secao) => (
          <Link key={secao.href} href={secao.href} className="block">
            <Card className="h-full transition-colors hover:border-primary/40 hover:bg-muted/40">
              <CardHeader>
                <secao.icon className="mb-2 size-5 text-primary" />
                <CardTitle>{secao.title}</CardTitle>
                <CardDescription>{secao.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
