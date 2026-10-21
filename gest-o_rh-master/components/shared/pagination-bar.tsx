import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function PaginaLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  const classes = cn(
    buttonVariants({ variant: "outline", size: "icon-sm" }),
    disabled && "pointer-events-none opacity-50",
  );
  if (disabled) {
    return (
      <span aria-disabled className={classes}>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

function hrefParaPagina(
  searchParams: Record<string, string | undefined>,
  destino: number,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "pagina") params.set(key, value);
  }
  params.set("pagina", String(destino));
  return `?${params.toString()}`;
}

export function PaginationBar({
  pagina,
  totalPaginas,
  totalRegistros,
  searchParams,
}: {
  pagina: number;
  totalPaginas: number;
  totalRegistros: number;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
      <span>{totalRegistros} registros no total</span>
      <div className="flex items-center gap-2">
        <span>
          Página {pagina} de {totalPaginas}
        </span>
        <PaginaLink
          href={hrefParaPagina(searchParams, pagina - 1)}
          disabled={pagina <= 1}
        >
          <ChevronLeft />
        </PaginaLink>
        <PaginaLink
          href={hrefParaPagina(searchParams, pagina + 1)}
          disabled={pagina >= totalPaginas}
        >
          <ChevronRight />
        </PaginaLink>
      </div>
    </div>
  );
}
