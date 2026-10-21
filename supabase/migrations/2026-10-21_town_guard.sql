-- Town guard: one spelling per town, enforced by the database.
-- Run once in Supabase → SQL Editor. Safe to re-run.
begin;

-- Canonical town name for any spelling we've seen:
-- "Mill Valley", "mill-valley", "San Anselmo, CA" → name from the towns table.
create or replace function canonical_town(raw text) returns text
language sql stable as $$
  with v as (
    select lower(btrim(regexp_replace(btrim(raw), ',\s*[A-Za-z]{2}$', ''))) as base
  )
  select t.name
  from towns t, v
  where lower(t.name) = v.base
     or lower(t.slug) = v.base
     or lower(t.slug) = trim(both '-' from regexp_replace(v.base, '[^a-z0-9]+', '-', 'g'))
  limit 1
$$;

-- 1. Clean up existing values.
-- Blocks typed as "San Anselmo, CA" that duplicate an existing "San Anselmo" block.
delete from blocked_orgs b
using blocked_orgs k
where b.id <> k.id
  and b.place_id = k.place_id
  and b.town is distinct from canonical_town(b.town)
  and k.town = canonical_town(b.town);

update events        set town = canonical_town(town) where canonical_town(town) is not null and town is distinct from canonical_town(town);
update ical_feeds    set town = canonical_town(town) where canonical_town(town) is not null and town is distinct from canonical_town(town);
update organizations set town = canonical_town(town) where canonical_town(town) is not null and town is distinct from canonical_town(town);
update blocked_orgs  set town = canonical_town(town) where canonical_town(town) is not null and town is distinct from canonical_town(town);

-- 2. Guard every future write: normalize the spelling, refuse unknown or blank towns.
-- Organizations may have no town (older orgs); everything else must have one.
create or replace function enforce_town() returns trigger
language plpgsql as $$
declare
  c text;
begin
  if tg_op = 'UPDATE' and new.town is not distinct from old.town then
    return new;
  end if;
  if new.town is null or btrim(new.town) = '' then
    if tg_table_name = 'organizations' then
      new.town := null;
      return new;
    end if;
    raise exception 'A town is required (%).', tg_table_name using errcode = '23502';
  end if;
  c := canonical_town(new.town);
  if c is null then
    raise exception 'Unknown town "%". Add it under Admin → Towns first.', new.town using errcode = '23514';
  end if;
  new.town := c;
  return new;
end $$;

drop trigger if exists enforce_town on events;
drop trigger if exists enforce_town on ical_feeds;
drop trigger if exists enforce_town on organizations;
drop trigger if exists enforce_town on blocked_orgs;

create trigger enforce_town before insert or update of town on events        for each row execute function enforce_town();
create trigger enforce_town before insert or update of town on ical_feeds    for each row execute function enforce_town();
create trigger enforce_town before insert or update of town on organizations for each row execute function enforce_town();
create trigger enforce_town before insert or update of town on blocked_orgs  for each row execute function enforce_town();

commit;
