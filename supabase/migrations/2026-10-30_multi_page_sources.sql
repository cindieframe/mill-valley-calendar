-- Multi-page AI sources: a Saved Source can read several pages.
-- organizations.website_url stays the first page; extra_urls holds the rest.
-- Run in Supabase → SQL Editor BEFORE deploying the multi-page-sources branch.
-- Safe to re-run.
alter table public.organizations
  add column if not exists extra_urls text[] not null default '{}';

-- Check:
-- select column_name from information_schema.columns
-- where table_name = 'organizations' and column_name = 'extra_urls';   -- 1 row
