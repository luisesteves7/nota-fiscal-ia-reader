import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { invoiceUpdateSchema } from "@/lib/validation/invoice-schema";

/**
 * Atualiza uma nota já salva (e substitui seus itens). Usado pela tela de
 * edição em /historico/[id]/editar — NÃO cria uma nota nova, só atualiza
 * a existente in-place.
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const parsed = invoiceUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados da nota não passaram na validação.",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    );
  }
  const invoice = parsed.data;

  // Confere que a nota existe e é do usuário logado antes de mexer em
  // qualquer coisa. A RLS já bloqueia isso no banco (ver "invoices: update
  // próprias" em 0001_init.sql), mas checar aqui dá uma mensagem melhor do
  // que um 404 genérico do Postgrest.
  const { data: existing, error: fetchError } = await supabase
    .from("invoices")
    .select("id, user_id")
    .eq("id", params.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Nota não encontrada." }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 403 });
  }

  const { data: updatedInvoice, error: updateError } = await supabase
    .from("invoices")
    .update({
      supplier_name: invoice.supplier_name,
      supplier_cnpj: invoice.supplier_cnpj,
      issue_date: invoice.issue_date,
      invoice_number: invoice.invoice_number,
      total_amount: invoice.total_amount,
    })
    .eq("id", params.id)
    .select()
    .single();

  if (updateError || !updatedInvoice) {
    console.error("Erro ao atualizar nota:", updateError);
    return NextResponse.json(
      { error: "Falha ao atualizar a nota." },
      { status: 500 }
    );
  }

  // Substitui os itens: apaga os antigos e insere os novos. Mais simples e
  // seguro que tentar dar diff item a item, e o volume por nota é pequeno.
  const { error: deleteError } = await supabase
    .from("invoice_items")
    .delete()
    .eq("invoice_id", params.id);

  if (deleteError) {
    console.error("Erro ao remover itens antigos:", deleteError);
    return NextResponse.json(
      { error: "Nota atualizada, mas houve erro ao atualizar os itens." },
      { status: 207 }
    );
  }

  if (invoice.items.length > 0) {
    const { error: insertItemsError } = await supabase
      .from("invoice_items")
      .insert(
        invoice.items.map((item) => ({
          invoice_id: params.id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }))
      );

    if (insertItemsError) {
      console.error("Erro ao inserir itens atualizados:", insertItemsError);
      return NextResponse.json(
        { error: "Nota atualizada, mas houve erro ao salvar os itens." },
        { status: 207 }
      );
    }
  }

  return NextResponse.json({ data: updatedInvoice }, { status: 200 });
}
