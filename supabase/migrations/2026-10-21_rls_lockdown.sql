-- RLS lockdown, step 1 of 2.
-- Run in Supabase → SQL Editor AFTER the security-api-auth branch is deployed
-- (the server routes must already be using the service key, or imports and the
-- 6-hour sync stop working). Safe to re-run.
--
-- Before this, the public (anon) key that ships in the website could update or
-- delete ANY event, insert approved events straight onto the calendar, add or
-- edit feeds, and unblock orgs. After this:
--   events        read: everyone (unchanged — tightened in step 2)
--                 insert: anyone, but only as pending / pending_series; admins any status
--                 update/delete: admins, or the logged-in org that owns the event
--   ical_feeds    read only from the browser; writes only through server routes
--   blocked_orgs  read only from the browser; writes only through server routes
--   opportunities admins can update/delete (admin approve/delete was silently failing)
--   organizations orgs can still edit their own profile, but can't change
--                 verified / aggregator / owner / town; new orgs start unverified
begin;

-- Helpers. security definer so they work regardless of the caller's RLS.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins
    where email = auth.email()
      and role in ('super_admin', 'regional_admin')
  )
$$;

create or replace function public.owns_org_named(org_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from organizations o
    where o.user_id = auth.uid()
      and (lower(btrim(o.name)) = lower(btrim(org_name))
        or lower(btrim(o.canonical_name)) = lower(btrim(org_name)))
  )
$$;

-- ── events ──────────────────────────────────────────────────────────────
drop policy if exists "Allow public delete" on events;
drop policy if exists "Allow public update" on events;
drop policy if exists "Allow public insert" on events;
drop policy if exists "Submit pending events" on events;
drop policy if exists "Admins and owning orgs update events" on events;
drop policy if exists "Admins and owning orgs delete events" on events;

create policy "Submit pending events" on events
  for insert to anon, authenticated
  with check (status in ('pending', 'pending_series') or is_admin());

create policy "Admins and owning orgs update events" on events
  for update to authenticated
  using (is_admin() or owns_org_named(organization))
  with check (is_admin() or owns_org_named(organization));

create policy "Admins and owning orgs delete events" on events
  for delete to authenticated
  using (is_admin() or owns_org_named(organization));

-- ── ical_feeds: server routes only ───────────────────────────────────────
drop policy if exists "Allow public insert" on ical_feeds;
drop policy if exists "Allow public update" on ical_feeds;

-- ── blocked_orgs: server routes only (and one duplicate read policy) ────────
drop policy if exists "Public can delete blocked_orgs" on blocked_orgs;
drop policy if exists "Public can insert blocked_orgs" on blocked_orgs;
drop policy if exists "Anon can read blocked_orgs" on blocked_orgs;

-- ── opportunities: let admins moderate ─────────────────────────────────────
drop policy if exists "Admins update opportunities" on opportunities;
drop policy if exists "Admins delete opportunities" on opportunities;
create policy "Admins update opportunities" on opportunities
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "Admins delete opportunities" on opportunities
  for delete to authenticated using (is_admin());

-- ── organizations: protect admin-only fields ─────────────────────────────────
-- Applies to browser writes (anon / authenticated) by non-admins.
-- Server routes (service key) and admins are unaffected.
create or replace function public.protect_org_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.verified := false;
    new.is_aggregator := false;
  else
    new.verified := old.verified;
    new.is_aggregator := old.is_aggregator;
    new.user_id := old.user_id;
    new.town := old.town;
  end if;
  return new;
end $$;

drop trigger if exists protect_org_fields on organizations;
create trigger protect_org_fields
  before insert or update on organizations
  for each row execute function public.protect_org_fields();

commit;

-- Check: should list only SELECT for blocked_orgs / ical_feeds, and the new events policies.
-- select tablename, policyname, roles, cmd from pg_policies
-- where schemaname = 'public' and tablename in ('events','ical_feeds','blocked_orgs','opportunities')
-- order by tablename, cmd;
