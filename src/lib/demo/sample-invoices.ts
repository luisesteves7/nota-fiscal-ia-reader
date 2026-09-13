import type { ExtractedInvoice } from "@/lib/validation/invoice-schema";
import papelaria from "../../../examples/exemplo-papelaria.json";
import mercado from "../../../examples/exemplo-mercado.json";
import posto from "../../../examples/exemplo-posto.json";

export interface SampleInvoice {
  /** Rótulo mostrado no botão/lista de exemplos. */
  label: string;
  /** Nome de arquivo fictício, só para exibição (não existe arquivo real). */
  fileName: string;
  invoice: ExtractedInvoice;
}

/**
 * Notas fiscais 100% fictícias, usadas apenas no modo demo (rota /demo).
 * Nenhum dado aqui corresponde a empresa ou pessoa real — CNPJs seguem o
 * formato válido (14 dígitos) só para passar pela mesma validação Zod usada
 * com dados reais, sem representar nenhum CNPJ existente.
 *
 * Os arquivos-fonte ficam em /examples como JSON simples, pra quem quiser
 * inspecionar ou trocar os exemplos sem mexer em código TypeScript.
 */
export const sampleInvoices: SampleInvoice[] = [papelaria, mercado, posto] as SampleInvoice[];
