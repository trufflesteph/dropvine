-- Republish the homepage demo drop 'wildflour-may-21' with ordering open
-- and every notification marked as already sent.
--
-- RUN ONLY AFTER the demo-drop code is deployed (lib/drops/demo.js and the
-- checks in the order endpoints, crons, fan-out and sold-out email). That
-- code is the main guard: demo drops never take orders and never send
-- anything. This script adds a second guard by stamping every "already
-- notified" field the notification paths check:
--   drops.notified_at           send-drop-notifications cron, publish, notify-now (fan-out)
--   drops.reminded_at           send-emails cron, reminder sweep   (only if the column exists)
--   drops.live_notified_at      send-emails cron, live sweep       (only if the column exists)
--   drops.sold_out_notified_at  sold-out vendor email
--   email_schedules.sent_at     drop-lifecycle cron: open, reminder_5d, pre_close_24h, close_summary
-- reminded_at / live_notified_at are read by the code but not created by any
-- migration in this repo, so they are updated only when present.

-- ---------------------------------------------------------------------------
-- Step 0 (read-only): look before changing anything.
-- ---------------------------------------------------------------------------
select * from public.drops where handle = 'wildflour-may-21';

select es.*
  from public.email_schedules es
  join public.drops d on d.id = es.drop_id
 where d.handle = 'wildflour-may-21'
 order by es.kind;

select column_name
  from information_schema.columns
 where table_schema = 'public' and table_name = 'drops'
   and column_name in ('is_demo', 'notify_at', 'notified_at', 'reminded_at',
                       'live_notified_at', 'sold_out_notified_at')
 order by column_name;

-- ---------------------------------------------------------------------------
-- Step 1: republish + mark notified, in one transaction.
-- ---------------------------------------------------------------------------
begin;

update public.drops
   set status               = 'published',
       launch_at            = now() - interval '1 day',
       closes_at            = null,
       is_demo              = true,
       notified_at          = coalesce(notified_at, now()),
       sold_out_notified_at = coalesce(sold_out_notified_at, now())
 where handle = 'wildflour-may-21';

do $$
begin
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'drops' and column_name = 'reminded_at') then
    execute $q$update public.drops set reminded_at = coalesce(reminded_at, now())
                where handle = 'wildflour-may-21'$q$;
  end if;
  if exists (select 1 from information_schema.columns
              where table_schema = 'public' and table_name = 'drops' and column_name = 'live_notified_at') then
    execute $q$update public.drops set live_notified_at = coalesce(live_notified_at, now())
                where handle = 'wildflour-may-21'$q$;
  end if;
end $$;

-- Every lifecycle kind exists and is marked sent, so the cron never picks
-- one up (including rows created later by a reschedule: the unique
-- (drop_id, kind) index makes those inserts no-ops).
insert into public.email_schedules (drop_id, kind, scheduled_for, sent_at, recipients)
select d.id, k.kind, now(), now(), 0
  from public.drops d
 cross join (values ('open'), ('reminder_5d'), ('pre_close_24h'), ('close_summary')) as k(kind)
 where d.handle = 'wildflour-may-21'
on conflict (drop_id, kind) do update
   set sent_at = coalesce(public.email_schedules.sent_at, excluded.sent_at);

-- Check: one drop row, published, launch_at ~1 day ago, closes_at null,
-- every notified field set, four email_schedules rows all with sent_at.
select handle, status, launch_at, closes_at, is_demo, notify_at, notified_at, sold_out_notified_at
  from public.drops where handle = 'wildflour-may-21';
select es.kind, es.sent_at, es.hold
  from public.email_schedules es
  join public.drops d on d.id = es.drop_id
 where d.handle = 'wildflour-may-21'
 order by es.kind;

commit;
