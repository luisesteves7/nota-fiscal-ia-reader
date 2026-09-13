import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./login/actions";
import { UploadInvoiceFlow } from "@/components/upload-invoice-flow";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen px-4 py-10">
      <header className="mx-auto mb-8 flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-xl font-semibold">Nota Fiscal IA Reader</h1>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-brand-600 hover:underline">
            Dashboard
          </Link>
          <Link href="/historico" className="text-brand-600 hover:underline">
            Histórico
          </Link>
          {user && (
            <form action={signOut}>
              <button type="submit" className="text-slate-500 hover:underline">
                Sair ({user.email})
              </button>
            </form>
          )}
        </div>
      </header>

      <UploadInvoiceFlow />
    </main>
  );
}
