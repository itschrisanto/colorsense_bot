-- ColorSense Companion — Supabase schema
-- Run once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- No Row Level Security needed: the bot connects with the service_role
-- (secret) key, which bypasses RLS entirely, and no other client ever
-- touches this database.

create table if not exists testers (
  chat_id bigint primary key,
  consented_at timestamptz not null default now()
);

create table if not exists usage_events (
  id bigint generated always as identity primary key,
  chat_id bigint,
  label text not null,
  duration_ms integer not null,
  errored boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists usage_events_created_at_idx on usage_events (created_at);
create index if not exists usage_events_label_idx on usage_events (label);

create table if not exists feedback (
  id bigint generated always as identity primary key,
  chat_id bigint,
  who text,
  message text not null,
  created_at timestamptz not null default now()
);

-- One-time migration: carries over the one real tester who already
-- consented, from data/testers.json on the Mac Mini, so they aren't
-- asked to agree again.
insert into testers (chat_id, consented_at)
values (6193173907, '2026-08-27T05:14:45.302Z')
on conflict (chat_id) do nothing;
