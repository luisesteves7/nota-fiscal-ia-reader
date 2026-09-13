import { describe, expect, it } from "vitest";
import {
  EXTRACTION_RATE_LIMIT_PER_HOUR,
  checkExtractionRateLimit,
  getWindowStart,
  isRateLimited,
} from "./rate-limit";

describe("getWindowStart", () => {
  it("retorna exatamente 1h antes do instante de referência", () => {
    const now = new Date("2026-01-15T12:00:00.000Z");
    const windowStart = getWindowStart(now);
    expect(windowStart.toISOString()).toBe("2026-01-15T11:00:00.000Z");
  });
});

describe("isRateLimited", () => {
  it("libera quando as tentativas estão abaixo do limite", () => {
    expect(isRateLimited(5, 10)).toBe(false);
  });

  it("bloqueia quando as tentativas atingem exatamente o limite", () => {
    expect(isRateLimited(10, 10)).toBe(true);
  });

  it("bloqueia quando as tentativas passam do limite", () => {
    expect(isRateLimited(11, 10)).toBe(true);
  });

  it("usa o limite padrão do produto (15/hora) quando nenhum é informado", () => {
    expect(isRateLimited(EXTRACTION_RATE_LIMIT_PER_HOUR - 1)).toBe(false);
    expect(isRateLimited(EXTRACTION_RATE_LIMIT_PER_HOUR)).toBe(true);
  });
});

/**
 * Fake mínimo do pedaço do SupabaseClient usado por checkExtractionRateLimit:
 * a cadeia .from().select().eq().gte() precisa ser "thenable" (resolvida com
 * await), e .from().insert() precisa ser uma função separada — assim como no
 * client real do supabase-js.
 */
function createFakeSupabase(options: {
  countInWindow: number;
  countError?: unknown;
  insertError?: unknown;
}) {
  const { countInWindow, countError = null, insertError = null } = options;
  const insertedRows: Array<{ user_id: string }> = [];

  const selectChain = {
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    then(
      onFulfilled: (value: { count: number; error: unknown }) => unknown
    ) {
      return Promise.resolve({ count: countInWindow, error: countError }).then(
        onFulfilled
      );
    },
  };

  const fakeClient = {
    from(_table: string) {
      return {
        select: () => selectChain,
        insert: async (row: { user_id: string }) => {
          insertedRows.push(row);
          return { error: insertError };
        },
      };
    },
  };

  return {
    client: fakeClient,
    getInsertedRows: () => insertedRows,
  };
}

describe("checkExtractionRateLimit", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("permite e registra a tentativa quando há cota disponível", async () => {
    const { client, getInsertedRows } = createFakeSupabase({ countInWindow: 3 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkExtractionRateLimit(client as any, "user-1", now);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(EXTRACTION_RATE_LIMIT_PER_HOUR - 3 - 1);
    expect(getInsertedRows()).toEqual([{ user_id: "user-1" }]);
  });

  it("bloqueia e NÃO registra tentativa quando o limite já foi atingido", async () => {
    const { client, getInsertedRows } = createFakeSupabase({
      countInWindow: EXTRACTION_RATE_LIMIT_PER_HOUR,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkExtractionRateLimit(client as any, "user-1", now);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(getInsertedRows()).toEqual([]);
  });

  it("calcula resetAt como 1h à frente do instante de referência", async () => {
    const { client } = createFakeSupabase({ countInWindow: 0 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkExtractionRateLimit(client as any, "user-1", now);

    expect(result.resetAt.toISOString()).toBe("2026-01-15T13:00:00.000Z");
  });

  it("fail-open: libera (sem registrar) se a consulta de contagem falhar", async () => {
    const { client, getInsertedRows } = createFakeSupabase({
      countInWindow: 0,
      countError: new Error("conexão falhou"),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkExtractionRateLimit(client as any, "user-1", now);

    expect(result.allowed).toBe(true);
    expect(getInsertedRows()).toEqual([]);
  });

  it("fail-open: libera mesmo se o registro da tentativa falhar", async () => {
    const { client } = createFakeSupabase({
      countInWindow: 2,
      insertError: new Error("insert falhou"),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await checkExtractionRateLimit(client as any, "user-1", now);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(EXTRACTION_RATE_LIMIT_PER_HOUR - 2 - 1);
  });
});