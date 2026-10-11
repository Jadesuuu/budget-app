-- Phone capture: link resolution, revocation, duplicates, isolation.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'a@test.local', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'b@test.local', 'authenticated', 'authenticated');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
select lives_ok($$insert into public.capture_links (id, label, token_hash)
  values ('aaaaaaaa-9999-4000-8000-000000000001', 'Android', repeat('a', 64))$$, 'A can create a capture link');

reset role;
set local role service_role;
select is((select result from public.capture_message(repeat('a', 64), 'sms', 'BPI', null, 'You spent PHP 289.00', now(), repeat('1', 64))),
  'stored', 'a valid link stores the message');
select is((select result from public.capture_message(repeat('a', 64), 'sms', 'BPI', null, 'You spent PHP 289.00', now(), repeat('1', 64))),
  'duplicate', 'a retried message is stored once');
select is((select result from public.capture_message(repeat('f', 64), 'sms', 'BPI', null, 'x', now(), repeat('2', 64))),
  'invalid_link', 'unknown links are rejected');
select is((select user_id from public.raw_messages where dedupe_key = repeat('1', 64)),
  'aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'the message belongs to the link owner');
select is((select result from public.capture_message(repeat('a', 64), 'sms', 'Mama', 'x', 'personal text', now(), repeat('5', 64), 'Not a bank')),
  'stored', 'unknown senders are recorded');
select is((select coalesce(body, title, 'none') || '/' || status::text from public.raw_messages where dedupe_key = repeat('5', 64)),
  'none/flagged', 'but their message content is never kept');
select isnt((select last_used_at from public.capture_links where id = 'aaaaaaaa-9999-4000-8000-000000000001'), null,
  'the link records when it was last used');

-- Revoked links stop working.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true);
update public.capture_links set revoked_at = now() where id = 'aaaaaaaa-9999-4000-8000-000000000001';
reset role;
set local role service_role;
select is((select result from public.capture_message(repeat('a', 64), 'sms', 'BPI', null, 'later', now(), repeat('3', 64))),
  'invalid_link', 'revoked links are rejected');

-- B: no access to A's links or messages, and nobody but the server can capture.
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}', true);
select is((select count(*)::int from public.capture_links), 0, 'B cannot see A capture links');
select is((select count(*)::int from public.raw_messages), 0, 'B cannot see A captured messages');
select throws_ok($$select * from public.capture_message(repeat('a', 64), 'sms', 'x', null, 'x', now(), repeat('4', 64))$$,
  '42501', null, 'users cannot call the capture entry point');
select throws_ok($$update public.capture_links set token_hash = repeat('b', 64)$$, '42501', null, 'link secrets cannot be changed');

select * from finish();
rollback;
