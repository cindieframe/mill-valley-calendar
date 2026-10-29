-- Event contact privacy.
-- Run in Supabase → SQL Editor AFTER the event-contact-privacy branch is deployed.
-- Needs 2026-10-21_rls_lockdown.sql (is_admin, owns_org_named) — already run Oct 29.
-- Safe to re-run.
--
-- Before: every event row (pending and rejected too) and its submitter's email
-- could be read by anyone with the public key that ships in the website.
-- After:
--   * Only approved events are publicly readable. Admins see every event; a
--     logged-in org sees its own.
--   * Submitter emails live in `event_contacts`, which only admins and the
--     owning org can read (via event_contact_emails()). Any save that sets
--     events.email moves it there and leaves the public column empty — so no
--     existing screen or import needs to change how it saves.
begin;

-- 1. Private table for submitter emails ------------------------------------
create table if not exists public.event_contacts (
  event_id   bigint primary key
             references public.events(id) on delete cascade
             deferrable initially deferred,  -- lets the insert trigger below run before the event row exists
  email      text not null,
  updated_at timestamptz not null default now()
);
alter table public.event_contacts enable row level security;
-- No policies on purpose: only the service key (server routes) and the
-- security-definer functions below can read or write it.

-- 2. Move existing emails, then blank the public column --------------------
insert into public.event_contacts (event_id, email)
select id, btrim(email) from public.events
where email is not null and btrim(email) <> ''
on conflict (event_id) do update set email = excluded.email, updated_at = now();

update public.events set email = null where email is not null;

-- 3. Every future save: stash the email privately, keep the public row empty --
create or replace function public.stash_event_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Saves that don't touch the email (it's already null on the row) pass through.
  if new.email is null then
    return new;
  end if;
  if btrim(new.email) = '' then
    delete from event_contacts where event_id = new.id;      -- email cleared
  else
    insert into event_contacts (event_id, email) values (new.id, btrim(new.email))
    on conflict (event_id) do update set email = excluded.email, updated_at = now();
  end if;
  new.email := null;
  return new;
end $$;

drop trigger if exists stash_event_email on public.events;
create trigger stash_event_email
  before insert or update of email on public.events
  for each row execute function public.stash_event_email();

-- 4. Reading emails: admins, or the org that owns the event ----------------
create or replace function public.event_contact_emails(event_ids bigint[])
returns table (event_id bigint, email text)
language sql stable security definer set search_path = public as $$
  select c.event_id, c.email
  from event_contacts c
  join events e on e.id = c.event_id
  where c.event_id = any(event_ids)
    and (is_admin() or owns_org_named(e.organization))
$$;
revoke all on function public.event_contact_emails(bigint[]) from public, anon;
grant execute on function public.event_contact_emails(bigint[]) to authenticated;

-- 5. Only approved events are public --------------------------------------
drop policy if exists "Allow public read access" on public.events;
drop policy if exists "Read approved events, or own / admin" on public.events;
create policy "Read approved events, or own / admin" on public.events
  for select to anon, authenticated
  using (
    status = 'approved'
    or (select is_admin())
    or ((select auth.uid()) is not null and owns_org_named(organization))
  );

commit;

-- Checks (run after):
-- select count(*) from events where email is not null;           -- expect 0
-- select count(*) from event_contacts;                           -- emails moved
-- select policyname from pg_policies where tablename = 'events'; -- "Read approved events, or own / admin", no "Allow public read access"
