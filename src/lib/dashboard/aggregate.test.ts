import { describe, expect, it } from "vitest";
import { buildDashboardSummary } from "./aggregate";

const fixedNow = new Date(2025, 5, 15); // 15/jun/2025

describe("buildDashboardSummary", () => {
  it("ignora notas que não estão com status 'done'", () => {
    const summary = buildDashboardSummary(
      [
        { supplier_name: "Padaria", issue_date: "2025-06-01", total_amount: 100, status: "processing" },
        { supplier_name: "Padaria", issue_date: "2025-06-02", total_amount: 50, status: "error" },
      ],
      { now: fixedNow }
    );

    expect(summary.totalSpent).toBe(0);
    expect(summary.invoiceCount).toBe(0);
  });

  it("soma o total gasto e calcula o ticket médio apenas com notas concluídas", () => {
    const summary = buildDashboardSummary(
      [
        { supplier_name: "Padaria", issue_date: "2025-06-01", total_amount: 100, status: "done" },
        { supplier_name: "Mercado", issue_date: "2025-06-10", total_amount: 200, status: "done" },
      ],
      { now: fixedNow }
    );

    expect(summary.totalSpent).toBe(300);
    expect(summary.invoiceCount).toBe(2);
    expect(summary.averageTicket).toBe(150);
  });

  it("agrupa o gasto por mês dentro da janela solicitada, incluindo meses sem gasto", () => {
    const summary = buildDashboardSummary(
      [
        { supplier_name: "Padaria", issue_date: "2025-06-05", total_amount: 100, status: "done" },
        { supplier_name: "Padaria", issue_date: "2025-04-05", total_amount: 40, status: "done" },
      ],
      { now: fixedNow, monthsWindow: 3 }
    );

    expect(summary.monthly.map((m) => m.month)).toEqual(["2025-04", "2025-05", "2025-06"]);
    expect(summary.monthly[0]!.total).toBe(40);
    expect(summary.monthly[1]!.total).toBe(0);
    expect(summary.monthly[2]!.total).toBe(100);
  });

  it("agrupa por fornecedor, ordena do maior pro menor gasto e limita ao top 8", () => {
    const invoices = Array.from({ length: 10 }, (_, i) => ({
      supplier_name: `Fornecedor ${i}`,
      issue_date: "2025-06-01",
      total_amount: i + 1, // fornecedor 9 gasta mais, fornecedor 0 gasta menos
      status: "done" as const,
    }));

    const summary = buildDashboardSummary(invoices, { now: fixedNow });

    expect(summary.bySupplier).toHaveLength(8);
    expect(summary.bySupplier[0]!.supplier).toBe("Fornecedor 9");
    expect(summary.bySupplier[0]!.total).toBe(10);
  });

  it("usa 'Sem fornecedor' quando o nome vier nulo ou vazio", () => {
    const summary = buildDashboardSummary(
      [{ supplier_name: null, issue_date: "2025-06-01", total_amount: 30, status: "done" }],
      { now: fixedNow }
    );

    expect(summary.bySupplier[0]!.supplier).toBe("Sem fornecedor");
  });
});
