import { requireAuth } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { Separator } from "@/components/ui/separator";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Segunda camada de proteção (a primeira é o proxy.ts): garante que toda
  // página dentro deste grupo tem um perfil válido antes de renderizar.
  const perfil = await requireAuth();
  const supabase = await createClient();
  const { data: empresa } = await supabase
    .from("empresa_config")
    .select("nome_empresa")
    .single();
  const nomeEmpresa = empresa?.nome_empresa ?? "4Juris RH";

  return (
    <SidebarProvider>
      <AppSidebar
        nomeCompleto={perfil.nome_completo}
        papel={perfil.papel}
        nomeEmpresa={nomeEmpresa}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <BreadcrumbNav nomeEmpresa={nomeEmpresa} />
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
