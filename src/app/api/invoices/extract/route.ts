import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  extractInvoiceFromFile,
  InvoiceExtractionError,
} from "@/lib/ai/extract-invoice";
import {
  checkExtractionRateLimit,
  EXTRACTION_RATE_LIMIT_PER_HOUR,
} from "@/lib/rate-limit";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Protege a cota compartilhada da API de IA contra abuso. Checa ANTES de
  // gastar tempo validando/processando o arquivo. Ver src/lib/rate-limit.ts
  // para os detalhes (limite, comportamento fail-open, etc).
  const rateLimit = await checkExtractionRateLimit(supabase, user.id);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Limite de ${EXTRACTION_RATE_LIMIT_PER_HOUR} extrações por hora atingido. Tente novamente mais tarde.`,
      },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Nenhum arquivo enviado." },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Formato não suportado. Envie JPG, PNG ou WEBP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo muito grande. Limite de 10MB." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString("base64");

  try {
    const extracted = await extractInvoiceFromFile({
      base64Data,
      mediaType: file.type as "image/jpeg" | "image/png" | "image/webp",
    });

    return NextResponse.json({ data: extracted });
  } catch (err) {
    if (err instanceof InvoiceExtractionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    console.error("Erro inesperado na extração:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao processar a nota." },
      { status: 500 }
    );
  }
}