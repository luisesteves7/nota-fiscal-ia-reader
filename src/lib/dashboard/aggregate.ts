import type { Database } from "@/types/database";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

export interface MonthlySpend {
  /** Chave ordenável, formato "AAAA-MM" */
  month: string;
  /** Rótulo pronto para exibir, ex: "jan/25" */
  label: string;
  total: number;
}

export interface SupplierSpend {
  supplier: string;
  total: number;
  invoiceCount: number;
}

export interface DashboardSummary {
  totalSpent: number;
  invoiceCount: number;
  averageTicket: number;
  monthly: MonthlySpend[];
  bySupplier: SupplierSpend[];
}

const MONTH_LABELS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function monthLabel(monthKey: string): string {
  const [year = "", month = "01"] = monthKey.split("-");
  const index = Number(month) - 1;
  const shortYear = year.slice(2);
  return `${MONTH_LABELS[index] ?? month}/${shortYear}`;
}

/**
 * Agrega notas fiscais concluídas em estatísticas prontas para o dashboard:
 * total gasto, gasto por mês (últimos `monthsWindow` meses) e por fornecedor.
 *
 * Recebe apenas os campos necessários (não o tipo inteiro de InvoiceRow) para
 * facilitar os testes — não precisamos montar um objeto Invoice completo.
 */
export function buildDashboardSummary(
  invoices: Pick<InvoiceRow, "supplier_name" | "issue_date" | "total_amount" | "status">[],
  options: { monthsWindow?: number; now?: Date } = {}
): DashboardSummary {
  const monthsWindow = options.monthsWindow ?? 6;
  const now = options.now ?? new Date();

  const done = invoices.filter(
    (invoice) => invoice.status === "done" && invoice.total_amount !== null
  );

  const totalSpent = done.reduce((sum, inv) => sum + (inv.total_amount ?? 0), 0);
  const invoiceCount = done.length;
  const averageTicket = invoiceCount > 0 ? totalSpent / invoiceCount : 0;

  // --- gasto por mês -------------------------------------------------
  // monta a janela de meses (do mais antigo pro mais recente) mesmo que
  // não haja gasto em algum mês, pra o gráfico não "pular" períodos.
  const monthKeys: string[] = [];
  for (let i = monthsWindow - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthKeys.push(key);
  }

  const monthTotals = new Map<string, number>(monthKeys.map((key) => [key, 0]));
  for (const invoice of done) {
    if (!invoice.issue_date) continue;
    const key = invoice.issue_date.slice(0, 7); // "AAAA-MM-DD" -> "AAAA-MM"
    if (monthTotals.has(key)) {
      monthTotals.set(key, (monthTotals.get(key) ?? 0) + (invoice.total_amount ?? 0));
    }
  }

  const monthly: MonthlySpend[] = monthKeys.map((key) => ({
    month: key,
    label: monthLabel(key),
    total: Math.round((monthTotals.get(key) ?? 0) * 100) / 100,
  }));

  // --- gasto por fornecedor -------------------------------------------
  const supplierTotals = new Map<string, { total: number; count: number }>();
  for (const invoice of done) {
    const supplier = invoice.supplier_name?.trim() || "Sem fornecedor";
    const current = supplierTotals.get(supplier) ?? { total: 0, count: 0 };
    current.total += invoice.total_amount ?? 0;
    current.count += 1;
    supplierTotals.set(supplier, current);
  }

  const bySupplier: SupplierSpend[] = Array.from(supplierTotals.entries())
    .map(([supplier, { total, count }]) => ({
      supplier,
      total: Math.round(total * 100) / 100,
      invoiceCount: count,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8); // top 8 — o resto polui o gráfico sem agregar informação

  return {
    totalSpent: Math.round(totalSpent * 100) / 100,
    invoiceCount,
    averageTicket: Math.round(averageTicket * 100) / 100,
    monthly,
    bySupplier,
  };
}
