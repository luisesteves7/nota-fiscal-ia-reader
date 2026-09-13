"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Database } from "@/types/database";
import { itemsMatchTotal, type InvoiceItem } from "@/lib/validation/invoice-schema";

type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
type InvoiceItemRow = Database["public"]["Tables"]["invoice_items"]["Row"];

interface EditableInvoice {
  supplier_name: string | null;
  supplier_cnpj: string | null;
  issue_date: string | null;
  invoice_number: string | null;
  total_amount: number | null;
  items: InvoiceItem[];
}

export function EditInvoiceForm({
  invoice,
}: {
  invoice: InvoiceRow & { invoice_items: InvoiceItemRow[] };
}) {
  const router = useRouter();
  const [form, setForm] = useState<EditableInvoice>({
    supplier_name: invoice.supplier_name,
    supplier_cnpj: invoice.supplier_cnpj,
    issue_date: invoice.issue_date,
    invoice_number: invoice.invoice_number,
    total_amount: invoice.total_amount,
    items: invoice.invoice_items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    })),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField<K extends keyof EditableInvoice>(
    key: K,
    value: EditableInvoice[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateItem(index: number, patch: Partial<InvoiceItem>) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((item, i) =>
        i === index ? { ...item, ...patch } : item
      ),
    }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Erro ao salvar a nota.");
        setSaving(false);
        return;
      }

      router.push("/historico");
      router.refresh();
    } catch {
      setError(
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo."
      );
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6">
      {error && (
        <p
          className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Fornecedor"
          value={form.supplier_name ?? ""}
          onChange={(v) => updateField("supplier_name", v || null)}
        />
        <Field
          label="CNPJ"
          value={form.supplier_cnpj ?? ""}
          onChange={(v) => updateField("supplier_cnpj", v || null)}
        />
        <Field
          label="Data de emissão"
          type="date"
          value={form.issue_date ?? ""}
          onChange={(v) => updateField("issue_date", v || null)}
        />
        <Field
          label="Número da nota"
          value={form.invoice_number ?? ""}
          onChange={(v) => updateField("invoice_number", v || null)}
        />
        <Field
          label="Valor total (R$)"
          type="number"
          value={form.total_amount?.toString() ?? ""}
          onChange={(v) =>
            updateField("total_amount", v ? Number(v) : null)
          }
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Itens</h3>
          {!itemsMatchTotal(form) && (
            <span className="text-sm text-amber-600">
              Soma dos itens não bate com o total
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {form.items.map((item, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 text-sm">
              <input
                className="col-span-6 rounded border border-slate-300 px-2 py-1"
                value={item.description}
                onChange={(e) =>
                  updateItem(i, { description: e.target.value })
                }
              />
              <input
                type="number"
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
                value={item.quantity}
                onChange={(e) =>
                  updateItem(i, { quantity: Number(e.target.value) })
                }
              />
              <input
                type="number"
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
                value={item.unit_price}
                onChange={(e) =>
                  updateItem(i, { unit_price: Number(e.target.value) })
                }
              />
              <input
                type="number"
                className="col-span-2 rounded border border-slate-300 px-2 py-1"
                value={item.total_price}
                onChange={(e) =>
                  updateItem(i, { total_price: Number(e.target.value) })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/historico")}
          disabled={saving}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
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
