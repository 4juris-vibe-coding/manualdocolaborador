import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const FORM_MAX_WIDTH = {
  full: "",
  lg: "max-w-lg",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
} as const;

/**
 * Coluna de toda página de cadastro (criar/editar). Usa a largura cheia
 * da área de conteúdo por padrão — igual ao Sólides e às nossas próprias
 * listagens — em vez de uma coluna estreita e centralizada com uma
 * margem enorme sobrando dos dois lados. `maxWidth` continua disponível
 * pra um formulário pontual que precise de uma coluna mais estreita.
 */
export function FormPage({
  maxWidth = "full",
  className,
  children,
}: {
  maxWidth?: keyof typeof FORM_MAX_WIDTH;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full flex-col gap-6",
        FORM_MAX_WIDTH[maxWidth],
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Corpo do formulário elevado num card (em vez de campos soltos no fundo
 * cinza da página) com um rodapé destacado para as ações — mesmo padrão
 * de tela de cadastro usado em Stripe/Linear/Vercel.
 */
export function FormCard({
  children,
  footer,
  className,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "[--card-spacing:--spacing(5)] sm:[--card-spacing:--spacing(7)]",
        className,
      )}
    >
      <CardContent className="flex flex-col gap-8">{children}</CardContent>
      {footer && <CardFooter className="justify-end gap-3">{footer}</CardFooter>}
    </Card>
  );
}

/** Ícone + título + linha divisória, para separar seções dentro de um
 * FormCard com vários grupos de campos (ex.: o formulário de Colaborador). */
export function FormSectionHeading({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-3">
      <Icon className="size-4 text-primary" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

/** Par de botões padrão do rodapé: "Cancelar" volta pra listagem sem
 * salvar, o outro dispara a action do form (que é quem controla `pending`
 * via useActionState). */
export function FormActions({
  cancelHref,
  pending,
  submitLabel = "Salvar",
  pendingLabel = "Salvando...",
  disabled,
}: {
  cancelHref: string;
  pending: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  return (
    <>
      <Button type="button" variant="outline" render={<Link href={cancelHref} />}>
        Cancelar
      </Button>
      <Button type="submit" disabled={pending || disabled}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </>
  );
}
