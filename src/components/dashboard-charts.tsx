"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlySpend, SupplierSpend } from "@/lib/dashboard/aggregate";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Tooltip customizado — o padrão do recharts não segue o formato de moeda do app. */
function CurrencyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  const value = payload?.[0]?.value;
  if (!active || value === undefined) return null;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-slate-700">{label}</p>
      <p className="text-brand-600">{formatCurrency(value)}</p>
    </div>
  );
}

export function MonthlySpendChart({ data }: { data: MonthlySpend[] }) {
  const hasSpend = data.some((d) => d.total > 0);

  if (!hasSpend) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-slate-400">
        Nenhum gasto registrado no período.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          width={48}
          tickFormatter={(value: number) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`
          }
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "#f0f7ff" }} />
        <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SupplierSpendChart({ data }: { data: SupplierSpend[] }) {
  if (data.length === 0) {
    return (
      <p className="flex h-64 items-center justify-center text-sm text-slate-400">
        Nenhum fornecedor com gasto registrado ainda.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 40)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: number) =>
            value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `${value}`
          }
        />
        <YAxis
          type="category"
          dataKey="supplier"
          tick={{ fontSize: 12, fill: "#334155" }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip content={<CurrencyTooltip />} cursor={{ fill: "#f0f7ff" }} />
        <Bar dataKey="total" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
