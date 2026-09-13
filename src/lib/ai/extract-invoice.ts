import "server-only";
import {
  extractedInvoiceSchema,
  type ExtractedInvoice,
} from "@/lib/validation/invoice-schema";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// Llama 4 Scout foi descontinuado pelo Groq em 17/07/2026.
// Modelo de visão atual recomendado pelo Groq: Qwen3.6 27B.
const GROQ_MODEL = "qwen/qwen3.6-27b";

const SYSTEM_PROMPT = `Você é um sistema de extração de dados de notas fiscais brasileiras.
Analise a imagem ou PDF da nota fiscal e devolva APENAS um objeto JSON, sem
nenhum texto antes ou depois, seguindo exatamente este formato:

{
  "supplier_name": string | null,
  "supplier_cnpj": string | null,   // somente dígitos, 14 caracteres
  "issue_date": string | null,      // formato ISO AAAA-MM-DD
  "invoice_number": string | null,
  "total_amount": number | null,
  "items": [
    { "description": string, "quantity": number, "unit_price": number, "total_price": number }
  ],
  "confidence": number              // 0 a 1, sua confiança na extração
}

Regras:
- Se não conseguir ler um campo com segurança, use null em vez de adivinhar.
- Nunca invente CNPJ, datas ou valores que não estejam legíveis na imagem.
- "confidence" deve refletir a qualidade real da leitura (imagem borrada,
  nota parcialmente cortada etc. devem reduzir a confiança).
- Responda SOMENTE com o JSON, sem markdown, sem comentários, sem \`\`\`.`;

export class InvoiceExtractionError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = "InvoiceExtractionError";
  }
}

interface ExtractInvoiceInput {
  /** Base64 do arquivo, sem o prefixo "data:...;base64," */
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
}

export async function extractInvoiceFromFile(
  input: ExtractInvoiceInput
): Promise<ExtractedInvoice> {
  // O modelo de visão do Groq (Llama 4 Scout) só aceita imagens, não PDF.
  if (input.mediaType === "application/pdf") {
    throw new InvoiceExtractionError(
      "PDF não é suportado no momento. Envie a nota como imagem (JPG, PNG ou WEBP)."
    );
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new InvoiceExtractionError(
      "GROQ_API_KEY não configurada no servidor."
    );
  }

  let res: Response;
  try {
    res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 900,
        temperature: 0.2,
        reasoning_effort: "none",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extraia os dados desta nota fiscal." },
              {
                type: "image_url",
                image_url: {
                  url: `data:${input.mediaType};base64,${input.base64Data}`,
                },
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error("Erro real da API Groq:", err);
    throw new InvoiceExtractionError(
      "Falha ao chamar a API do Groq. Tente novamente em instantes.",
      err
    );
  }

  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    console.error("Erro real da API Groq:", res.status, errBody);
    throw new InvoiceExtractionError(
      "Falha ao chamar a API do Groq. Tente novamente em instantes.",
      errBody
    );
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    console.error("Resposta completa do Groq (sem content):", JSON.stringify(data));
    throw new InvoiceExtractionError("A IA não retornou texto na resposta.");
  }

  let parsed: unknown;
  try {
    // Remove blocos de "pensamento" que modelos como Qwen podem incluir,
    // markdown (```json), e qualquer texto fora do objeto JSON.
    let cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, "");
    cleaned = cleaned.replace(/```json|```/g, "").trim();
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("Conteúdo bruto recebido do Groq:", content);
    throw new InvoiceExtractionError(
      "A IA não devolveu um JSON válido. A nota pode estar ilegível.",
      err
    );
  }

  const result = extractedInvoiceSchema.safeParse(parsed);
  if (!result.success) {
    throw new InvoiceExtractionError(
      "Os dados extraídos não passaram na validação.",
      result.error
    );
  }

  return result.data;
}