-- Optional public contact email on events.
-- Run in Supabase → SQL Editor BEFORE deploying the public-contact-email branch
-- (the new code saves this column). Safe to re-run.
--
-- events.email          private submitter email (moved to event_contacts on save)
-- events.contact_email  shown on the event page as "Contact Organizer", only
--                       when the submitter / org / admin ticks the checkbox
alter table public.events add column if not exists contact_email text;

-- Check:
-- select column_name from information_schema.columns
-- where table_name = 'events' and column_name = 'contact_email';   -- 1 row
