export function PageHeader({
  title,
  description,
  badges,
  action,
}: {
  title: string;
  description?: string;
  /** Contadores compactos (ex.: <CountPill>) exibidos ao lado do título. */
  badges?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {badges}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
