-- Portal Costa Júnior · Novos Negócios
-- Rode no Supabase: SQL Editor > New query > colar > Run.
-- Só usuários logados (equipe) leem e gravam. Visitantes anônimos não acessam nada.

create table if not exists public.nn_terrenos (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

create table if not exists public.nn_leads (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  text
);

alter table public.nn_terrenos enable row level security;
alter table public.nn_leads    enable row level security;

drop policy if exists "equipe acessa terrenos" on public.nn_terrenos;
create policy "equipe acessa terrenos" on public.nn_terrenos
  for all to authenticated using (true) with check (true);

drop policy if exists "equipe acessa interessados" on public.nn_leads;
create policy "equipe acessa interessados" on public.nn_leads
  for all to authenticated using (true) with check (true);

revoke all on public.nn_terrenos, public.nn_leads from anon;
