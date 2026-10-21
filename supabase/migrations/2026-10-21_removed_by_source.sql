-- Removed by source: events an org deleted from its own calendar.
-- Run once in Supabase → SQL Editor. Safe to re-run.
begin;

alter table events add column if not exists removed_from_source_at timestamptz;   -- when the sync noticed it was gone
alter table events add column if not exists status_before_removal text;           -- set while waiting for admin review
alter table events add column if not exists keep_despite_source boolean not null default false;  -- admin chose "Keep it"

-- Fast lookup for the Moderation Queue tab
create index if not exists events_removed_review_idx
  on events (town, date) where status_before_removal is not null;

commit;
