"use client";

import { useState } from "react";
import type { ExtractedInvoice, InvoiceItem } from "@/lib/validation/invoice-schema";
import { itemsMatchTotal } from "@/lib/validation/invoice-schema";
import { sampleInvoices, type SampleInvoice } from "@/lib/demo/sample-invoices";
import { buildDashboardSummary } from "@/lib/dashboard/aggregate";
import { MonthlySpendChart, SupplierSpendChart } from "@/components/dashboard-charts";

/** Fake delay pra manter a mesma sensação de "processando" da tela real. */
const FAKE_EXTRACTION_DELAY_MS = 900;

type Stage =
  | { step: "idle" }
  | { step: "extracting"; sample: SampleInvoice }
  | { step: "review"; sample: SampleInvoice; invoice: ExtractedInvoice }
  | { step: "saved" };

/** Uma nota confirmada dentro da sessão demo — nunca é enviada ao Supabase. */
interface SavedDemoInvoice {
  id: string;
  fileName: string;
  invoice: ExtractedInvoice;
}

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DemoFlow() {
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const [saved, setSaved] = useState<SavedDemoInvoice[]>([]);
  const [nextSampleIndex, setNextSampleIndex] = useState(0);

  const remainingSamples = sampleInvoices.length - saved.length;

  function startNext() {
    const sample = sampleInvoices[nextSampleIndex % sampleInvoices.length];
    if (!sample) return;
    setStage({ step: "extracting", sample });

    // Simula o tempo de resposta da IA sem chamar nenhuma API de verdade.
    setTimeout(() => {
      // Clona pra o usuário poder editar sem afetar o array original.
      setStage({
        step: "review",
        sample,
        invoice: { ...sample.invoice, items: sample.invoice.items.map((i) => ({ ...i })) },
      });
    }, FAKE_EXTRACTION_DELAY_MS);
  }

  function updateInvoiceField<K extends keyof ExtractedInvoice>(
    key: K,
    value: ExtractedInvoice[K]
  ) {
    if (stage.step !== "review") return;
    setStage({ ...stage, invoice: { ...stage.invoice, [key]: value } });
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    if (stage.step !== "review") return;
    const items = stage.invoice.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    setStage({ ...stage, invoice: { ...stage.invoice, items } });
  }

  function confirm() {
    if (stage.step !== "review") return;
    setSaved((prev) => [
      ...prev,
      { id: crypto.randomUUID(), fileName: stage.sample.fileName, invoice: stage.invoice },
    ]);
    setNextSampleIndex((i) => i + 1);
    setStage({ step: "saved" });
  }

  const summary = buildDashboardSummary(
    saved.map((s) => ({
      supplier_name: s.invoice.supplier_name,
      issue_date: s.invoice.issue_date,
      total_amount: s.invoice.total_amount,
      status: "done" as const,
    }))
  );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Modo demo:</strong> os dados abaixo são 100% fictícios e processados só no seu
        navegador — nada é enviado a nenhuma API de IA nem salvo em banco de dados. Recarregar a
        página apaga tudo.
      </div>

      {stage.step === "idle" && (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium">
            {remainingSamples > 0
              ? `Processar nota de exemplo (${saved.length}/${sampleInvoices.length} já processadas)`
              : "Todas as notas de exemplo já foram processadas"}
          </p>
          <p className="text-sm text-slate-500">
            Simula o fluxo real: extração pela IA → revisão → confirmação.
          </p>
          <button
            onClick={startNext}
            className="mt-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            {remainingSamples > 0 ? "Processar próxima nota de exemplo" : "Processar novamente"}
          </button>
        </div>
      )}

      {stage.step === "extracting" && (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
          <p className="text-sm text-slate-600">📄 {stage.sample.fileName}</p>
          <p className="animate-pulse text-sm font-medium text-brand-600">
            Lendo a nota com IA... (simulado)
          </p>
        </div>
      )}

      {stage.step === "review" && (
        <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
          <div>
            <h2 className="text-lg font-semibold">Confira os dados extraídos</h2>
            <p className="text-sm text-slate-500">
              A IA pode errar campos como CNPJ — revise antes de salvar.
              {stage.invoice.confidence < 0.6 && (
                <span className="ml-1 font-medium text-amber-600">
                  Confiança baixa nesta leitura, revise com atenção.
                </span>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Fornecedor"
              value={stage.invoice.supplier_name ?? ""}
              onChange={(v) => updateInvoiceField("supplier_name", v || null)}
            />
            <Field
              label="CNPJ"
              value={stage.invoice.supplier_cnpj ?? ""}
              onChange={(v) => updateInvoiceField("supplier_cnpj", v || null)}
            />
            <Field
              label="Data de emissão"
              type="date"
              value={stage.invoice.issue_date ?? ""}
              onChange={(v) => updateInvoiceField("issue_date", v || null)}
            />
            <Field
              label="Número da nota"
              value={stage.invoice.invoice_number ?? ""}
              onChange={(v) => updateInvoiceField("invoice_number", v || null)}
            />
            <Field
              label="Valor total (R$)"
              type="number"
              value={stage.invoice.total_amount?.toString() ?? ""}
              onChange={(v) => updateInvoiceField("total_amount", v ? Number(v) : null)}
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">Itens</h3>
              {!itemsMatchTotal(stage.invoice) && (
                <span className="text-sm text-amber-600">Soma dos itens não bate com o total</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {stage.invoice.items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 text-sm">
                  <input
                    className="col-span-6 rounded border border-slate-300 px-2 py-1"
                    value={item.description}
                    onChange={(e) => updateItem(i, { description: e.target.value })}
                  />
                  <input
                    type="number"
                    className="col-span-2 rounded border border-slate-300 px-2 py-1"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className="col-span-2 rounded border border-slate-300 px-2 py-1"
                    value={item.unit_price}
                    onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    className="col-span-2 rounded border border-slate-300 px-2 py-1"
                    value={item.total_price}
                    onChange={(e) => updateItem(i, { total_price: Number(e.target.value) })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={confirm}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
            >
              Confirmar (simulado)
            </button>
            <button
              onClick={() => setStage({ step: "idle" })}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {stage.step === "saved" && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-6 text-center text-green-800">
          <p className="font-medium">Nota &quot;salva&quot; na sessão demo!</p>
          <button
            onClick={() => setStage({ step: "idle" })}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Continuar
          </button>
        </div>
      )}

      {saved.length > 0 && (
        <>
          <section>
            <h2 className="mb-2 text-lg font-semibold">Histórico (sessão demo)</h2>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Fornecedor</th>
                    <th className="px-4 py-3 font-medium">Data</th>
                    <th className="px-4 py-3 font-medium">Itens</th>
                    <th className="px-4 py-3 font-medium">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {saved.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3">{s.invoice.supplier_name ?? "—"}</td>
                      <td className="px-4 py-3">{s.invoice.issue_date ?? "—"}</td>
                      <td className="px-4 py-3">{s.invoice.items.length}</td>
                      <td className="px-4 py-3">{formatCurrency(s.invoice.total_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="mb-2 text-sm font-medium text-slate-600">
              Prévia do dashboard (com esses dados fictícios)
            </h2>
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard label="Total gasto" value={formatCurrency(summary.totalSpent)} />
              <StatCard label="Notas processadas" value={String(summary.invoiceCount)} />
              <StatCard label="Ticket médio" value={formatCurrency(summary.averageTicket)} />
            </div>
            <MonthlySpendChart data={summary.monthly} />
            <div className="mt-4">
              <SupplierSpendChart data={summary.bySupplier} />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-brand-500"
      />
    </label>
  );
}
