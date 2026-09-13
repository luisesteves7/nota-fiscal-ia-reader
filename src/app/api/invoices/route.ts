import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractedInvoiceSchema } from "@/lib/validation/invoice-schema";

// Rate limit: mesmo sem chamar a IA, salvar notas grava no banco e no
// Storage — limita para impedir flood de dados (ex: alguém automatizando
// requisições diretas para essa rota, pulando a extração).
const SAVE_RATE_LIMIT_WINDOW_MINUTES = 60;
const SAVE_RATE_LIMIT_MAX_SAVES = 30;

// Mesmas regras de arquivo da rota de extração — precisa validar de novo
// aqui porque essa rota pode ser chamada diretamente, sem passar por lá.
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

  const windowStart = new Date(
    Date.now() - SAVE_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  const { count: recentSaves, error: rateLimitError } = await supabase
    .from("invoices")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", windowStart);

  if (rateLimitError) {
    console.error("Erro ao checar rate limit de salvamento:", rateLimitError);
  }

  if ((recentSaves ?? 0) >= SAVE_RATE_LIMIT_MAX_SAVES) {
    return NextResponse.json(
      {
        error: `Limite de ${SAVE_RATE_LIMIT_MAX_SAVES} notas salvas por hora atingido. Tente novamente mais tarde.`,
      },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const rawInvoice = formData.get("invoice");

  if (!(file instanceof File) || typeof rawInvoice !== "string") {
    return NextResponse.json(
      { error: "Requisição inválida." },
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

  // Revalida no servidor os dados que o usuário editou na tela de revisão —
  // nunca confiar apenas na validação feita no client.
  let invoicePayload: unknown;
  try {
    invoicePayload = JSON.parse(rawInvoice);
  } catch {
    return NextResponse.json(
      { error: "JSON da nota inválido." },
      { status: 400 }
    );
  }

  const parsed = extractedInvoiceSchema.safeParse(invoicePayload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados da nota não passaram na validação.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const invoice = parsed.data;

  // Upload do arquivo original para o Storage, dentro da pasta do usuário
  // (o path bate com a policy de RLS: (storage.foldername(name))[1] = auth.uid()).
  const fileExt = file.name.split(".").pop() ?? "bin";
  const filePath = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("invoices")
    .upload(filePath, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("Erro no upload:", uploadError);
    return NextResponse.json(
      { error: "Falha ao salvar o arquivo da nota." },
      { status: 500 }
    );
  }

  const { data: invoiceRow, error: insertError } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      supplier_name: invoice.supplier_name,
      supplier_cnpj: invoice.supplier_cnpj,
      issue_date: invoice.issue_date,
      invoice_number: invoice.invoice_number,
      total_amount: invoice.total_amount,
      raw_file_url: filePath,
      status: "done",
    })
    .select()
    .single();

  if (insertError || !invoiceRow) {
    console.error("Erro ao inserir nota:", insertError);
    // arquivo já subiu; não removemos automaticamente para não perder o
    // upload em caso de falha transitória — fica para limpeza manual/roadmap
    return NextResponse.json(
      { error: "Falha ao salvar a nota no banco." },
      { status: 500 }
    );
  }

  if (invoice.items.length > 0) {
    const { error: itemsError } = await supabase.from("invoice_items").insert(
      invoice.items.map((item) => ({
        invoice_id: invoiceRow.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price,
      }))
    );

    if (itemsError) {
      console.error("Erro ao inserir itens:", itemsError);
      return NextResponse.json(
        { error: "Nota salva, mas houve erro ao salvar os itens." },
        { status: 207 }
      );
    }
  }

  return NextResponse.json({ data: invoiceRow }, { status: 201 });
}