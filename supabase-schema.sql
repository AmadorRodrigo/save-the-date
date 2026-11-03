-- Execute no SQL Editor do projeto Supabase. Cadastre somente os e-mails do casal.
create extension if not exists pgcrypto;

create table if not exists public.admin_emails (
  email text primary key check (position('@' in email) > 1),
  created_at timestamptz not null default now()
);
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;

create or replace function public.is_wedding_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_emails a where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
revoke all on function public.is_wedding_admin() from public;
grant execute on function public.is_wedding_admin() to anon, authenticated;

create or replace function public.valid_wedding_party(
  p_response text, p_spouse_coming boolean, p_spouse_name text, p_children jsonb, p_party_size integer
) returns boolean language plpgsql immutable set search_path = '' as $$
declare child jsonb;
begin
  if p_response not in ('yes', 'maybe', 'no') or coalesce(jsonb_typeof(p_children), '') <> 'array' then return false; end if;
  if p_response <> 'yes' then
    return p_spouse_coming = false and p_spouse_name is null and jsonb_array_length(p_children) = 0 and p_party_size is null;
  end if;
  if p_spouse_coming and (char_length(trim(coalesce(p_spouse_name, ''))) not between 2 and 150
    or trim(p_spouse_name) !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+') then return false; end if;
  if not p_spouse_coming and p_spouse_name is not null then return false; end if;
  if jsonb_array_length(p_children) > 20 then return false; end if;
  for child in select value from jsonb_array_elements(p_children) loop
    if jsonb_typeof(child) <> 'object'
      or (select count(*) from jsonb_object_keys(child)) <> 2
      or not (child ? 'name' and child ? 'age')
      or jsonb_typeof(child->'name') <> 'string'
      or char_length(trim(child->>'name')) not between 2 and 150
      or trim(child->>'name') !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
      or jsonb_typeof(child->'age') <> 'number'
      or (child->>'age') !~ '^[0-9]{1,3}$'
      or (child->>'age')::integer > 120 then return false;
    end if;
  end loop;
  return coalesce(p_party_size = 1 + case when p_spouse_coming then 1 else 0 end + jsonb_array_length(p_children), false);
end;
$$;
revoke all on function public.valid_wedding_party(text, boolean, text, jsonb, integer) from public;

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) <= 150 and trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'),
  response text not null check (response in ('yes', 'maybe', 'no')),
  spouse_coming boolean not null default false,
  spouse_name text,
  children jsonb not null default '[]'::jsonb,
  party_size integer,
  message text check (message is null or char_length(message) <= 500),
  created_at timestamptz not null default now(),
  constraint rsvps_family_check check (public.valid_wedding_party(response, spouse_coming, spouse_name, children, party_size))
);

-- Se estiver atualizando a tabela da versão inicial, remova o modelo de acompanhantes antigo.
alter table public.rsvps add column if not exists spouse_coming boolean not null default false;
alter table public.rsvps add column if not exists spouse_name text;
alter table public.rsvps add column if not exists children jsonb not null default '[]'::jsonb;
alter table public.rsvps drop constraint if exists rsvps_full_name_check;
alter table public.rsvps add constraint rsvps_full_name_check check (char_length(trim(full_name)) <= 150 and trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+') not valid;
alter table public.rsvps drop column if exists phone;
alter table public.rsvps drop column if exists companions;
alter table public.rsvps drop constraint if exists rsvps_party_size_check;
alter table public.rsvps drop constraint if exists rsvps_family_check;
alter table public.rsvps add constraint rsvps_family_check check (public.valid_wedding_party(response, spouse_coming, spouse_name, children, party_size)) not valid;

alter table public.rsvps enable row level security;
revoke all on public.rsvps from anon, authenticated;
-- Substitui todas as políticas anteriores para impedir que uma regra legada permita leitura pública.
do $$ declare policy_name text;
begin
  for policy_name in select policyname from pg_policies where schemaname = 'public' and tablename = 'rsvps' loop
    execute format('drop policy if exists %I on public.rsvps', policy_name);
  end loop;
end $$;
drop policy if exists "Public can submit RSVP" on public.rsvps;
create policy "Public can submit RSVP" on public.rsvps for insert to anon, authenticated
with check (trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+' and char_length(trim(full_name)) <= 150 and response in ('yes','maybe','no')
  and public.valid_wedding_party(response, spouse_coming, spouse_name, children, party_size)
  and (message is null or char_length(message) <= 500));
drop policy if exists "Admins can read RSVPs" on public.rsvps;
create policy "Admins can read RSVPs" on public.rsvps for select to authenticated using (public.is_wedding_admin());
drop policy if exists "Admins can update RSVPs" on public.rsvps;
drop policy if exists "Admins can delete RSVPs" on public.rsvps;
grant insert (full_name, response, spouse_coming, spouse_name, children, party_size, message) on public.rsvps to anon, authenticated;
grant select on public.rsvps to authenticated;

-- Apenas estas contas autenticadas podem consultar as confirmações.
insert into public.admin_emails (email) values ('rodrigobarista.amador@gmail.com'), ('vicgarrido10@gmail.com')
on conflict (email) do nothing;
