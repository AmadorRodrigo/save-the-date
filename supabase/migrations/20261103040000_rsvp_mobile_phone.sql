-- Stores a normalized Brazilian mobile number for new RSVP submissions.
-- Historical responses remain intact with phone = NULL.
alter table public.rsvps add column if not exists phone text;

alter table public.rsvps drop constraint if exists rsvps_phone_check;
alter table public.rsvps add constraint rsvps_phone_check
  check (phone is not null and phone ~ '^[1-9][0-9]9[0-9]{8}$') not valid;

-- New submissions use the privacy notice that explains collection of the phone number.
alter table public.rsvps drop constraint if exists rsvps_privacy_consent_check;
alter table public.rsvps add constraint rsvps_privacy_consent_check
  check (privacy_consent and privacy_notice_version = '2026-11-v2' and privacy_consent_at is not null) not valid;

drop policy if exists "Public can submit RSVP" on public.rsvps;
create policy "Public can submit RSVP" on public.rsvps for insert to anon, authenticated
with check (
  trim(full_name) ~ '^[^[:space:]]+[[:space:]]+[^[:space:]]+'
  and char_length(trim(full_name)) <= 150
  and phone is not null
  and phone ~ '^[1-9][0-9]9[0-9]{8}$'
  and response in ('yes','maybe','no')
  and privacy_consent
  and privacy_notice_version = '2026-11-v2'
  and public.valid_wedding_party(response, spouse_coming, spouse_name, children, children_consent, party_size)
  and (message is null or char_length(message) <= 500)
);

revoke all on public.rsvps from anon, authenticated;
revoke insert (message) on public.rsvps from anon, authenticated;
grant insert (full_name, phone, response, spouse_coming, spouse_name, children, party_size, privacy_consent, privacy_notice_version, children_consent) on public.rsvps to anon, authenticated;
grant select on public.rsvps to authenticated;
