-- ============================================================
-- nota-fiscal-ia-reader — rate limiting de extrações via IA
-- Rode este arquivo no SQL Editor do painel do Supabase, depois do
-- 0001_init.sql
-- (Project -> SQL Editor -> New query -> colar -> Run)
-- ============================================================

-- ---------------------------------------------------------------
-- Tabela: extraction_attempts
-- Registra cada chamada à API de IA para permitir contar quantas
-- extrações um usuário fez na última hora (ver src/lib/rate-limit.ts).
-- ---------------------------------------------------------------
create table if not exists public.extraction_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists extraction_attempts_user_id_created_at_idx
  on public.extraction_attempts (user_id, created_at);

alter table public.extraction_attempts enable row level security;

drop policy if exists "extraction_attempts: select próprias" on public.extraction_attempts;
create policy "extraction_attempts: select próprias"
  on public.extraction_attempts for select
  using (auth.uid() = user_id);

drop policy if exists "extraction_attempts: insert próprias" on public.extraction_attempts;
create policy "extraction_attempts: insert próprias"
  on public.extraction_attempts for insert
  with check (auth.uid() = user_id);
