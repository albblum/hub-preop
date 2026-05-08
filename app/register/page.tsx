import Link from "next/link";

export default function RegisterPage() {
  return (
    <div className="min-h-screen bg-zinc-950 p-8 text-zinc-100">
      <main className="mx-auto max-w-2xl space-y-6 pt-12">
        <h1 className="text-2xl font-semibold">Registro de acompanhamento do DocHub</h1>
        <p className="text-sm text-zinc-400">
          Este caminho representa vínculo institucional voluntário para não-membros.
          No MVP, o registro é assistido pelo secretariado.
        </p>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 text-sm">
          <p className="text-zinc-200">
            Para solicitar registro, envie contato para o secretariado e informe seu e-mail de
            acompanhamento.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/public" className="text-amber-200 underline">
            Explorar o DocHub
          </Link>
          <Link href="/login" className="text-zinc-300 underline">
            Voltar para entrada
          </Link>
        </div>
      </main>
    </div>
  );
}

