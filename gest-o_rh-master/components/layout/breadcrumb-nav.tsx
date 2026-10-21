"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ROUTE_LABELS } from "@/components/layout/nav-config";

// IDs de registro (uuid) não têm rótulo conhecido — a própria página de
// detalhe pode sobrepor o título depois, aqui só evitamos mostrar o uuid cru.
const UUID_RE = /^[0-9a-f-]{16,}$/i;

export function BreadcrumbNav({ nomeEmpresa }: { nomeEmpresa: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbsRota = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const label =
      ROUTE_LABELS[segment] ?? (UUID_RE.test(segment) ? "Detalhes" : segment);
    return { href, label };
  });

  // Primeiro item fixo é o nome da empresa (mesmo padrão do menu de
  // referência: "Empresa • Página").
  const crumbs = [{ href: "/dashboard", label: nomeEmpresa }, ...crumbsRota];

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <span key={crumb.href + index} className="flex items-center gap-1.5">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link href={crumb.href} />}>
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
