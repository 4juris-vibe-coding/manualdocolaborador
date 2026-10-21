"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const OPCOES = [10, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }));

/** Select "N por página" que reflete e atualiza o `?por_pagina=` na URL,
 * voltando pra primeira página quando muda (igual ao Sólides). */
export function PorPaginaSelect({ totalRegistros }: { totalRegistros: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const atual = searchParams.get("por_pagina") ?? "25";

  function handleChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("por_pagina", next);
    params.delete("pagina");
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>
        {totalRegistros} {totalRegistros === 1 ? "resultado" : "resultados"}
      </span>
      <Select items={OPCOES} value={atual} onValueChange={(v) => v && handleChange(v)}>
        <SelectTrigger size="sm" className="w-[4.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPCOES.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span>por página</span>
    </div>
  );
}
