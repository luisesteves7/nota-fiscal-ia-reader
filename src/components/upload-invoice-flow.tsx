"use client";

import { useRef, useState } from "react";
import type { ExtractedInvoice, InvoiceItem } from "@/lib/validation/invoice-schema";
import { itemsMatchTotal } from "@/lib/validation/invoice-schema";

type Stage =
  | { step: "idle" }
  | { step: "preview"; file: File; previewUrl: string }
  | { step: "extracting"; file: File; previewUrl: string }
  | { step: "review"; file: File; previewUrl: string; invoice: ExtractedInvoice }
  | { step: "saving"; file: File; previewUrl: string; invoice: ExtractedInvoice }
  | { step: "error"; message: string }
  | { step: "done" };

export function UploadInvoiceFlow() {
  const [stage, setStage] = useState<Stage>({ step: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelected(file: File) {
    const previewUrl = URL.createObjectURL(file);
    setStage({ step: "preview", file, previewUrl });
  }

  async function handleExtract() {
    if (stage.step !== "preview") return;
    const { file, previewUrl } = stage;
    setStage({ step: "extracting", file, previewUrl });

    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/invoices/extract", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        setStage({ step: "error", message: json.error ?? "Erro ao processar a nota." });
        return;
      }

      setStage({ step: "review", file, previewUrl, invoice: json.data });
    } catch {
      setStage({
        step: "error",
        message: "Não foi possível conectar ao servidor. Verifique sua conexão e tente de novo.",
      });
    }
  }

  async function handleConfirm() {
    if (stage.step !== "review") return;
    const { file, previewUrl, invoice } = stage;
    setStage({ step: "saving", file, previewUrl, invoice });

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("invoice", JSON.stringify(invoice));
      const res = await fetch("/api/invoices", { method: "POST", body: formData });

      if (!res.ok) {
        const json = await res.json();
        setStage({ step: "error", message: json.error ?? "Erro ao salvar a nota." });
        return;
      }

      setStage({ step: "done" });
    } catch {
      setStage({
        step: "error",
        message: "Não foi possível salvar. Verifique sua conexão e tente de novo.",
      });
    }
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
    const items = stage.invoice.items.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    setStage({ ...stage, invoice: { ...stage.invoice, items } });
  }

  function reset() {
    setStage({ step: "idle" });
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      {stage.step === "idle" && (
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white p-10 text-center hover:border-brand-500"
        >
          <p className="font-medium">Clique para enviar uma foto da nota</p>
          <p className="text-sm text-slate-500">JPG, PNG ou WEBP · até 10MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelected(file);
            }}
          />
        </div>
      )}

      {(stage.step === "preview" || stage.step === "extracting") && (
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6">
          <PreviewThumb file={stage.file} previewUrl={stage.previewUrl} />
          <div className="flex gap-3">
            <button
              onClick={handleExtract}
              disabled={stage.step === "extracting"}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
            >
              {stage.step === "extracting" ? "Lendo a nota com IA..." : "Processar com IA"}
            </button>
            <button
              onClick={reset}
              disabled={stage.step === "extracting"}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
          {stage.step === "extracting" && (
            <p className="text-sm text-slate-500">
              Isso pode levar alguns segundos, a IA está lendo item por item...
            </p>
          )}
        </div>
      )}

      {(stage.step === "review" || stage.step === "saving") && (
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
              onChange={(v) =>
                updateInvoiceField("total_amount", v ? Number(v) : null)
              }
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">Itens</h3>
              {!itemsMatchTotal(stage.invoice) && (
                <span className="text-sm text-amber-600">
                  Soma dos itens não bate com o total
                </span>
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
              onClick={handleConfirm}
              disabled={stage.step === "saving"}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900 disabled:opacity-60"
            >
              {stage.step === "saving" ? "Salvando..." : "Confirmar e salvar"}
            </button>
            <button
              onClick={reset}
              disabled={stage.step === "saving"}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {stage.step === "error" && (
        <div className="flex flex-col gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <p>{stage.message}</p>
          <button
            onClick={reset}
            className="w-fit rounded-md border border-red-300 px-4 py-2 text-sm font-medium hover:bg-red-100"
          >
            Tentar de novo
          </button>
        </div>
      )}

      {stage.step === "done" && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-green-200 bg-green-50 p-6 text-center text-green-800">
          <p className="font-medium">Nota salva com sucesso!</p>
          <button
            onClick={reset}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-900"
          >
            Enviar outra nota
          </button>
        </div>
      )}
    </div>
  );
}

function PreviewThumb({ file, previewUrl }: { file: File; previewUrl: string }) {
  if (file.type === "application/pdf") {
    return (
      <div className="flex items-center gap-3 rounded-md bg-slate-100 p-4">
        <span className="text-sm">📄 {file.name}</span>
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={previewUrl} alt="Preview da nota" className="max-h-80 rounded-md object-contain" />;
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