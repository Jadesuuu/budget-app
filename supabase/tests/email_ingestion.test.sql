-- Email ingestion: alias routing, duplicates, who may call ingest, forwarding sources.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Ana@Test.Local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

select is((select email from public.forwarding_sources where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'ana@test.local', 'the sign-in address is a known forwarding source, lowercased');

-- As the Worker (service role)
set local role service_role;
select is(public.ingest_raw_email((select inbound_alias from public.profiles where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'alerts@bank.example', 'x@in.example', '<m1@bank.example>', 'Alert', 'raw-1'), 'stored', 'a known alias stores the email');
select is(public.ingest_raw_email((select inbound_alias from public.profiles where user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'alerts@bank.example', 'x@in.example', '<m1@bank.example>', 'Alert', 'raw-1'), 'duplicate', 'the same message id is stored once');
select is(public.ingest_raw_email('u_zzzzzzzzzz', 'alerts@bank.example', 'x@in.example', '<m2@bank.example>', 'Alert', 'raw-2'),
  'unknown_alias', 'unknown aliases are rejected');
select is((select count(*)::int from public.raw_emails where message_id = '<m2@bank.example>'), 0, 'nothing is stored for an unknown alias');
select is((select status::text from public.raw_emails where message_id = '<m1@bank.example>'), 'pending', 'stored emails wait for the parser');
select is((select from_domain from public.raw_emails where message_id = '<m1@bank.example>'), 'bank.example', 'sender domain is recorded');

-- Users cannot call the ingest function or add sources as if Gmail confirmed them.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
select throws_ok($$select public.ingest_raw_email('u_x', 'a@b.c', 'x', 'm', 's', 'r')$$, '42501', null,
  'users cannot call the Worker entry point');
select lives_ok($$insert into public.forwarding_sources (email) values ('other.b@gmail.com')$$, 'users can add their own mailbox');
select throws_ok($$insert into public.forwarding_sources (email, added_by) values ('x@gmail.com', 'gmail_confirmation')$$,
  '42501', null, 'users cannot claim a Gmail-confirmed source');
select is((select count(*)::int from public.forwarding_sources), 2, 'B sees only own sources');
select is((select count(*)::int from public.raw_emails), 0, 'B cannot see A raw emails');

select * from finish();
rollback;
