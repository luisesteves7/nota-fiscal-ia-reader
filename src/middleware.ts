import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Mantém a sessão do Supabase viva em Server Components: lê o cookie de
 * sessão, renova o token se necessário, e regrava o cookie na resposta.
 * Sem isso, o usuário seria deslogado silenciosamente após o token expirar.
 */
export async function middleware(request: NextRequest) {
  // /demo é a rota pública "modo demo": roda 100% no navegador, sem tocar
  // no Supabase. Não pode depender de env vars configuradas, senão quebra
  // justamente o cenário que ela existe para resolver (repo clonado sem
  // nenhuma chave configurada ainda).
  if (request.nextUrl.pathname.startsWith("/demo")) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (
          cookiesToSet: { name: string; value: string; options: CookieOptions }[]
        ) => {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthRoute =
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/auth");

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|examples/).*)",
  ],
};
