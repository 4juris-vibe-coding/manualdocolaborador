"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

/**
 * Campo de "tags" livres (ex.: Habilidades específicas, Assistências do
 * cargo) — digita e aperta Enter ou vírgula pra adicionar, x pra remover.
 * Cada tag vira um input escondido `name[]` pro form action ler com
 * `formData.getAll(name)`.
 */
export function TagInput({
  name,
  defaultTags = [],
  placeholder,
}: {
  name: string;
  defaultTags?: string[];
  placeholder?: string;
}) {
  const [tags, setTags] = useState(defaultTags);
  const [rascunho, setRascunho] = useState("");

  function adicionar(valor: string) {
    const limpo = valor.trim();
    if (!limpo || tags.includes(limpo)) {
      setRascunho("");
      return;
    }
    setTags((atual) => [...atual, limpo]);
    setRascunho("");
  }

  function remover(valor: string) {
    setTags((atual) => atual.filter((t) => t !== valor));
  }

  return (
    <div>
      {tags.map((tag) => (
        <input key={tag} type="hidden" name={name} value={tag} />
      ))}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-input bg-background px-2 py-1.5 has-focus-within:border-ring has-focus-within:ring-3 has-focus-within:ring-ring/50">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 py-1">
            {tag}
            <button
              type="button"
              onClick={() => remover(tag)}
              className="rounded-full hover:text-destructive"
            >
              <X className="size-3" />
              <span className="sr-only">Remover {tag}</span>
            </button>
          </Badge>
        ))}
        <Input
          value={rascunho}
          onChange={(event) => setRascunho(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              adicionar(rascunho);
            } else if (event.key === "Backspace" && !rascunho && tags.length > 0) {
              remover(tags[tags.length - 1]);
            }
          }}
          onBlur={() => rascunho && adicionar(rascunho)}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="h-6 flex-1 border-none px-1 shadow-none focus-visible:ring-0"
        />
      </div>
    </div>
  );
}
