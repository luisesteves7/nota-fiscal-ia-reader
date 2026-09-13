import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buildDashboardSummary } from "@/lib/dashboard/aggregate";
import { MonthlySpendChart, SupplierSpendChart } from "@/components/dashboard-charts";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // middleware já redireciona para /login antes disso
  }

  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("supplier_name, issue_date, total_amount, status");

  const summary = buildDashboardSummary(invoices ?? []);

  return (
    <main className="min-h-screen px-4 py-10">
      <header className="mx-auto mb-8 flex w-full max-w-4xl items-center justify-between">
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/historico" className="text-brand-600 hover:underline">
            Histórico
          </Link>
          <Link href="/" className="text-brand-600 hover:underline">
            ← Voltar
          </Link>
        </nav>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Não foi possível carregar os dados do dashboard: {error.message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Total gasto" value={formatCurrency(summary.totalSpent)} />
          <StatCard label="Notas processadas" value={String(summary.invoiceCount)} />
          <StatCard label="Ticket médio" value={formatCurrency(summary.averageTicket)} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-600">
            Gasto por mês (últimos 6 meses)
          </h2>
          <MonthlySpendChart data={summary.monthly} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-600">
            Gasto por fornecedor (top 8)
          </h2>
          <SupplierSpendChart data={summary.bySupplier} />
        </section>
      </div>
    </main>
  );
}
