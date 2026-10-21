"use client";

import { useMemo, useState } from "react";
import {
  Combobox,
  ComboboxInputGroup,
  ComboboxInput,
  ComboboxIcon,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxPopup,
  ComboboxEmpty,
  ComboboxList,
  ComboboxItem,
} from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/shared/multi-select-combobox";

/**
 * Select de valor único com busca (filtra a lista enquanto digita) —
 * igual ao "Pesquisar" do Sólides pra Colaborador/Tipo de Registro. Ao
 * contrário do <Select> normal, ajuda quando a lista é grande.
 */
export function SearchSelect({
  id,
  name,
  items,
  defaultValue,
  placeholder = "Pesquisar...",
  required,
  disabled,
}: {
  id?: string;
  name: string;
  items: ComboboxOption[];
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  const porId = useMemo(() => new Map(items.map((i) => [i.value, i])), [items]);
  const [selecionado, setSelecionado] = useState<ComboboxOption | null>(
    (defaultValue && porId.get(defaultValue)) || null,
  );

  return (
    <Combobox
      items={items}
      name={name}
      required={required}
      disabled={disabled}
      value={selecionado}
      onValueChange={setSelecionado}
      isItemEqualToValue={(a: ComboboxOption, b: ComboboxOption) => a.value === b.value}
    >
      <ComboboxInputGroup>
        <ComboboxInput id={id} placeholder={placeholder} />
        <ComboboxIcon />
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
