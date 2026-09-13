import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { EditInvoiceForm } from "@/components/edit-invoice-form";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceItemRow = Database["public"]["Tables"]["invoice_items"]["Row"];
type InvoiceWithItems = InvoiceRow & { invoice_items: InvoiceItemRow[] };

export default async function EditarNotaPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // middleware já redireciona para /login antes disso
  }

  // A RLS ("invoices: select próprias") já garante que só vem aqui uma nota
  // do próprio usuário — se vier vazio, ou não existe ou não é dele.
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", params.id)
    .returns<InvoiceWithItems[]>()
    .maybeSingle();

  if (!invoice) {
    notFound();
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <header className="mx-auto mb-8 flex w-full max-w-2xl items-center justify-between">
        <h1 className="text-xl font-semibold">Editar nota</h1>
        <Link href="/historico" className="text-brand-600 hover:underline">
          ← Voltar ao histórico
        </Link>
      </header>

      <div className="mx-auto w-full max-w-2xl">
        <EditInvoiceForm invoice={invoice} />
      </div>
    </main>
  );
}
