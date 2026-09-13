import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Recebe o "code" que o Supabase manda por e-mail (magic link) ou OAuth,
 * troca por uma sessão válida e redireciona para o app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
