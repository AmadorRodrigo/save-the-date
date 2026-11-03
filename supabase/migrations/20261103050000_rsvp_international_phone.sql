-- Accept local or international phone numbers with up to 15 digits.
-- The browser stores digits only, except for an optional leading plus sign.
alter table public.rsvps drop constraint if exists rsvps_phone_check;
alter table public.rsvps add constraint rsvps_phone_check
  check (phone is not null and phone ~ '^\+?[0-9]{7,15}$') not valid;

drop policy if exists "Public can submit RSVP" on public.rsvps;
create policy "Public can submit RSVP" on public.rsvps for insert to anon, authenticated
with check (
  trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  and char_length(trim(full_name)) <= 150
  and phone is not null
  and phone ~ '^\+?[0-9]{7,15}$'
  and response in ('yes','maybe','no')
  and privacy_consent
  and privacy_notice_version = '2026-11-v2'
  and public.valid_wedding_party(response, spouse_coming, spouse_name, children, children_consent, party_size)
  and (message is null or char_length(message) <= 500)
);
