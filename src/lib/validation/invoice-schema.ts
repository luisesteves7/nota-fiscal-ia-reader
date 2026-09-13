import { z } from "zod";

/**
 * Schema de um item da nota fiscal (linha de produto/serviço).
 */
export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Descrição do item não pode ser vazia."),
  quantity: z.number().positive("Quantidade deve ser maior que zero."),
  unit_price: z.number().nonnegative("Preço unitário não pode ser negativo."),
  total_price: z.number().nonnegative("Total do item não pode ser negativo."),
});

/**
 * Schema da nota fiscal extraída pela IA (ver prompt em
 * src/lib/ai/extract-invoice.ts). Também usado para revalidar no servidor
 * os dados que o usuário editou na tela de revisão antes de salvar.
 */
export const extractedInvoiceSchema = z.object({
  supplier_name: z.string().min(1).nullable(),
  supplier_cnpj: z
    .string()
    .regex(/^\d{14}$/, "CNPJ deve conter exatamente 14 dígitos.")
    .nullable(),
  issue_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD.")
    .nullable(),
  invoice_number: z.string().min(1).nullable(),
  total_amount: z.number().nonnegative("Valor total não pode ser negativo.").nullable(),
  items: z.array(invoiceItemSchema),
  confidence: z
    .number()
    .min(0, "confidence deve estar entre 0 e 1.")
    .max(1, "confidence deve estar entre 0 e 1."),
});

export type InvoiceItem = z.infer<typeof invoiceItemSchema>;
export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

/**
 * Schema para editar uma nota JÁ SALVA (tela de histórico). Igual ao da
 * extração, mas sem "confidence" — esse campo só existe durante a leitura
 * pela IA, não é persistido no banco (ver supabase/migrations/0001_init.sql).
 */
export const invoiceUpdateSchema = extractedInvoiceSchema.omit({
  confidence: true,
});

export type InvoiceUpdate = z.infer<typeof invoiceUpdateSchema>;

/** Tolerância de arredondamento ao comparar soma dos itens com o total. */
const CENTS_TOLERANCE = 0.01;

/**
 * Verifica se a soma dos itens bate com o total da nota, com tolerância de
 * até 1 centavo (arredondamento). Se não houver total informado, não há o
 * que comparar — considera "ok".
 *
 * Aceita qualquer objeto com o formato mínimo necessário (não exige
 * especificamente um ExtractedInvoice), para poder ser reaproveitada na
 * tela de edição de notas já salvas.
 */
export function itemsMatchTotal(invoice: {
  total_amount: number | null;
  items: Pick<InvoiceItem, "total_price">[];
}): boolean {
  if (invoice.total_amount === null) return true;

  const itemsSum = invoice.items.reduce(
    (sum, item) => sum + item.total_price,
    0
  );

  return Math.abs(itemsSum - invoice.total_amount) <= CENTS_TOLERANCE;
}
