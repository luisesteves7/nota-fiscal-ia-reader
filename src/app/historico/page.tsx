import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceWithItemCount = InvoiceRow & {
  invoice_items: { id: string }[];
};

/** URL assinada válida por 10 minutos — o bucket "invoices" é privado. */
const SIGNED_URL_TTL_SECONDS = 10 * 60;

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value: string | null) {
  if (!value) return "—";
  // value vem como "AAAA-MM-DD" (coluna date); evitar Date() puro por causa
  // de timezone, que pode voltar um dia a menos.
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

const statusLabel: Record<string, string> = {
  processing: "Processando",
  done: "Concluída",
  error: "Erro",
};

const statusClass: Record<string, string> = {
  processing: "bg-amber-100 text-amber-800",
  done: "bg-green-100 text-green-800",
  error: "bg-red-100 text-red-800",
};

export default async function HistoricoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // middleware já redireciona para /login antes disso
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(id)")
    .order("created_at", { ascending: false })
    .returns<InvoiceWithItemCount[]>();

  // URL assinada por nota, pra permitir abrir o arquivo original sem
  // expor o bucket (que é privado). Feito em paralelo pra não somar o
  // tempo de cada chamada.
  const signedUrls = new Map<string, string>();
  if (invoices && invoices.length > 0) {
    await Promise.all(
      invoices.map(async (invoice) => {
        const { data: signed } = await supabase.storage
          .from("invoices")
          .createSignedUrl(invoice.raw_file_url, SIGNED_URL_TTL_SECONDS);
        if (signed?.signedUrl) {
          signedUrls.set(invoice.id, signed.signedUrl);
        }
      })
    );
  }

  return (
    <main className="min-h-screen px-4 py-10">
      <header className="mx-auto mb-8 flex w-full max-w-4xl items-center justify-between">
        <h1 className="text-xl font-semibold">Histórico de notas</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/dashboard" className="text-brand-600 hover:underline">
            Dashboard
          </Link>
          <Link href="/" className="text-brand-600 hover:underline">
            ← Voltar
          </Link>
        </nav>
      </header>

      <div className="mx-auto w-full max-w-4xl">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Não foi possível carregar o histórico: {error.message}
          </div>
        )}

        {!error && invoices && invoices.length === 0 && (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Nenhuma nota enviada ainda.{" "}
            <Link href="/" className="text-brand-600 hover:underline">
              Enviar a primeira
            </Link>
          </div>
        )}

        {!error && invoices && invoices.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Nº da nota</th>
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Itens</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Arquivo</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3">
                      {invoice.supplier_name ?? "—"}
                      {invoice.supplier_cnpj && (
                        <span className="block text-xs text-slate-400">
                          {invoice.supplier_cnpj}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{invoice.invoice_number ?? "—"}</td>
                    <td className="px-4 py-3">{formatDate(invoice.issue_date)}</td>
                    <td className="px-4 py-3">{invoice.invoice_items.length}</td>
                    <td className="px-4 py-3">{formatCurrency(invoice.total_amount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          statusClass[invoice.status] ?? "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {statusLabel[invoice.status] ?? invoice.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {signedUrls.has(invoice.id) ? (
                        <a
                          href={signedUrls.get(invoice.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-600 hover:underline"
                        >
                          Ver
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/historico/${invoice.id}/editar`}
                        className="text-brand-600 hover:underline"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}