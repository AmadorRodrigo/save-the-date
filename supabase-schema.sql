-- Execute no SQL Editor do projeto Supabase. Cadastre somente os e-mails do casal.
create extension if not exists pgcrypto;
create extension if not exists pg_cron;

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
  p_response text, p_spouse_coming boolean, p_spouse_name text, p_children jsonb,
  p_children_consent boolean, p_party_size integer
) returns boolean language plpgsql immutable set search_path = '' as $$
declare child jsonb; child_age text; age_value integer;
begin
  if p_response not in ('yes', 'maybe', 'no') or coalesce(jsonb_typeof(p_children), '') <> 'array' then return false; end if;
  if p_response <> 'yes' then
    return p_spouse_coming = false and p_spouse_name is null and jsonb_array_length(p_children) = 0
      and not p_children_consent and p_party_size is null;
  end if;
  if p_spouse_coming and (char_length(trim(coalesce(p_spouse_name, ''))) not between 2 and 150
    or trim(p_spouse_name) !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+') then return false; end if;
  if not p_spouse_coming and p_spouse_name is not null then return false; end if;
  if jsonb_array_length(p_children) > 20 then return false; end if;
  for child in select value from jsonb_array_elements(p_children) loop
    if jsonb_typeof(child) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(child)) <> 2 or not (child ? 'name' and child ? 'age') then return false; end if;
    if jsonb_typeof(child->'name') <> 'string' then return false; end if;
    if char_length(trim(child->>'name')) not between 2 and 150 or trim(child->>'name') !~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+' then return false; end if;
    if jsonb_typeof(child->'age') <> 'number' then return false; end if;
    child_age := child->>'age';
    if child_age !~ '^[0-9]{1,3}$' then return false; end if;
    age_value := child_age::integer;
    if age_value > 120 then return false; end if;
    if age_value < 18 and not p_children_consent then return false; end if;
  end loop;
  return coalesce(p_party_size = 1 + case when p_spouse_coming then 1 else 0 end + jsonb_array_length(p_children), false);
end;
$$;
revoke all on function public.valid_wedding_party(text, boolean, text, jsonb, boolean, integer) from public;

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(trim(full_name)) <= 150 and trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'),
  phone text not null check (phone ~ '^\+?[0-9]{7,15}$'),
  response text not null check (response in ('yes', 'maybe', 'no')),
  spouse_coming boolean not null default false,
  spouse_name text,
  children jsonb not null default '[]'::jsonb,
  privacy_consent boolean not null default false,
  privacy_notice_version text,
  privacy_consent_at timestamptz,
  children_consent boolean not null default false,
  children_consent_at timestamptz,
  party_size integer,
  message text check (message is null or char_length(message) <= 500),
  created_at timestamptz not null default now(),
  constraint rsvps_family_check check (public.valid_wedding_party(response, spouse_coming, spouse_name, children, children_consent, party_size)),
  constraint rsvps_privacy_consent_check check (privacy_consent and privacy_notice_version = '2026-11-v2' and privacy_consent_at is not null),
  constraint rsvps_children_consent_check check (children_consent = (children_consent_at is not null))
);

-- Se estiver atualizando a tabela da versão inicial, remova o modelo de acompanhantes antigo.
alter table public.rsvps add column if not exists spouse_coming boolean not null default false;
alter table public.rsvps add column if not exists spouse_name text;
alter table public.rsvps add column if not exists phone text;
alter table public.rsvps add column if not exists children jsonb not null default '[]'::jsonb;
alter table public.rsvps add column if not exists privacy_consent boolean not null default false;
alter table public.rsvps add column if not exists privacy_notice_version text;
alter table public.rsvps add column if not exists privacy_consent_at timestamptz;
alter table public.rsvps add column if not exists children_consent boolean not null default false;
alter table public.rsvps add column if not exists children_consent_at timestamptz;
alter table public.rsvps drop constraint if exists rsvps_full_name_check;
alter table public.rsvps add constraint rsvps_full_name_check check (char_length(trim(full_name)) <= 150 and trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+') not valid;
alter table public.rsvps drop column if exists companions;
alter table public.rsvps drop constraint if exists rsvps_party_size_check;
alter table public.rsvps drop constraint if exists rsvps_family_check;
alter table public.rsvps add constraint rsvps_family_check check (public.valid_wedding_party(response, spouse_coming, spouse_name, children, children_consent, party_size)) not valid;
alter table public.rsvps drop constraint if exists rsvps_phone_check;
alter table public.rsvps add constraint rsvps_phone_check check (phone is not null and phone ~ '^\+?[0-9]{7,15}$') not valid;
alter table public.rsvps drop constraint if exists rsvps_privacy_consent_check;
alter table public.rsvps add constraint rsvps_privacy_consent_check check (privacy_consent and privacy_notice_version = '2026-11-v2' and privacy_consent_at is not null) not valid;
alter table public.rsvps drop constraint if exists rsvps_children_consent_check;
alter table public.rsvps add constraint rsvps_children_consent_check check (children_consent = (children_consent_at is not null)) not valid;

create or replace function public.capture_rsvp_consent_timestamps()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.privacy_consent_at := case when new.privacy_consent then now() else null end;
  new.children_consent_at := case when new.children_consent then now() else null end;
  return new;
end;
$$;
revoke all on function public.capture_rsvp_consent_timestamps() from public;
drop trigger if exists capture_rsvp_consent_timestamps on public.rsvps;
create trigger capture_rsvp_consent_timestamps before insert on public.rsvps
for each row execute function public.capture_rsvp_consent_timestamps();

alter table public.rsvps enable row level security;
revoke all on public.rsvps from anon, authenticated;
-- Substitui todas as políticas anteriores para impedir que uma regra legada permita leitura pública.
do $$ declare policy_name text;
begin
  for policy_name in select policyname from pg_policies where schemaname = 'public' and tablename = 'rsvps' loop
    execute format('drop policy if exists %I on public.rsvps', policy_name);
  end loop;
end $$;
drop function if exists public.valid_wedding_party(text, boolean, text, jsonb, integer);
drop policy if exists "Public can submit RSVP" on public.rsvps;
create policy "Public can submit RSVP" on public.rsvps for insert to anon, authenticated
with check (trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+' and char_length(trim(full_name)) <= 150 and response in ('yes','maybe','no')
  and phone is not null and phone ~ '^\+?[0-9]{7,15}$'
  and privacy_consent and privacy_notice_version = '2026-11-v2'
  and public.valid_wedding_party(response, spouse_coming, spouse_name, children, children_consent, party_size)
  and (message is null or char_length(message) <= 500));
drop policy if exists "Admins can read RSVPs" on public.rsvps;
create policy "Admins can read RSVPs" on public.rsvps for select to authenticated using (public.is_wedding_admin());
drop policy if exists "Admins can update RSVPs" on public.rsvps;
drop policy if exists "Admins can delete RSVPs" on public.rsvps;
revoke insert (message) on public.rsvps from anon, authenticated;
grant insert (full_name, phone, response, spouse_coming, spouse_name, children, party_size, privacy_consent, privacy_notice_version, children_consent) on public.rsvps to anon, authenticated;
grant select on public.rsvps to authenticated;

-- Apenas estas contas autenticadas podem consultar as confirmações.
insert into public.admin_emails (email) values ('rodrigobarista.amador@gmail.com'), ('vicgarrido10@gmail.com')
on conflict (email) do nothing;

-- Apaga as confirmações 30 dias após 28/05/2027; pode ser executado novamente com o mesmo nome.
select cron.schedule(
  'save-the-date-rsvp-retention',
  '0 3 * * *',
  $$delete from public.rsvps where now() >= timestamptz '2027-06-28 03:00:00+00'$$
);
