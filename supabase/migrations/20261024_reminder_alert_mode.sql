-- How a reminder alerts the user: ringtone (default), vibrate, notification (phone's own sound) or silent.
-- Existing reminders become ringtone reminders.

alter table public.reminders
  add column if not exists alert_mode text not null default 'ringtone';

alter table public.reminders
  drop constraint if exists reminders_alert_mode_check;

alter table public.reminders
  add constraint reminders_alert_mode_check
  check (alert_mode in ('ringtone', 'vibrate', 'notification', 'silent'));
