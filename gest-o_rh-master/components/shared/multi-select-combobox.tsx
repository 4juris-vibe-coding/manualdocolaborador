"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxChips,
  ComboboxChip,
  ComboboxChipRemove,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxPopup,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
  ComboboxValue,
} from "@/components/ui/combobox";

export type ComboboxOption = { value: string; label: string };

/**
 * Campo de busca com chips pra selecionar vários itens (ex.: Responsáveis
 * de um departamento) — igual ao padrão "Pesquisar" do Sólides. Envia
 * `name` várias vezes no FormData (um valor por item selecionado), então
 * `formData.getAll(name)` funciona igual a um grupo de checkboxes.
 */
export function MultiSelectCombobox({
  id,
  name,
  items,
  defaultValues = [],
  placeholder = "Pesquisar...",
}: {
  id?: string;
  name: string;
  items: ComboboxOption[];
  defaultValues?: string[];
  placeholder?: string;
}) {
  const porId = useMemo(() => new Map(items.map((i) => [i.value, i])), [items]);
  const [selecionados, setSelecionados] = useState<ComboboxOption[]>(
    defaultValues.map((id) => porId.get(id)).filter((i): i is ComboboxOption => !!i),
  );

  return (
    <Combobox
      items={items}
      multiple
      name={name}
      value={selecionados}
      onValueChange={setSelecionados}
    >
      <ComboboxInputGroup>
        <ComboboxChips>
          <ComboboxValue>
            {(value: ComboboxOption[]) => (
              <>
                {value.map((item) => (
                  <ComboboxChip key={item.value}>
                    {item.label}
                    <ComboboxChipRemove aria-label={`Remover ${item.label}`} />
                  </ComboboxChip>
                ))}
                <ComboboxInput
                  id={id}
                  placeholder={value.length > 0 ? "" : placeholder}
                />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
      </ComboboxInputGroup>
      <ComboboxPortal>
        <ComboboxPositioner>
          <ComboboxPopup>
            <ComboboxEmpty>Nenhum resultado encontrado.</ComboboxEmpty>
            <ComboboxList>
              {(item: ComboboxOption) => (
                <ComboboxItem key={item.value} value={item}>
                  {item.label}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </ComboboxPositioner>
      </ComboboxPortal>
    </Combobox>
  );
}
