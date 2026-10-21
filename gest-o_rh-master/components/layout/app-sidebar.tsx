"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutDashboard } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import {
  DASHBOARD_ITEM,
  NAV_ITEMS,
  type NavChild,
} from "@/components/layout/nav-config";
import { UserMenu } from "@/components/layout/user-menu";
import type { PapelUsuario } from "@/types/database.types";

/** Coleta recursivamente os hrefs de uma lista de filhos (que podem ter
 * seus próprios filhos — ex.: "Competências" dentro de "Desenv. e
 * Performance"), respeitando adminOnly. */
function coletarHrefs(filhos: NavChild[], isAdmin: boolean): string[] {
  const hrefs: string[] = [];
  for (const filho of filhos) {
    if (filho.adminOnly && !isAdmin) continue;
    if (filho.href) hrefs.push(filho.href);
    if (filho.children) hrefs.push(...coletarHrefs(filho.children, isAdmin));
  }
  return hrefs;
}

/** true se algum descendente (em qualquer profundidade) é a rota ativa —
 * usado pra decidir se um (sub)grupo já abre expandido. */
function algumFilhoAtivo(
  filhos: NavChild[],
  isActive: (href: string) => boolean,
  isAdmin: boolean,
): boolean {
  return filhos.some((filho) => {
    if (filho.adminOnly && !isAdmin) return false;
    if (filho.href && isActive(filho.href)) return true;
    if (filho.children) return algumFilhoAtivo(filho.children, isActive, isAdmin);
    return false;
  });
}

/** Lista de sub-itens de um grupo — recursiva, pra suportar o sub-grupo
 * de mais um nível que "Desenv. e Performance" precisa (ex.: dentro dele,
 * "Competências" também expande/recolhe, com seus próprios filhos). */
function NavSubList({
  filhos,
  isAdmin,
  isActive,
}: {
  filhos: NavChild[];
  isAdmin: boolean;
  isActive: (href: string) => boolean;
}) {
  return (
    <SidebarMenuSub>
      {filhos
        .filter((filho) => !filho.adminOnly || isAdmin)
        .map((filho) => {
          if (filho.children) {
            const netos = filho.children.filter((neto) => !neto.adminOnly || isAdmin);
            if (netos.length === 0) return null;
            const subGrupoAtivo = algumFilhoAtivo(netos, isActive, isAdmin);

            return (
              <Collapsible
                key={`${filho.title}-${subGrupoAtivo}`}
                defaultOpen={subGrupoAtivo}
              >
                <SidebarMenuSubItem>
                  <CollapsibleTrigger
                    className="group flex w-full cursor-pointer items-center"
                    nativeButton={false}
                    render={<SidebarMenuSubButton isActive={subGrupoAtivo} />}
                  >
                    <span>{filho.title}</span>
                    <ChevronRight className="ml-auto size-3.5 shrink-0 transition-transform group-data-panel-open:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <NavSubList filhos={netos} isAdmin={isAdmin} isActive={isActive} />
                  </CollapsibleContent>
                </SidebarMenuSubItem>
              </Collapsible>
            );
          }

          return (
            <SidebarMenuSubItem key={filho.href}>
              <SidebarMenuSubButton
                render={<Link href={filho.href!} />}
                isActive={isActive(filho.href!)}
              >
                <span>{filho.title}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          );
        })}
    </SidebarMenuSub>
  );
}

export function AppSidebar({
  nomeCompleto,
  papel,
  nomeEmpresa,
}: {
  nomeCompleto: string;
  papel: PapelUsuario;
  nomeEmpresa: string;
}) {
  const pathname = usePathname();

  // Destaque por "prefixo mais específico vence": algumas páginas (ex.:
  // /configuracoes, que é hub de várias sub-páginas) são prefixo de outras
  // rotas do menu. Sem isso, abrir /configuracoes/motivos-demissao
  // acenderia tanto "Motivos de Demissão" (em Gestão de Talentos) quanto
  // "Geral" (em Configurações, href = /configuracoes) ao mesmo tempo.
  const melhorHref = useMemo(() => {
    const isAdmin = papel === "admin_rh";
    const candidatos = [DASHBOARD_ITEM.href];
    for (const item of NAV_ITEMS) {
      if (item.adminOnly && !isAdmin) continue;
      if (item.href) candidatos.push(item.href);
      if (item.children) candidatos.push(...coletarHrefs(item.children, isAdmin));
    }
    let melhor: string | null = null;
    for (const href of candidatos) {
      if (pathname !== href && !pathname.startsWith(`${href}/`)) continue;
      if (!melhor || href.length > melhor.length) melhor = href;
    }
    return melhor;
  }, [pathname, papel]);

  const isActive = (href: string) => href === melhorHref;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}>
              <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                4J
              </span>
              <span className="truncate text-sm font-semibold text-primary">
                {nomeEmpresa}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href={DASHBOARD_ITEM.href} />}
                  isActive={isActive(DASHBOARD_ITEM.href)}
                  tooltip={DASHBOARD_ITEM.title}
                >
                  <LayoutDashboard />
                  <span>{DASHBOARD_ITEM.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {NAV_ITEMS.filter(
                (item) => !item.adminOnly || papel === "admin_rh",
              ).map((item) => {
                // Item simples (sem submenu): link direto.
                if (!item.children) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        render={<Link href={item.href!} />}
                        isActive={isActive(item.href!)}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge className="ml-auto bg-destructive px-1.5 py-0 text-[10px] text-white">
                            {item.badge}
                          </Badge>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                // Grupo com submenu: acordeão, igual ao menu de referência
                // (a seção do item ativo já abre expandida). Os filhos
                // podem ter seus próprios filhos (ex.: "Desenv. e
                // Performance" > "Competências") — NavSubList cuida disso
                // recursivamente.
                const isAdmin = papel === "admin_rh";
                const filhos = item.children.filter(
                  (child) => !child.adminOnly || isAdmin,
                );
                if (filhos.length === 0) return null;
                const grupoAtivo = algumFilhoAtivo(filhos, isActive, isAdmin);

                return (
                  <Collapsible
                    key={`${item.title}-${grupoAtivo}`}
                    defaultOpen={grupoAtivo}
                  >
                    <SidebarMenuItem>
                      <CollapsibleTrigger
                        className="group"
                        render={
                          <SidebarMenuButton
                            tooltip={item.title}
                            isActive={grupoAtivo}
                          />
                        }
                      >
                        <item.icon />
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform group-data-panel-open:rotate-90" />
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <NavSubList filhos={filhos} isAdmin={isAdmin} isActive={isActive} />
                      </CollapsibleContent>
                    </SidebarMenuItem>
                  </Collapsible>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <UserMenu nomeCompleto={nomeCompleto} papel={papel} />
      </SidebarFooter>
    </Sidebar>
  );
}
