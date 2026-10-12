-- Auto-confirm: captured items confirm themselves when two sources agree, and only then.
begin;
-- Counts are scoped to the test user: a local database also holds demo data.
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated');

insert into public.accounts (id, user_id, institution_id, type, name, opening_balance_centavos, opening_balance_at) values
  ('aaaaaaaa-4444-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'bpi'), 'savings', 'BPI', 3000000, '2026-10-01 00:00+08'),
  ('aaaaaaaa-4444-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'gcash'), 'ewallet', 'GCash', 100000, '2026-10-01 00:00+08'),
  ('aaaaaaaa-4444-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
   (select id from public.institutions where slug = 'maya'), 'ewallet', 'Maya', 0, '2026-10-01 00:00+08');

-- BPI -> GCash, PHP 22,170.00: BPI's text (no balance) arrives first.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-5555-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001',
   -2217000, '2026-10-12 19:53+08', 'Transfer to GCash/G-Xchange', 'pending', 'sms');
select auto_confirm_captured(array['aaaaaaaa-5555-4000-8000-000000000001'::uuid]);
select is((select status::text from transactions where id = 'aaaaaaaa-5555-4000-8000-000000000001'), 'pending',
  'one side of a transfer alone still waits for review');

-- GCash's text: received, new balance 1,000 + 22,170.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-5555-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002',
   2217000, '2026-10-12 19:54+08', 'Received from BPI', 'pending', 'sms');
insert into public.balance_checkpoints (user_id, account_id, balance_centavos, as_of, source)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002', 2317000, '2026-10-12 19:54+08', 'sms');
select auto_confirm_captured(array['aaaaaaaa-5555-4000-8000-000000000002'::uuid]);
select is((select count(*)::int from transactions where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and transfer_id is not null and status = 'confirmed' and auto_confirmed = 'transfer'), 2,
  'both texts together confirm one transfer');
select is((select count(distinct transfer_id)::int from transactions where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and transfer_id is not null), 1, 'the legs share one transfer');

-- Undo from either leg reopens both and unpairs them.
select reopen_transaction('aaaaaaaa-5555-4000-8000-000000000001');
select is((select count(*)::int from transactions where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and status = 'pending' and transfer_id is null and auto_confirmed is null), 2,
  'undo sends both legs back to review');

-- Balance rule: GCash pays PHP 130.83 and says the new balance; Budget agrees once pending items count.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-5555-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002',
   -13083, '2026-10-12 21:00+08', 'FFT*PINDUOD', 'pending', 'sms');
insert into public.balance_checkpoints (user_id, account_id, balance_centavos, as_of, source)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002', 2317000 - 13083, '2026-10-12 21:00+08', 'sms');
select auto_confirm_captured(array['aaaaaaaa-5555-4000-8000-000000000003'::uuid]);
select is((select auto_confirmed from transactions where id = 'aaaaaaaa-5555-4000-8000-000000000003'), 'balance',
  'a purchase confirms itself when GCash''s stated balance matches');
select is((select auto_confirmed from transactions where id = 'aaaaaaaa-5555-4000-8000-000000000002'), 'balance',
  'earlier waiting texts on that account confirm with it');
select is((select status::text from transactions where id = 'aaaaaaaa-5555-4000-8000-000000000001'), 'pending',
  'other accounts are untouched');

-- The BPI leg arrives again for pairing: a balance-confirmed leg can still become a transfer.
select auto_confirm_captured(array['aaaaaaaa-5555-4000-8000-000000000001'::uuid]);
select is((select auto_confirmed from transactions where id = 'aaaaaaaa-5555-4000-8000-000000000002'), 'transfer',
  'a leg confirmed by its balance is paired when the other bank''s text comes');

-- A mismatch (the -227 case) leaves things for review.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-5555-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002',
   -11600, '2026-10-12 22:00+08', 'MCDO', 'pending', 'sms');
insert into public.balance_checkpoints (user_id, account_id, balance_centavos, as_of, source)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002', 2317000 - 13083 - 11600 - 22700, '2026-10-12 22:00+08', 'sms');
select auto_confirm_captured(array['aaaaaaaa-5555-4000-8000-000000000004'::uuid]);
select is((select status::text from transactions where id = 'aaaaaaaa-5555-4000-8000-000000000004'), 'pending',
  'when Budget and the bank disagree, nothing is confirmed');

-- Two possible matches: a person decides.
insert into public.transactions (id, user_id, account_id, amount_centavos, occurred_at, merchant, status, source) values
  ('aaaaaaaa-5555-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000001',
   -50000, '2026-10-13 09:00+08', 'Transfer to GCash', 'pending', 'sms'),
  ('aaaaaaaa-5555-4000-8000-000000000006', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000003',
   -50000, '2026-10-13 09:05+08', 'Send to GCash', 'pending', 'sms'),
  ('aaaaaaaa-5555-4000-8000-000000000007', 'aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-4444-4000-8000-000000000002',
   50000, '2026-10-13 09:01+08', 'Received from BPI', 'pending', 'sms');
select auto_confirm_captured(array['aaaaaaaa-5555-4000-8000-000000000007'::uuid]);
select is((select status::text from transactions where id = 'aaaaaaaa-5555-4000-8000-000000000007'), 'pending',
  'an ambiguous match is left for review');

-- Manual entries are never auto-confirmed, and users can't call the function.
select is((select count(*)::int from transactions where user_id = 'aaaaaaaa-0000-4000-8000-000000000001' and auto_confirmed is not null and source = 'manual'), 0, 'manual rows are never touched');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select throws_ok($$select public.auto_confirm_captured(array[]::uuid[])$$, '42501', null, 'only the parse jobs can run auto-confirm');

select * from finish();
rollback;
