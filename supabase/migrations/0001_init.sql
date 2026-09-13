-- ============================================================
-- nota-fiscal-ia-reader — schema inicial
-- Rode este arquivo no SQL Editor do painel do Supabase
-- (Project -> SQL Editor -> New query -> colar -> Run)
-- ============================================================

-- Extensão para gerar UUIDs
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------
-- Tabela: invoices
-- ---------------------------------------------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_name text,
  supplier_cnpj text,
  issue_date date,
  invoice_number text,
  total_amount numeric(12, 2),
  category text, -- preenchido pela IA no modo "categoria automática" (extra)
  raw_file_url text not null,
  status text not null default 'processing'
    check (status in ('processing', 'done', 'error')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists invoices_user_id_idx on public.invoices (user_id);
create index if not exists invoices_issue_date_idx on public.invoices (issue_date);
create index if not exists invoices_supplier_name_idx on public.invoices (supplier_name);

-- ---------------------------------------------------------------
-- Tabela: invoice_items
-- ---------------------------------------------------------------
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  quantity numeric(12, 3) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  total_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- ---------------------------------------------------------------
-- updated_at automático em invoices
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- Row Level Security: cada usuário só vê/edita suas próprias notas
-- ---------------------------------------------------------------
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy "invoices: select próprias"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "invoices: insert próprias"
  on public.invoices for insert
  with check (auth.uid() = user_id);

create policy "invoices: update próprias"
  on public.invoices for update
  using (auth.uid() = user_id);

create policy "invoices: delete próprias"
  on public.invoices for delete
  using (auth.uid() = user_id);

-- invoice_items herda a permissão via join com invoices
create policy "invoice_items: select via invoice"
  on public.invoice_items for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "invoice_items: insert via invoice"
  on public.invoice_items for insert
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and i.user_id = auth.uid()
    )
  );

create policy "invoice_items: delete via invoice"
  on public.invoice_items for delete
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_items.invoice_id and i.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------
-- Storage: bucket privado para os arquivos originais das notas
-- Rode também via painel: Storage -> New bucket -> "invoices" -> Private
-- As policies abaixo assumem esse bucket já criado.
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('invoices', 'invoices', false)
on conflict (id) do nothing;

create policy "storage: usuário lê seus próprios arquivos"
  on storage.objects for select
  using (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "storage: usuário faz upload na própria pasta"
  on storage.objects for insert
  with check (bucket_id = 'invoices' and (storage.foldername(name))[1] = auth.uid()::text);
