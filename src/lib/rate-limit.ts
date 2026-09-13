import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Máximo de chamadas à IA de extração permitidas por usuário, por hora.
 *
 * A chave da API de IA é compartilhada entre todos os usuários do app
 * (não é uma chave por pessoa), então sem esse limite qualquer usuário
 * autenticado poderia esgotar a cota sozinho. Ver
 * supabase/migrations/0002_rate_limiting.sql para a tabela usada aqui.
 */
export const EXTRACTION_RATE_LIMIT_PER_HOUR = 15;

const WINDOW_MS = 60 * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  /** Quantas chamadas ainda restam na janela atual (0 se `allowed` for false). */
  remaining: number;
  /** Quando a janela atual libera de novo. */
  resetAt: Date;
}

/**
 * Início da janela deslizante de 1h, a partir de um instante de referência.
 * Função pura, sem I/O — separada para poder ser testada isoladamente.
 */
export function getWindowStart(now: Date): Date {
  return new Date(now.getTime() - WINDOW_MS);
}

/**
 * Decide se uma contagem de tentativas já bateu no limite. Função pura,
 * sem I/O — separada para poder ser testada isoladamente.
 */
export function isRateLimited(
  attemptsInWindow: number,
  limit: number = EXTRACTION_RATE_LIMIT_PER_HOUR
): boolean {
  return attemptsInWindow >= limit;
}

/**
 * Só o pedaço do client do Supabase que essa função realmente usa —
 * facilita passar um mock em teste sem precisar simular o SupabaseClient
 * inteiro.
 */
type ExtractionAttemptsClient = Pick<SupabaseClient<Database>, "from">;

/**
 * Verifica o limite de extrações do usuário na última hora e, se ainda
 * houver cota, já registra a tentativa atual antes de retornar.
 *
 * Comportamento "fail-open": se a checagem de limite ou o registro da
 * tentativa falharem (ex: banco fora do ar), a chamada é liberada mesmo
 * assim — a API de IA tem seu próprio limite de uso como última linha de
 * defesa, e é pior derrubar a extração inteira por causa de uma falha no
 * controle de rate limit do que deixar passar uma chamada a mais.
 */
export async function checkExtractionRateLimit(
  supabase: ExtractionAttemptsClient,
  userId: string,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const windowStart = getWindowStart(now);
  const resetAt = new Date(now.getTime() + WINDOW_MS);

  const { count, error: countError } = await supabase
    .from("extraction_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart.toISOString());

  if (countError) {
    console.error("Erro ao checar rate limit:", countError);
    return {
      allowed: true,
      remaining: EXTRACTION_RATE_LIMIT_PER_HOUR,
      resetAt,
    };
  }

  const attemptsInWindow = count ?? 0;

  if (isRateLimited(attemptsInWindow)) {
    return { allowed: false, remaining: 0, resetAt };
  }

  const { error: insertError } = await supabase
    .from("extraction_attempts")
    .insert({ user_id: userId });

  if (insertError) {
    console.error("Erro ao registrar tentativa de extração:", insertError);
  }

  return {
    allowed: true,
    remaining: EXTRACTION_RATE_LIMIT_PER_HOUR - attemptsInWindow - 1,
    resetAt,
  };
}