import { describe, expect, it } from "vitest";
import {
  extractedInvoiceSchema,
  itemsMatchTotal,
  type ExtractedInvoice,
} from "./invoice-schema";

function makeInvoice(overrides: Partial<ExtractedInvoice> = {}): ExtractedInvoice {
  return {
    supplier_name: "Mercado Exemplo LTDA",
    supplier_cnpj: "12345678000199",
    issue_date: "2026-01-15",
    invoice_number: "12345",
    total_amount: 42.5,
    items: [
      { description: "Arroz 5kg", quantity: 1, unit_price: 30, total_price: 30 },
      { description: "Feijão 1kg", quantity: 1, unit_price: 12.5, total_price: 12.5 },
    ],
    confidence: 0.92,
    ...overrides,
  };
}

describe("extractedInvoiceSchema", () => {
  it("aceita uma nota bem formada", () => {
    const result = extractedInvoiceSchema.safeParse(makeInvoice());
    expect(result.success).toBe(true);
  });

  it("aceita campos nulos quando a IA não consegue ler algo", () => {
    // Regra do produto: melhor null do que a IA inventar um valor.
    const result = extractedInvoiceSchema.safeParse(
      makeInvoice({ supplier_cnpj: null, issue_date: null, total_amount: null })
    );
    expect(result.success).toBe(true);
  });

  it("rejeita CNPJ que não tenha exatamente 14 dígitos", () => {
    const result = extractedInvoiceSchema.safeParse(
      makeInvoice({ supplier_cnpj: "123.456/0001-99" })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita data fora do formato ISO AAAA-MM-DD", () => {
    const result = extractedInvoiceSchema.safeParse(
      makeInvoice({ issue_date: "15/01/2026" })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita valor total negativo", () => {
    const result = extractedInvoiceSchema.safeParse(
      makeInvoice({ total_amount: -10 })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita item com quantidade zero ou negativa", () => {
    const result = extractedInvoiceSchema.safeParse(
      makeInvoice({
        items: [{ description: "Item", quantity: 0, unit_price: 10, total_price: 0 }],
      })
    );
    expect(result.success).toBe(false);
  });

  it("rejeita confidence fora do intervalo 0-1", () => {
    const result = extractedInvoiceSchema.safeParse(makeInvoice({ confidence: 1.5 }));
    expect(result.success).toBe(false);
  });
});

describe("itemsMatchTotal", () => {
  it("retorna true quando a soma dos itens bate com o total", () => {
    expect(itemsMatchTotal(makeInvoice())).toBe(true);
  });

  it("tolera diferença de até 1 centavo por arredondamento", () => {
    const invoice = makeInvoice({ total_amount: 42.51 });
    expect(itemsMatchTotal(invoice)).toBe(true);
  });

  it("retorna false quando a diferença passa de 1 centavo", () => {
    const invoice = makeInvoice({ total_amount: 50 });
    expect(itemsMatchTotal(invoice)).toBe(false);
  });

  it("retorna true quando o total é null (nada a comparar)", () => {
    const invoice = makeInvoice({ total_amount: null });
    expect(itemsMatchTotal(invoice)).toBe(true);
  });

  it("retorna false quando não há itens mas o total é maior que zero", () => {
    const invoice = makeInvoice({ items: [], total_amount: 42.5 });
    expect(itemsMatchTotal(invoice)).toBe(false);
  });
});