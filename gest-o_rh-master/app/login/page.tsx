import { LoginForm } from "@/components/forms/login-form";

export default async function LoginPage(props: PageProps<"/login">) {
  const searchParams = await props.searchParams;
  const next =
    typeof searchParams.next === "string" ? searchParams.next : undefined;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary">4Juris RH</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse sua conta para continuar
          </p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
